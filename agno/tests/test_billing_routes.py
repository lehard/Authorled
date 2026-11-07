"""Routes of the page «Тариф» and the notices of Tochka (openspec/specs/api/billing).

Tochka is replaced (tests/billing_fake.py) through the dependency of the routes; notices are signed by a key of the
test, except the example of the documentation, which is signed by Tochka.
"""

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select, update

from app.api.billing import WEBHOOK_PATH, tochka_client
from app.auth.authorization import PUBLIC_ROUTES
from core.tables import billing_checkouts, subscriptions, users
from core.tochka import Operation, webhook_key
from tests.billing_fake import FakeTochka, paid_plans

__all__ = ["paid_plans"]

pytestmark = pytest.mark.usefixtures("paid_plans")

PROBLEM = "application/problem+json"
DOC_NOTICE = (Path(__file__).parent / "fixtures" / "tochka_notice.jwt").read_bytes().strip()
SIGNER = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def tochka(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeTochka]:
    fake = FakeTochka()
    client.app.dependency_overrides[tochka_client] = lambda: fake  # type: ignore[attr-defined]
    monkeypatch.setattr("app.api.billing.webhook_key", lambda: SIGNER.public_key())
    yield fake
    client.app.dependency_overrides.clear()  # type: ignore[attr-defined]


def _notice(operation_id: str, **changes: Any) -> bytes:
    claims = {
        "webhookType": "acquiringInternetPayment",
        "operationId": operation_id,
        "customerCode": "1234567ab",
        "status": "APPROVED",
        "amount": "490.00",
        "maskedPan": "220445******0792",
        "cardType": "MIR",
        "tokenCardId": "208452",
        **changes,
    }
    return jwt.encode(claims, SIGNER, algorithm="RS256").encode()


def _post_notice(client: TestClient, body: bytes) -> Any:
    return client.post(WEBHOOK_PATH, content=body, headers={"Content-Type": "text/plain"})


def _operation_of(engine: Engine, author: Any) -> str:
    with engine.connect() as connection:
        user_id = select(users.c.id).where(users.c.auth_subject == author.subject).scalar_subquery()
        operation_id: str = connection.execute(
            select(billing_checkouts.c.operation_id)
            .where(billing_checkouts.c.user_id == user_id)
            .order_by(billing_checkouts.c.created_at.desc())
            .limit(1)
        ).scalar_one()
        return operation_id


def _bought(authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka) -> tuple[Any, str]:
    author = authors()
    assert author.post("/api/v1/billing/checkout", json={"plan": "pro"}).status_code == 200
    operation_id = _operation_of(engine, author)
    tochka.charge(operation_id, datetime.now(UTC))
    assert _post_notice(client, _notice(operation_id)).json() == {"counted": 1}
    return author, operation_id


# State and checkout


def test_free_plan(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    response = authors().get("/api/v1/billing")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"] == {"code": "beta", "name": "Бета", "limit_rub": "500"}
    assert (body["source"], body["state"], body["next_charge_at"], body["payment_url"], body["payments"]) == (
        "granted",
        "none",
        None,
        None,
        [],
    )
    assert [offer["code"] for offer in body["offers"]] == ["pro", "max"]
    assert body["offers"][0] == {"code": "pro", "name": "Про", "price_rub": "490", "limit_rub": "2000"}
    assert body["used_percent"] == 0


def test_checkout_and_pending(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    author = authors()
    response = author.post("/api/v1/billing/checkout", json={"plan": "pro"})
    assert response.status_code == 200, response.text
    url = response.json()["payment_url"]
    assert url.startswith("https://merch.example.com/order/")
    assert tochka.created[0]["email"] == f"{author.subject}@example.com"
    state = author.get("/api/v1/billing").json()
    assert (state["plan"]["code"], state["state"], state["payment_url"]) == ("beta", "pending", url)


@pytest.mark.parametrize(
    ("body", "field"), [({"plan": "beta"}, "plan"), ({"plan": "nothing"}, "plan"), ({}, None), ({"plan": 1}, None)]
)
def test_checkout_refusals(authors: Callable[..., Any], tochka: FakeTochka, body: Any, field: str | None) -> None:
    response = authors().post("/api/v1/billing/checkout", json=body)
    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM
    assert tochka.created == []


def test_checkout_when_paid(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    author, _ = _bought(authors, engine, client, tochka)
    assert author.post("/api/v1/billing/checkout", json={"plan": "max"}).status_code == 409


def test_checkout_when_tochka_is_down(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    tochka.unavailable = True
    response = authors().post("/api/v1/billing/checkout", json={"plan": "pro"})
    assert response.status_code == 503
    assert response.headers["content-type"] == PROBLEM


# Notices


def test_signed_notice_pays(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    author, _ = _bought(authors, engine, client, tochka)
    state = author.get("/api/v1/billing").json()
    assert (state["plan"]["code"], state["source"], state["state"]) == ("pro", "tochka", "active")
    assert state["next_charge_at"] is not None
    assert [payment["amount_rub"] for payment in state["payments"]] == ["490.00"]


def test_repeated_notice(authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka) -> None:
    author, operation_id = _bought(authors, engine, client, tochka)
    before = author.get("/api/v1/billing").json()["period_end"]
    assert _post_notice(client, _notice(operation_id)).json() == {"counted": 0}
    state = author.get("/api/v1/billing").json()
    assert (state["period_end"], len(state["payments"])) == (before, 1)


def test_forged_notice(authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka) -> None:
    author = authors()
    author.post("/api/v1/billing/checkout", json={"plan": "pro"})
    operation_id = _operation_of(engine, author)
    tochka.charge(operation_id, datetime.now(UTC))
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = {"webhookType": "acquiringInternetPayment", "operationId": operation_id, "customerCode": "1234567ab"}
    forged = jwt.encode(claims, stranger, algorithm="RS256")
    asked = len(tochka.operations)
    response = _post_notice(client, forged.encode())
    assert response.status_code == 400
    assert response.headers["content-type"] == PROBLEM
    assert len(tochka.operations) == asked
    assert author.get("/api/v1/billing").json()["plan"]["code"] == "beta"


def test_signed_notice_without_payment(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    author = authors()
    author.post("/api/v1/billing/checkout", json={"plan": "pro"})
    operation_id = _operation_of(engine, author)
    tochka.set(operation_id, status="EXPIRED")
    response = _post_notice(client, _notice(operation_id))
    assert (response.status_code, response.json()) == (200, {"counted": 0})
    assert author.get("/api/v1/billing").json()["plan"]["code"] == "beta"


def test_notice_when_tochka_is_down(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    author = authors()
    author.post("/api/v1/billing/checkout", json={"plan": "pro"})
    operation_id = _operation_of(engine, author)
    tochka.unavailable = True
    response = _post_notice(client, _notice(operation_id))
    assert response.status_code == 503
    assert response.headers["content-type"] == PROBLEM


def test_documented_notice_of_tochka(client: TestClient, tochka: FakeTochka, monkeypatch: pytest.MonkeyPatch) -> None:
    """The example of the documentation, signed by Tochka, passes the key of the repository; it pays nothing of ours."""
    monkeypatch.setattr("app.api.billing.webhook_key", webhook_key)
    tochka.operations["beeac8a4-6047-3f38-8922-a664e6b5c43b"] = Operation(
        operation_id="beeac8a4-6047-3f38-8922-a664e6b5c43b",
        status="APPROVED",
        customer_code="300123123",
        amount=Decimal("0.33"),
        payment_link_id="12345-ab-cd",
        paid_at=None,
        orders=(),
    )
    response = _post_notice(client, DOC_NOTICE)
    assert (response.status_code, response.json()) == (200, {"counted": 0})


def test_notice_needs_no_user_token() -> None:
    assert PUBLIC_ROUTES == (WEBHOOK_PATH,)


# Check and cancel


def test_check_after_return(authors: Callable[..., Any], engine: Engine, tochka: FakeTochka) -> None:
    author = authors()
    author.post("/api/v1/billing/checkout", json={"plan": "pro"})
    tochka.charge(_operation_of(engine, author), datetime.now(UTC))
    response = author.post("/api/v1/billing/check")
    assert response.status_code == 200, response.text
    assert (response.json()["state"], response.json()["plan"]["code"]) == ("active", "pro")


def test_cancel(authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka) -> None:
    author, operation_id = _bought(authors, engine, client, tochka)
    response = author.post("/api/v1/billing/cancel")
    assert response.status_code == 200, response.text
    assert (response.json()["state"], response.json()["next_charge_at"], response.json()["plan"]["code"]) == (
        "cancelled",
        None,
        "pro",
    )
    assert tochka.cancelled == [operation_id]
    assert author.post("/api/v1/billing/cancel").status_code == 409


def test_cancel_free_plan(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    response = authors().post("/api/v1/billing/cancel")
    assert response.status_code == 409
    assert response.headers["content-type"] == PROBLEM


def test_failed_charge_on_the_page(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    author, operation_id = _bought(authors, engine, client, tochka)
    tochka.fail_charges(operation_id)
    with engine.begin() as connection:
        user_id = select(users.c.id).where(users.c.auth_subject == author.subject).scalar_subquery()
        moved = datetime.now(UTC) - timedelta(days=1)
        connection.execute(
            update(subscriptions)
            .where(subscriptions.c.user_id == user_id, subscriptions.c.status == "active")
            .values(started_at=moved - timedelta(days=31), period_start=moved - timedelta(days=31), period_end=moved)
        )
    state = author.get("/api/v1/billing").json()
    assert (state["plan"]["code"], state["state"], state["checkout_plan"]) == ("beta", "failed", "pro")


def test_tochka_refusal_is_a_bad_gateway(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    from core.tochka import TochkaError

    def refuse(**_: Any) -> Any:
        raise TochkaError(403, "403", "Forbidden by consent")

    tochka.create_subscription = refuse  # type: ignore[method-assign]
    response = authors().post("/api/v1/billing/checkout", json={"plan": "pro"})
    assert response.status_code == 502
    assert "Forbidden by consent" in response.json()["detail"]


# Access


def test_without_account(authors: Callable[..., Any], tochka: FakeTochka) -> None:
    assert authors(account=False).get("/api/v1/billing").status_code == 404


def test_only_own_subscription(
    authors: Callable[..., Any], engine: Engine, client: TestClient, tochka: FakeTochka
) -> None:
    _bought(authors, engine, client, tochka)
    other = authors().get("/api/v1/billing").json()
    assert (other["plan"]["code"], other["payments"]) == ("beta", [])


def test_without_token(client: TestClient, tochka: FakeTochka) -> None:
    assert client.get("/api/v1/billing").status_code == 401

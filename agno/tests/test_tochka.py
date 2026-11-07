"""Client of the Tochka acquiring API (openspec/specs/integrations, «Интернет-эквайринг Точки» and the
requirements after it).

HTTP is replaced with httpx.MockTransport: no network, no database. Answers follow the OpenAPI schema of
Tochka and the sandbox answers of 2026-11-07. The notice in fixtures/tochka_notice.jwt is the example from
the documentation page of the acquiringInternetPayment webhook, signed by Tochka.
"""

import hmac
import json
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from core import tochka
from core.tochka import (
    InvalidNotice,
    TochkaClient,
    TochkaError,
    TochkaSettings,
    TochkaUnavailable,
    read_notice,
    tochka_settings,
    webhook_key,
)

DOC_NOTICE = (Path(__file__).parent / "fixtures" / "tochka_notice.jwt").read_bytes().strip()
OPERATION_ID = "48232c9a-ce82-1593-3cb6-5c85a1ffef8f"

ENV = {
    "TOCHKA_API_URL": "https://enter.tochka.com/sandbox/v2/",
    "TOCHKA_JWT": "sandbox.jwt.token",
    "TOCHKA_CUSTOMER_CODE": "1234567ab",
    "TOCHKA_MERCHANT_ID": "200000000001097",
    "TOCHKA_TAX_SYSTEM": "usn_income",
    "TOCHKA_VAT_TYPE": "none",
    "TOCHKA_PAYMENT_METHOD": "full_prepayment",
    "TOCHKA_REDIRECT_URL": "https://coauthor.example.com/settings/billing/return",
    "TOCHKA_FAIL_REDIRECT_URL": "https://coauthor.example.com/settings/billing/fail",
}


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch) -> TochkaSettings:
    for name, value in ENV.items():
        monkeypatch.setenv(name, value)
    return tochka_settings()


Handler = Callable[[httpx.Request], httpx.Response]


class Recorder:
    """A transport that answers with `handler` and keeps every request."""

    def __init__(self, handler: Handler) -> None:
        self.requests: list[httpx.Request] = []

        def handle(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            return handler(request)

        self.transport = httpx.MockTransport(handle)

    @property
    def body(self) -> Any:
        return json.loads(self.requests[-1].content)


def client(settings: TochkaSettings, handler: Handler) -> tuple[TochkaClient, Recorder]:
    recorder = Recorder(handler)
    return TochkaClient(settings, recorder.transport), recorder


def answer(status: int, body: Any) -> Handler:
    return lambda _: httpx.Response(status, json=body)


def wrapped(data: Any) -> dict[str, Any]:
    return {"Data": data, "Links": {"self": "https://enter.tochka.com/uapi"}, "Meta": {"totalPages": 1}}


CREATED = wrapped(
    {
        "purpose": "Подписка CoAuthor",
        "amount": 490.0,
        "operationId": OPERATION_ID,
        "paymentLink": f"https://merch.example.com/order/?uuid={OPERATION_ID}",
        "customerCode": "1234567ab",
        "status": "CREATED",
        "Client": {"email": "writer@example.com"},
        "Items": [{"name": "Тариф «Про»", "amount": 490.0, "quantity": 1.0}],
    }
)

OPERATION = wrapped(
    {
        "Operation": [
            {
                "customerCode": "1234567ab",
                "createdAt": "2026-11-07T08:28:59+00:00",
                "amount": 490.1,
                "status": "APPROVED",
                "operationId": OPERATION_ID,
                "paymentLink": f"https://merch.example.com/order/?uuid={OPERATION_ID}",
                "paymentLinkId": "0b9e0f9a-2d36-4c3c-9d2c-9f1f8f0c7a11",
                "paidAt": "2026-11-07T08:30:12+00:00",
                "maskedPan": "220445******0792",
                "Order": [
                    {"orderId": "ord-1", "type": "approval", "amount": 490.1, "time": "2026-11-07T08:30:12+00:00"},
                ],
            }
        ]
    }
)


# Settings


@pytest.mark.parametrize("name", list(ENV))
def test_missing_setting_is_named(settings: TochkaSettings, monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    monkeypatch.delenv(name)
    with pytest.raises(RuntimeError, match=name):
        tochka_settings()


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("TOCHKA_API_URL", "https://example.com/uapi/"),
        ("TOCHKA_API_URL", "https://enter.tochka.com/uapi"),
        ("TOCHKA_CUSTOMER_CODE", "12345678"),
        ("TOCHKA_MERCHANT_ID", "20000000000109"),
        ("TOCHKA_TAX_SYSTEM", "usn"),
        ("TOCHKA_VAT_TYPE", "vat20"),
        ("TOCHKA_PAYMENT_METHOD", "prepayment"),
        ("TOCHKA_REDIRECT_URL", "http://localhost:5173/settings/billing/return"),
        ("TOCHKA_FAIL_REDIRECT_URL", "settings/billing/fail"),
    ],
)
def test_wrong_setting_is_named(
    settings: TochkaSettings, monkeypatch: pytest.MonkeyPatch, name: str, value: str
) -> None:
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError, match=name):
        tochka_settings()


def test_wrong_tax_system_lists_the_allowed(settings: TochkaSettings, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TOCHKA_TAX_SYSTEM", "usn")
    with pytest.raises(RuntimeError, match="osn, usn_income, usn_income_outcome, esn, patent"):
        tochka_settings()


def test_production_address(settings: TochkaSettings, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TOCHKA_API_URL", "https://enter.tochka.com/uapi/")
    assert tochka_settings().api_url == tochka.PRODUCTION_URL


def test_key_is_not_shown(settings: TochkaSettings) -> None:
    assert "sandbox.jwt.token" not in repr(settings)


def test_ca_bundle_is_in_the_repository() -> None:
    assert tochka.CA_BUNDLE.is_file()
    assert "BEGIN CERTIFICATE" in tochka.CA_BUNDLE.read_text()


# Create a subscription


def test_create_subscription_request(settings: TochkaSettings) -> None:
    api, sent = client(settings, answer(200, CREATED))
    created = api.create_subscription(
        payment_link_id="0b9e0f9a-2d36-4c3c-9d2c-9f1f8f0c7a11",
        purpose="Подписка CoAuthor, тариф «Про», месяц",
        item_name="Подписка CoAuthor, тариф «Про», 1 месяц",
        amount=Decimal("490.00"),
        email="writer@example.com",
    )
    assert created.operation_id == OPERATION_ID
    assert created.payment_link == f"https://merch.example.com/order/?uuid={OPERATION_ID}"
    request = sent.requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://enter.tochka.com/sandbox/v2/acquiring/v1.0/subscriptions_with_receipt"
    assert request.headers["Authorization"] == "Bearer sandbox.jwt.token"
    assert sent.body == {
        "Data": {
            "customerCode": "1234567ab",
            "merchantId": "200000000001097",
            "amount": 490.0,
            "purpose": "Подписка CoAuthor, тариф «Про», месяц",
            "paymentLinkId": "0b9e0f9a-2d36-4c3c-9d2c-9f1f8f0c7a11",
            "redirectUrl": "https://coauthor.example.com/settings/billing/return",
            "failRedirectUrl": "https://coauthor.example.com/settings/billing/fail",
            "Client": {"email": "writer@example.com"},
            "Items": [
                {
                    "name": "Подписка CoAuthor, тариф «Про», 1 месяц",
                    "amount": 490.0,
                    "quantity": 1,
                    "vatType": "none",
                    "paymentMethod": "full_prepayment",
                    "paymentObject": "service",
                    "measure": "шт.",
                }
            ],
            "taxSystemCode": "usn_income",
            "Options": {"period": "Month", "trancheCount": 84},
        }
    }


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-1"), Decimal("490.001")])
def test_create_refuses_a_wrong_amount(settings: TochkaSettings, amount: Decimal) -> None:
    api, sent = client(settings, answer(200, CREATED))
    with pytest.raises(ValueError):
        api.create_subscription(payment_link_id="x", purpose="p", item_name="i", amount=amount, email="a@example.com")
    assert sent.requests == []


@pytest.mark.parametrize(
    ("field", "value"), [("payment_link_id", "x" * 46), ("purpose", "x" * 141), ("item_name", ""), ("purpose", "")]
)
def test_create_refuses_wrong_lengths(settings: TochkaSettings, field: str, value: str) -> None:
    api, sent = client(settings, answer(200, CREATED))
    arguments: dict[str, Any] = {
        "payment_link_id": "x",
        "purpose": "p",
        "item_name": "i",
        "amount": Decimal(1),
        "email": "a@example.com",
    }
    arguments[field] = value
    with pytest.raises(ValueError):
        api.create_subscription(**arguments)
    assert sent.requests == []


def test_create_answer_without_link(settings: TochkaSettings) -> None:
    broken = json.loads(json.dumps(CREATED))
    del broken["Data"]["paymentLink"]
    api, _ = client(settings, answer(200, broken))
    with pytest.raises(TochkaError, match="paymentLink"):
        api.create_subscription(payment_link_id="x", purpose="p", item_name="i", amount=Decimal(1), email="a@b.ru")


# Refusals and failures


VALIDATION_ERROR = {
    "code": "400",
    "id": "20492bfd-f21d-4bad-ae68-6a207f9f71dd",
    "message": "Что-то пошло не так",
    "Errors": [
        {
            "errorCode": "Validation Error",
            "message": "Field redirectUrl : Value error, URL scheme cannot be http; ",
            "url": "https://developers.tochka.com/",
        }
    ],
}


def test_refusal_carries_code_and_messages(settings: TochkaSettings) -> None:
    api, _ = client(settings, answer(400, VALIDATION_ERROR))
    with pytest.raises(TochkaError) as refused:
        api.subscription_status(OPERATION_ID)
    assert refused.value.status == 400
    assert refused.value.code == "400"
    assert "Что-то пошло не так" in refused.value.message
    assert "URL scheme cannot be http" in refused.value.message
    assert "20492bfd" not in str(refused.value)


def test_refusal_before_the_api(settings: TochkaSettings) -> None:
    """A wrong or missing token is refused with only `message` (sandbox, 2026-11-07)."""
    api, _ = client(settings, answer(403, {"message": "The access token is missing"}))
    with pytest.raises(TochkaError) as refused:
        api.operation(OPERATION_ID)
    assert (refused.value.status, refused.value.code) == (403, None)
    assert refused.value.message == "The access token is missing"


def test_refusal_without_json(settings: TochkaSettings) -> None:
    api, _ = client(settings, lambda _: httpx.Response(404, text="<html>Not Found</html>"))
    with pytest.raises(TochkaError, match="без JSON"):
        api.operation(OPERATION_ID)


@pytest.mark.parametrize("status", [500, 502, 503])
def test_server_error_is_unavailable(settings: TochkaSettings, status: int) -> None:
    api, _ = client(settings, answer(status, {"message": "down"}))
    with pytest.raises(TochkaUnavailable, match=str(status)):
        api.operation(OPERATION_ID)


@pytest.mark.parametrize("failure", [httpx.ConnectError("refused"), httpx.ReadTimeout("slow")])
def test_network_failure_is_unavailable(settings: TochkaSettings, failure: Exception) -> None:
    def fail(_: httpx.Request) -> httpx.Response:
        raise failure

    api, _ = client(settings, fail)
    with pytest.raises(TochkaUnavailable):
        api.operation(OPERATION_ID)


def test_answer_without_json(settings: TochkaSettings) -> None:
    api, _ = client(settings, lambda _: httpx.Response(200, text="ok"))
    with pytest.raises(TochkaError, match="без JSON"):
        api.operation(OPERATION_ID)


# Cancel and status


def test_cancel_request(settings: TochkaSettings) -> None:
    api, sent = client(settings, answer(200, wrapped({"result": True})))
    api.cancel_subscription(OPERATION_ID)
    request = sent.requests[0]
    assert request.method == "POST"
    assert request.url.path == f"/sandbox/v2/acquiring/v1.0/subscriptions/{OPERATION_ID}/status"
    assert sent.body == {"Data": {"status": "Cancelled"}}


def test_cancel_not_confirmed(settings: TochkaSettings) -> None:
    api, _ = client(settings, answer(200, wrapped({"result": False})))
    with pytest.raises(TochkaError, match="отмену"):
        api.cancel_subscription(OPERATION_ID)


def test_subscription_status(settings: TochkaSettings) -> None:
    api, sent = client(settings, answer(200, wrapped({"status": "PastDue"})))
    assert api.subscription_status(OPERATION_ID) == "PastDue"
    assert sent.requests[0].method == "GET"
    assert sent.requests[0].url.path == f"/sandbox/v2/acquiring/v1.0/subscriptions/{OPERATION_ID}/status"


def test_unknown_subscription_status_is_named(settings: TochkaSettings) -> None:
    api, _ = client(settings, answer(200, wrapped({"status": "Paused"})))
    with pytest.raises(TochkaError, match="status"):
        api.subscription_status(OPERATION_ID)


@pytest.mark.parametrize("operation_id", ["../payments", "a/b", "", "a?b=1"])
def test_id_stays_one_path_segment(settings: TochkaSettings, operation_id: str) -> None:
    api, sent = client(settings, answer(200, OPERATION))
    with pytest.raises(ValueError):
        api.operation(operation_id)
    assert sent.requests == []


# Operation


def test_operation(settings: TochkaSettings) -> None:
    api, sent = client(settings, answer(200, OPERATION))
    operation = api.operation(OPERATION_ID)
    assert sent.requests[0].url.path == f"/sandbox/v2/acquiring/v1.0/payments/{OPERATION_ID}"
    assert operation.operation_id == OPERATION_ID
    assert operation.status == "APPROVED"
    assert operation.customer_code == "1234567ab"
    assert operation.amount == Decimal("490.1")
    assert operation.payment_link_id == "0b9e0f9a-2d36-4c3c-9d2c-9f1f8f0c7a11"
    assert operation.paid_at is not None and operation.paid_at.isoformat() == "2026-11-07T08:30:12+00:00"
    [order] = operation.orders
    assert (order.order_id, order.type, order.amount) == ("ord-1", "approval", Decimal("490.1"))
    assert "maskedPan" not in repr(operation)


def test_sandbox_operation(settings: TochkaSettings) -> None:
    """The answer of the sandbox (2026-11-07): APPROVED with no orders and no paymentLinkId."""
    sandbox = {
        "Data": {
            "Operation": [
                {
                    "customerCode": "1234567ab",
                    "paymentType": "card",
                    "paymentId": "12965545",
                    "transactionId": "b4552292-c9e9-3901-98ba-9cbda828d97d",
                    "createdAt": "2022-10-18T08:28:59+00:00",
                    "purpose": "test",
                    "amount": 100.0,
                    "status": "APPROVED",
                    "operationId": "b26287ee-bdd0-3482-a10d-3c462f5ba6db",
                    "paymentLink": "https://merch.example.com/order/?uuid=b26287ee-bdd0-3482-a10d-3c462f5ba6db",
                    "Order": [],
                }
            ]
        },
        "Links": {"self": "https://enter.tochka.com/uapi/acquiring/v1.0/payments/48232c9a"},
        "Meta": {"totalPages": 1},
    }
    api, _ = client(settings, answer(200, sandbox))
    operation = api.operation(OPERATION_ID)
    assert (operation.status, operation.amount, operation.orders, operation.payment_link_id) == (
        "APPROVED",
        Decimal("100.0"),
        (),
        None,
    )


@pytest.mark.parametrize(("field", "value"), [("status", "PAID"), ("Order", None), ("paidAt", "2026-11-07 08:30")])
def test_operation_outside_the_schema_is_named(settings: TochkaSettings, field: str, value: Any) -> None:
    broken = json.loads(json.dumps(OPERATION))
    if value is None:
        del broken["Data"]["Operation"][0][field]
    else:
        broken["Data"]["Operation"][0][field] = value
    api, _ = client(settings, answer(200, broken))
    with pytest.raises(TochkaError, match=field):
        api.operation(OPERATION_ID)


def test_unknown_order_type_is_named(settings: TochkaSettings) -> None:
    broken = json.loads(json.dumps(OPERATION))
    broken["Data"]["Operation"][0]["Order"][0]["type"] = "chargeback"
    api, _ = client(settings, answer(200, broken))
    with pytest.raises(TochkaError, match="Order.0.type"):
        api.operation(OPERATION_ID)


@pytest.mark.parametrize("count", [0, 2])
def test_one_operation_is_expected(settings: TochkaSettings, count: int) -> None:
    several = json.loads(json.dumps(OPERATION))
    several["Data"]["Operation"] = several["Data"]["Operation"] * count
    api, _ = client(settings, answer(200, several))
    with pytest.raises(TochkaError, match="одна операция"):
        api.operation(OPERATION_ID)


# Notices


def test_documented_notice_is_signed_by_tochka() -> None:
    notice = read_notice(DOC_NOTICE, webhook_key())
    assert notice.operation_id == "beeac8a4-6047-3f38-8922-a664e6b5c43b"
    assert notice.customer_code == "300123123"


def test_trailing_newline_is_accepted() -> None:
    assert read_notice(DOC_NOTICE + b"\n", webhook_key()).operation_id == "beeac8a4-6047-3f38-8922-a664e6b5c43b"


def _claims() -> dict[str, Any]:
    return jwt.decode(DOC_NOTICE.decode(), options={"verify_signature": False})


def test_notice_signed_by_another_key() -> None:
    stranger = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode(_claims(), stranger, algorithm="RS256")
    with pytest.raises(InvalidNotice):
        read_notice(forged.encode(), webhook_key())


def test_changed_notice() -> None:
    header, payload, signature = DOC_NOTICE.decode().split(".")
    claims = {**_claims(), "operationId": "00000000-0000-0000-0000-000000000000"}
    changed = jwt.utils.base64url_encode(json.dumps(claims).encode()).decode()
    with pytest.raises(InvalidNotice):
        read_notice(f"{header}.{changed}.{signature}".encode(), webhook_key())


def test_notice_without_signature() -> None:
    header = jwt.utils.base64url_encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    payload = jwt.utils.base64url_encode(json.dumps(_claims()).encode())
    with pytest.raises(InvalidNotice):
        read_notice(header + b"." + payload + b".", webhook_key())


def test_notice_signed_with_hs256() -> None:
    """The public key used as an HMAC secret must not pass for a signature of Tochka."""
    secret = tochka.WEBHOOK_KEY_FILE.read_bytes()
    header = jwt.utils.base64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = jwt.utils.base64url_encode(json.dumps(_claims()).encode())
    signature = jwt.utils.base64url_encode(hmac.digest(secret, header + b"." + payload, "sha256"))
    with pytest.raises(InvalidNotice):
        read_notice(header + b"." + payload + b"." + signature, webhook_key())


@pytest.mark.parametrize("body", [b"", b"not a token", "токен".encode()])
def test_notice_that_is_not_a_token(body: bytes) -> None:
    with pytest.raises(InvalidNotice):
        read_notice(body, webhook_key())


@pytest.mark.parametrize(("field", "value"), [("webhookType", "incomingPayment"), ("operationId", None)])
def test_notice_outside_the_schema(field: str, value: Any) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = _claims()
    if value is None:
        del claims[field]
    else:
        claims[field] = value
    with pytest.raises(InvalidNotice, match=field):
        read_notice(jwt.encode(claims, key, algorithm="RS256").encode(), key.public_key())


def test_notice_keeps_no_card_data() -> None:
    notice = read_notice(DOC_NOTICE, webhook_key())
    shown = repr(notice)
    assert "4080" not in shown and "MIR" not in shown and "tokenCardId" not in shown


def test_main_checks_tochka_at_startup() -> None:
    """The API stops at startup without the settings of Tochka, with a plan for sale that does not fit, or without
    the key of the notices (openspec/specs/integrations, «Обязательные настройки Точки»)."""
    import ast

    main = ast.parse((Path(__file__).resolve().parents[1] / "app" / "main.py").read_text())
    called = {
        ast.unparse(node.value) for node in main.body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
    }
    assert {"connect(tochka_settings()).close()", "check_plans()", "webhook_key()"} <= called

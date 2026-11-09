"""POST /api/v1/beta-requests without a token (openspec/specs/api/beta-requests, auth «Маршруты без токена»)."""

import json
from collections.abc import Iterator
from typing import Any

import pytest
from agno.os.middleware.jwt import JWTMiddleware
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select, text, update

from app.api import attach_api
from app.auth.authorization import AGNO_DEFAULT_EXCLUDED_ROUTES, EXCLUDED_ROUTES
from core.beta_requests import WINDOW_LIMIT
from core.tables import beta_requests
from tests.routes import PROBLEM

URL = "/api/v1/beta-requests"
DOMAIN = "beta-route.test"


def _body(**changes: Any) -> dict[str, Any]:
    return {"email": f"anna@{DOMAIN}", "name": "Анна", "role": "screenwriter", "consent": True, **changes}


def _stored(engine: Engine) -> list[Any]:
    with engine.connect() as connection:
        return list(connection.execute(select(beta_requests).where(beta_requests.c.email.like(f"%@{DOMAIN}"))).all())


@pytest.fixture
def clean(engine: Engine) -> Iterator[None]:
    """The route commits: requests of this test go afterwards; other rows of the window are not touched."""
    yield
    with engine.begin() as connection:
        connection.execute(delete(beta_requests).where(beta_requests.c.email.like(f"%@{DOMAIN}")))


@pytest.mark.usefixtures("clean")
def test_new_request(client: TestClient, engine: Engine) -> None:
    response = client.post(URL, json=_body(email=f" Anna@{DOMAIN.upper()} "))
    assert response.status_code == 202, response.text
    assert response.json() == {"status": "accepted"}
    assert [(row.email, row.name, row.role) for row in _stored(engine)] == [(f"anna@{DOMAIN}", "Анна", "screenwriter")]


@pytest.mark.usefixtures("clean")
def test_repeat_gets_the_same_answer(client: TestClient, engine: Engine) -> None:
    first = client.post(URL, json=_body())
    again = client.post(URL, json=_body(email=f"ANNA@{DOMAIN}", name="Другая"))
    assert (first.status_code, again.status_code) == (202, 202)
    assert first.json() == again.json()
    assert [row.name for row in _stored(engine)] == ["Анна"]


@pytest.mark.usefixtures("clean")
def test_trap_field_stores_nothing(client: TestClient, engine: Engine) -> None:
    response = client.post(URL, json=_body(website="http://spam.example"))
    assert response.status_code == 202
    assert _stored(engine) == []


@pytest.mark.parametrize(
    ("body", "field"),
    [
        (_body(consent=False), "consent"),
        (_body(consent="yes"), "consent"),
        (_body(phone="+7"), "phone"),
        (_body(role="producer"), "role"),
        (_body(email="anna"), "email"),
        (_body(name="  "), "name"),
        ({"email": f"anna@{DOMAIN}", "name": "Анна", "role": "writer"}, "consent"),
        (_body(name=5), "name"),
    ],
)
@pytest.mark.usefixtures("clean")
def test_refusals_name_the_field(client: TestClient, engine: Engine, body: dict[str, Any], field: str) -> None:
    response = client.post(URL, json=body)
    assert response.status_code == 422, response.text
    assert response.headers["content-type"] == PROBLEM
    assert f"«{field}»" in response.json()["detail"]
    assert _stored(engine) == []


def test_body_must_be_a_json_object(client: TestClient) -> None:
    assert client.post(URL, content=b"not json", headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post(URL, json=["anna"]).status_code == 422


@pytest.mark.usefixtures("clean")
def test_large_body(client: TestClient, engine: Engine) -> None:
    response = client.post(URL, json=_body(name="я" * 3000))
    assert response.status_code == 413
    assert response.headers["content-type"] == PROBLEM
    assert _stored(engine) == []


@pytest.mark.usefixtures("clean")
def test_window_answers_429_with_retry_after(client: TestClient, engine: Engine) -> None:
    with engine.connect() as connection:
        recent = connection.execute(
            text("SELECT count(*) FROM authorled.beta_requests WHERE created_at > clock_timestamp() - interval '60 s'")
        ).scalar_one()
    assert recent == 0, "rows of another run are in the window"
    for number in range(WINDOW_LIMIT):
        assert client.post(URL, json=_body(email=f"author{number}@{DOMAIN}")).status_code == 202
    response = client.post(URL, json=_body(email=f"late@{DOMAIN}"))
    assert response.status_code == 429, response.text
    assert 1 <= int(response.headers["Retry-After"]) <= 60
    assert response.headers["content-type"] == PROBLEM
    assert len(_stored(engine)) == WINDOW_LIMIT
    with engine.begin() as connection:
        connection.execute(update(beta_requests).values(created_at=text("clock_timestamp() - interval '61 s'")))


def test_no_reading_route(client: TestClient, authors: Any) -> None:
    assert authors().get(URL).status_code == 405


def test_logs_have_no_email_or_name(client: TestClient, caplog: pytest.LogCaptureFixture, clean: None) -> None:
    with caplog.at_level("INFO", logger="app.api.beta"):
        client.post(URL, json=_body(name="Секретное Имя"))
    assert caplog.records
    assert all(
        DOMAIN not in record.getMessage() and "Секретное" not in record.getMessage() for record in caplog.records
    )


def test_default_excluded_routes_match_the_pinned_agno() -> None:
    middleware = JWTMiddleware(FastAPI(), validate=False)
    assert list(AGNO_DEFAULT_EXCLUDED_ROUTES) == middleware._get_default_excluded_routes()


def _app_with_token_check() -> FastAPI:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key()
    pem = key.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    app = FastAPI()
    attach_api(app)
    app.add_middleware(
        JWTMiddleware,
        verification_keys=[pem],
        algorithm="RS256",
        authorization=True,
        excluded_route_paths=list(EXCLUDED_ROUTES),
    )
    return app


@pytest.mark.usefixtures("clean")
def test_request_needs_no_token_and_neighbours_stay_closed(engine: Engine) -> None:
    client = TestClient(_app_with_token_check())
    response = client.post(URL, json=_body())
    assert response.status_code == 202, response.text
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/projects").status_code == 401


@pytest.mark.usefixtures("clean")
def test_token_does_not_change_the_answer(engine: Engine) -> None:
    client = TestClient(_app_with_token_check())
    response = client.post(URL, json=_body(), headers={"Authorization": "Bearer not-a-token"})
    assert response.status_code == 202
    assert json.loads(response.text) == {"status": "accepted"}

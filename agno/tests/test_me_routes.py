"""Routes GET and PATCH /api/v1/me (openspec/specs/api/me).

The app here carries only the product routes; a test middleware plays the AgentOS token check
and puts the claims of the header X-Test-Claims into request.state.
"""

import json
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, func, select, update

from app.api import attach_api
from core.tables import subscriptions, usage_records, user_settings, users

PROBLEM = "application/problem+json"


def _app(root_mount: bool = False) -> FastAPI:
    app = FastAPI()
    if root_mount:
        # Like the MCP app of AgentOS: mounted at the root before the product routes are added.
        app.mount("/", FastAPI())

    @app.middleware("http")
    async def claims_from_header(request: Request, call_next: Any) -> Any:
        raw = request.headers.get("X-Test-Claims")
        if raw is not None:
            claims = json.loads(raw)
            request.state.authenticated = True
            request.state.claims = claims
            request.state.user_id = claims["sub"]
        return await call_next(request)

    attach_api(app)
    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_app())


@pytest.fixture
def subjects(engine: Engine) -> Iterator[list[str]]:
    """Subjects created by a test; the routes commit, so their rows are removed afterwards."""
    created: list[str] = []
    yield created
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject.in_(created)).scalar_subquery()
        connection.execute(delete(usage_records).where(usage_records.c.user_id.in_(ids)))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id.in_(ids)))
        connection.execute(delete(user_settings).where(user_settings.c.user_id.in_(ids)))
        connection.execute(delete(users).where(users.c.auth_subject.in_(created)))


def _claims(subjects: list[str], **extra: Any) -> dict[str, str]:
    subject = f"test-{uuid.uuid4()}"
    subjects.append(subject)
    claims = {"sub": subject, "groups": ["screenwriters"], "email": "anna@example.com", "name": "Анна Петрова"}
    claims.update(extra)
    return {"X-Test-Claims": json.dumps({k: v for k, v in claims.items() if v is not None})}


def test_first_call_creates_the_account(client: TestClient, subjects: list[str], engine: Engine) -> None:
    headers = _claims(subjects)
    response = client.get("/api/v1/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert (body["email"], body["display_name"], body["settings"]) == (
        "anna@example.com",
        "Анна Петрова",
        {"theme": None},
    )
    uuid.UUID(body["id"])
    with engine.connect() as connection:
        rows = connection.execute(
            select(func.count()).select_from(users).where(users.c.auth_subject == subjects[0])
        ).scalar_one()
    assert rows == 1


def test_repeated_call_returns_the_same_id(client: TestClient, subjects: list[str]) -> None:
    headers = _claims(subjects)
    first = client.get("/api/v1/me", headers=headers).json()
    assert client.get("/api/v1/me", headers=headers).json()["id"] == first["id"]


def test_patch_name_is_trimmed(client: TestClient, subjects: list[str]) -> None:
    headers = _claims(subjects)
    client.get("/api/v1/me", headers=headers)
    response = client.patch("/api/v1/me", headers=headers, json={"display_name": "  Анна П.  "})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Анна П."
    assert client.get("/api/v1/me", headers=headers).json()["display_name"] == "Анна П."


def test_patch_theme_keeps_the_name(client: TestClient, subjects: list[str]) -> None:
    headers = _claims(subjects)
    client.get("/api/v1/me", headers=headers)
    body = client.patch("/api/v1/me", headers=headers, json={"theme": "sepia"}).json()
    assert (body["settings"]["theme"], body["display_name"]) == ("sepia", "Анна Петрова")
    assert client.patch("/api/v1/me", headers=headers, json={"theme": None}).json()["settings"]["theme"] is None


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"display_name": "   "}, "display_name"),
        ({"display_name": None}, "display_name"),
        ({"theme": "blue"}, "theme"),
        ({"email": "other@example.com"}, "email"),
        ({}, None),
    ],
)
def test_patch_rejects_bad_bodies(
    client: TestClient, subjects: list[str], body: dict[str, Any], field: str | None
) -> None:
    headers = _claims(subjects)
    client.get("/api/v1/me", headers=headers)
    response = client.patch("/api/v1/me", headers=headers, json=body)
    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM
    if field is not None:
        assert field in response.json()["detail"]
    me = client.get("/api/v1/me", headers=headers).json()
    assert (me["email"], me["display_name"], me["settings"]["theme"]) == ("anna@example.com", "Анна Петрова", None)


def test_patch_rejects_non_json(client: TestClient, subjects: list[str]) -> None:
    headers = _claims(subjects)
    client.get("/api/v1/me", headers=headers)
    response = client.patch("/api/v1/me", headers={**headers, "Content-Type": "application/json"}, content="{")
    assert (response.status_code, response.headers["content-type"]) == (422, PROBLEM)


@pytest.mark.parametrize("claim", ["email", "name"])
def test_missing_claim_is_403(client: TestClient, subjects: list[str], engine: Engine, claim: str) -> None:
    response = client.get("/api/v1/me", headers=_claims(subjects, **{claim: None}))
    assert (response.status_code, response.headers["content-type"]) == (403, PROBLEM)
    assert claim in response.json()["detail"]
    with engine.connect() as connection:
        assert connection.execute(select(users.c.id).where(users.c.auth_subject == subjects[0])).first() is None


def test_patch_before_get_is_404(client: TestClient, subjects: list[str]) -> None:
    response = client.patch("/api/v1/me", headers=_claims(subjects), json={"theme": "dark"})
    assert (response.status_code, response.headers["content-type"]) == (404, PROBLEM)


def test_deleted_account_is_410(client: TestClient, subjects: list[str], engine: Engine) -> None:
    headers = _claims(subjects)
    client.get("/api/v1/me", headers=headers)
    with engine.begin() as connection:
        connection.execute(update(users).where(users.c.auth_subject == subjects[0]).values(deleted_at=func.now()))
    for response in (
        client.get("/api/v1/me", headers=headers),
        client.patch("/api/v1/me", headers=headers, json={"theme": "dark"}),
    ):
        assert (response.status_code, response.headers["content-type"]) == (410, PROBLEM)
        assert response.headers["cache-control"] == "no-store"
    with engine.connect() as connection:
        rows = connection.execute(select(users.c.deleted_at).where(users.c.auth_subject == subjects[0])).all()
    assert len(rows) == 1 and rows[0].deleted_at is not None


def test_stories_before_the_account_are_404_and_not_cached(client: TestClient, subjects: list[str]) -> None:
    response = client.get("/api/v1/projects", headers=_claims(subjects))
    assert (response.status_code, response.headers["content-type"]) == (404, PROBLEM)
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["detail"] == "Аккаунта ещё нет: сначала вызовите GET /api/v1/me."


def test_without_token_is_401(client: TestClient) -> None:
    assert client.get("/api/v1/me").status_code == 401


def test_only_own_record_changes(client: TestClient, subjects: list[str]) -> None:
    anna = _claims(subjects)
    boris = _claims(subjects, email="boris@example.com", name="Борис")
    client.get("/api/v1/me", headers=anna)
    client.get("/api/v1/me", headers=boris)
    client.patch("/api/v1/me", headers=anna, json={"display_name": "Новое имя"})
    assert client.get("/api/v1/me", headers=boris).json()["display_name"] == "Борис"


def test_openapi_publishes_the_patch_body(client: TestClient) -> None:
    operation = client.get("/openapi.json").json()["paths"]["/api/v1/me"]["patch"]
    schema = operation["requestBody"]["content"]["application/json"]["schema"]
    assert set(schema["properties"]) == {"display_name", "theme"}


def test_routes_come_before_a_root_mount(subjects: list[str]) -> None:
    client = TestClient(_app(root_mount=True))
    assert client.get("/api/v1/me", headers=_claims(subjects)).status_code == 200

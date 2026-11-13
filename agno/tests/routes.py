"""An app with only the product routes for route tests, and authors who call it.

A test middleware plays the AgentOS token check and puts the claims of the header X-Test-Claims into
request.state, as in test_me_routes.py.
"""

import json
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, select

from app.api import attach_api
from billing.tables import subscriptions, usage_records
from core.tables import coauthor_feedback, projects, user_settings, users

PROBLEM = "application/problem+json"


def product_app() -> FastAPI:
    app = FastAPI()

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


class Author:
    """A signed-in author: every request carries their claims."""

    def __init__(self, client: TestClient, subject: str, groups: list[str], name: str = "Анна Петрова") -> None:
        self.client = client
        self.subject = subject
        self.email = f"{subject}@example.com"
        claims = {"sub": subject, "groups": groups, "email": self.email, "name": name}
        self.headers = {"X-Test-Claims": json.dumps(claims)}

    def request(self, method: str, url: str, **kwargs: Any) -> Any:
        headers = {**self.headers, **kwargs.pop("headers", {})}
        return self.client.request(method, url, headers=headers, **kwargs)

    def get(self, url: str, **kwargs: Any) -> Any:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> Any:
        return self.request("POST", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> Any:
        return self.request("PATCH", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> Any:
        return self.request("PUT", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> Any:
        return self.request("DELETE", url, **kwargs)

    def story(self, title: str = "Маяк") -> dict[str, Any]:
        response = self.post("/api/v1/projects", json={"title": title})
        assert response.status_code == 201, response.text
        created: dict[str, Any] = response.json()
        return created


@pytest.fixture
def client() -> TestClient:
    return TestClient(product_app())


@pytest.fixture
def authors(client: TestClient, engine: Engine) -> Iterator[Any]:
    """Make authors with accounts (GET /api/v1/me); the routes commit, so their rows go afterwards."""
    made: list[str] = []

    def make(groups: list[str] | None = None, account: bool = True, name: str = "Анна Петрова") -> Author:
        subject = f"test-{uuid.uuid4()}"
        made.append(subject)
        author = Author(client, subject, groups if groups is not None else ["screenwriters"], name)
        if account:
            assert author.get("/api/v1/me").status_code == 200
        return author

    yield make
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject.in_(made)).scalar_subquery()
        connection.execute(delete(projects).where(projects.c.owner_id.in_(ids)))
        connection.execute(delete(coauthor_feedback).where(coauthor_feedback.c.user_id.in_(ids)))
        connection.execute(delete(usage_records).where(usage_records.c.user_id.in_(ids)))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id.in_(ids)))
        connection.execute(delete(user_settings).where(user_settings.c.user_id.in_(ids)))
        connection.execute(delete(users).where(users.c.auth_subject.in_(made)))

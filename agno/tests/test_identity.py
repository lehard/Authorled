"""E-mail and name from the token (openspec/specs/auth, «Почта и имя из токена»)."""

from typing import Any

import pytest
from fastapi import HTTPException, Request

from app.auth import Identity, MissingIdentityClaim, current_identity


def _request(claims: dict[str, Any] | None, authenticated: bool = True) -> Request:
    return Request({"type": "http", "state": {"authenticated": authenticated, "claims": claims}})


def test_email_and_name() -> None:
    claims = {"sub": "s1", "email": "anna@example.com", "name": "Анна Петрова"}
    assert current_identity(_request(claims)) == Identity(email="anna@example.com", name="Анна Петрова")


@pytest.mark.parametrize(("claims", "missing"), [({"name": "Анна"}, "email"), ({"email": "a@example.com"}, "name")])
def test_missing_claim(claims: dict[str, Any], missing: str) -> None:
    with pytest.raises(MissingIdentityClaim) as error:
        current_identity(_request(claims))
    assert error.value.claim == missing


def test_empty_claim() -> None:
    with pytest.raises(MissingIdentityClaim) as error:
        current_identity(_request({"email": "a@example.com", "name": "  "}))
    assert error.value.claim == "name"


def test_no_verified_token() -> None:
    with pytest.raises(HTTPException) as error:
        current_identity(_request(None, authenticated=False))
    assert error.value.status_code == 401

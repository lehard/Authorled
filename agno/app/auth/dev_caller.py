"""The verified development user for code that runs agents in process (openspec/specs/auth,
«Полномочия запуска для доверенного кода»).

Agno binds the caller of an HTTP request to the runs it starts; a run started in process (the eval of the co-author)
has none, and the co-author refuses it. `dev_writer_caller` gives such code the caller `writer@authorled.test` of the
local stand: it takes a token of `writer` from the local Authentik with its app password, checks the token the way
the API checks a Bearer token and returns the authority Agno binds to the runs inside `authorization_scope`.
Local stand only: outside RUNTIME_ENV=dev it refuses before any request. Errors name what failed and never carry
the app password or the token.
"""

import json
from dataclasses import dataclass
from os import environ
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import jwt
from agno.os.authz.run_context import restore_authorization
from agno.os.middleware.jwt import JWTValidator, is_reserved_principal
from agno.run.authorization import RunAuthorization

from app.auth.principal import Identity

WRITER = "writer"
_TOKEN_TIMEOUT_SECONDS = 30


class DevCallerError(RuntimeError):
    """The development user could not be verified; the message names the reason."""


@dataclass(frozen=True)
class DevCaller:
    """The verified development user: the authority for agent runs, the token subject, its e-mail and name."""

    authorization: RunAuthorization
    subject: str
    identity: Identity


def _required(name: str) -> str:
    value = environ.get(name)
    if not value or value == "***":
        raise DevCallerError(f"Required environment variable {name} is not set")
    return value


def _text_claim(payload: dict[str, Any], claim: str) -> str:
    value = payload.get(claim)
    if not isinstance(value, str) or not value.strip():
        raise DevCallerError(f"The token of {WRITER} has no {claim} claim")
    return value.strip()


def verified_caller(app: Any, token: str) -> DevCaller:
    """Check the token like the API does (JWT_JWKS_FILE, RS256, AUTH_ISSUER, audience AUTH_FRONTEND_CLIENT_ID) and
    return its caller with the authority provider of `app`, without enforcing tool permissions, as a request does."""
    validator = JWTValidator(jwks_file=_required("JWT_JWKS_FILE"), algorithm="RS256", issuer=_required("AUTH_ISSUER"))
    try:
        payload = validator.validate_token(token, expected_audience=_required("AUTH_FRONTEND_CLIENT_ID"))
    except jwt.PyJWTError as error:
        raise DevCallerError(f"The token of {WRITER} failed verification: {type(error).__name__}: {error}") from error
    subject = _text_claim(payload, "sub")
    if is_reserved_principal(subject):
        raise DevCallerError(f"The token of {WRITER} claims a reserved subject")
    groups = payload.get("groups")
    if not isinstance(groups, list) or not all(isinstance(group, str) for group in groups):
        raise DevCallerError(f"The token of {WRITER} has no valid groups claim")
    scopes = payload.get("scopes", [])
    if isinstance(scopes, str):
        scopes = [scopes]
    elif not isinstance(scopes, list):
        scopes = []
    identity = Identity(email=_text_claim(payload, "email"), name=_text_claim(payload, "name"))
    authority = restore_authorization(
        app,
        {
            "context": {"principal_id": subject, "scopes": scopes, "claims": payload},
            "service_account": False,
            "enforce_tools": False,
        },
    )
    if not isinstance(authority, RunAuthorization):
        raise DevCallerError(f"Agno returned no run authority for {WRITER}")
    return DevCaller(authorization=authority, subject=subject, identity=identity)


def _writer_token() -> str:
    issuer = _required("AUTH_ISSUER")
    authentik_url, separator, _ = issuer.partition("/application/o/")
    if not separator:
        raise DevCallerError(f"AUTH_ISSUER must contain /application/o/<slug>/, got {issuer!r}")
    url = f"{authentik_url}/application/o/token/"
    body = urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": _required("AUTH_FRONTEND_CLIENT_ID"),
            "scope": "openid profile email",
            "username": WRITER,
            "password": _required("AUTH_DEV_WRITER_TOKEN"),
        }
    ).encode()
    request = Request(url, data=body, method="POST")
    try:
        with urlopen(request, timeout=_TOKEN_TIMEOUT_SECONDS) as response:
            answer = json.load(response)
    except HTTPError as error:
        try:
            reason = json.load(error).get("error")
        except ValueError:
            reason = None
        raise DevCallerError(
            f"Authentik at {url} refused a token for {WRITER}: HTTP {error.code}, error {reason!r}; "
            "check AUTH_DEV_WRITER_TOKEN and run ./scripts/dev.sh auth-users"
        ) from None
    except (URLError, TimeoutError) as error:
        raise DevCallerError(f"Cannot reach Authentik at {url}: {error}") from None
    token = answer.get("access_token") if isinstance(answer, dict) else None
    if not isinstance(token, str) or not token:
        raise DevCallerError(f"Authentik at {url} answered without an access_token")
    return token


def dev_writer_caller(app: Any) -> DevCaller:
    """The verified `writer@authorled.test` of the local stand; refuses outside RUNTIME_ENV=dev before any request."""
    runtime_env = environ.get("RUNTIME_ENV")
    if runtime_env != "dev":
        raise DevCallerError(f"The development user exists on the local stand only; RUNTIME_ENV is {runtime_env!r}")
    return verified_caller(app, _writer_token())

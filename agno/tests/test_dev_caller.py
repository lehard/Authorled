"""The verified development user for in-process agent runs (openspec/specs/auth, «Полномочия запуска для доверенного
кода»). Tokens are signed with a key generated here and published in a JWKS file, like the keys of Authentik."""

import io
import json
import time
from email.message import Message
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError

import jwt
import pytest
from agno.run import RunContext
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from jwt.algorithms import RSAAlgorithm

from app.auth import DevCallerError, Identity, dev_writer_caller, run_principal, verified_caller
from app.auth import dev_caller as module

ISSUER = "http://localhost:9000/application/o/authorled/"
AUDIENCE = "authorled-web"
SECRET = "app-password-never-printed"


def _key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


KEY = _key()
OTHER_KEY = _key()


def _claims(**changes: Any) -> dict[str, Any]:
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": "writer-subject",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + 600,
        "groups": ["screenwriters"],
        "email": "writer@authorled.test",
        "name": "Сценарист",
    }
    claims.update(changes)
    return {name: value for name, value in claims.items() if value is not None}


def _token(claims: dict[str, Any], key: rsa.RSAPrivateKey = KEY) -> str:
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


@pytest.fixture(autouse=True)
def environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    jwk = json.loads(RSAAlgorithm.to_jwk(KEY.public_key()))
    jwks = tmp_path / "jwks.json"
    jwks.write_text(json.dumps({"keys": [{**jwk, "kid": "test-key", "use": "sig", "alg": "RS256"}]}))
    monkeypatch.setenv("JWT_JWKS_FILE", str(jwks))
    monkeypatch.setenv("AUTH_ISSUER", ISSUER)
    monkeypatch.setenv("AUTH_FRONTEND_CLIENT_ID", AUDIENCE)
    monkeypatch.setenv("AUTH_DEV_WRITER_TOKEN", SECRET)
    monkeypatch.setenv("RUNTIME_ENV", "dev")


class _Answer(io.BytesIO):
    def __enter__(self) -> _Answer:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


def _no_network(*args: object, **kwargs: object) -> None:
    raise AssertionError("Authentik must not be called")


def test_verified_token_gives_the_run_its_caller() -> None:
    caller = verified_caller(FastAPI(), _token(_claims()))
    assert caller.subject == "writer-subject"
    assert caller.identity == Identity(email="writer@authorled.test", name="Сценарист")
    principal = run_principal(RunContext(run_id="r1", session_id="s1", authorization=caller.authorization))
    assert principal.user_id == "writer-subject"
    assert principal.groups == ("screenwriters",)
    assert "agents:coauthor:run" in principal.scopes
    assert caller.authorization.enforce_tools is False


@pytest.mark.parametrize(
    ("token", "reason"),
    [
        (_token(_claims(), OTHER_KEY), "failed verification"),
        (_token(_claims(iss="http://127.0.0.1:9000/application/o/authorled/")), "InvalidIssuerError"),
        (_token(_claims(aud="another-app")), "InvalidAudienceError"),
        (_token(_claims(iat=int(time.time()) - 1200, exp=int(time.time()) - 600)), "ExpiredSignatureError"),
        (_token(_claims(groups=None)), "no valid groups claim"),
        (_token(_claims(email=None)), "no email claim"),
        (_token(_claims(name="  ")), "no name claim"),
        (_token(_claims(scopes={"agents": "run"})), "invalid scopes claim"),
    ],
    ids=["signature", "issuer", "audience", "expired", "groups", "email", "name", "scopes"],
)
def test_token_that_fails_is_refused(token: str, reason: str) -> None:
    with pytest.raises(DevCallerError, match=reason):
        verified_caller(FastAPI(), token)


def test_full_path_with_the_token_of_authentik(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: dict[str, Any] = {}
    token = _token(_claims())

    def answer(request: Any, timeout: float) -> _Answer:
        sent.update(url=request.full_url, body=request.data.decode(), timeout=timeout)
        return _Answer(json.dumps({"access_token": token}).encode())

    monkeypatch.setattr(module, "urlopen", answer)
    caller = dev_writer_caller(FastAPI())
    assert caller.subject == "writer-subject"
    assert sent["url"] == "http://localhost:9000/application/o/token/"
    assert "username=writer" in sent["body"] and "grant_type=client_credentials" in sent["body"]


@pytest.mark.parametrize("runtime_env", ["prd", None])
def test_outside_the_local_stand_no_request(monkeypatch: pytest.MonkeyPatch, runtime_env: str | None) -> None:
    if runtime_env is None:
        monkeypatch.delenv("RUNTIME_ENV")
    else:
        monkeypatch.setenv("RUNTIME_ENV", runtime_env)
    monkeypatch.setattr(module, "urlopen", _no_network)
    with pytest.raises(DevCallerError, match="local stand only"):
        dev_writer_caller(FastAPI())


@pytest.mark.parametrize("value", [None, "", "***"])
def test_without_the_app_password_no_request(monkeypatch: pytest.MonkeyPatch, value: str | None) -> None:
    if value is None:
        monkeypatch.delenv("AUTH_DEV_WRITER_TOKEN")
    else:
        monkeypatch.setenv("AUTH_DEV_WRITER_TOKEN", value)
    monkeypatch.setattr(module, "urlopen", _no_network)
    with pytest.raises(DevCallerError, match="AUTH_DEV_WRITER_TOKEN"):
        dev_writer_caller(FastAPI())


def test_refusal_of_authentik_names_it_without_the_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(request: Any, timeout: float) -> None:
        body = io.BytesIO(b'{"error": "invalid_grant"}')
        raise HTTPError(request.full_url, 400, "Bad Request", Message(), body)

    monkeypatch.setattr(module, "urlopen", refuse)
    with pytest.raises(DevCallerError) as error:
        dev_writer_caller(FastAPI())
    text = str(error.value)
    assert "HTTP 400" in text and "invalid_grant" in text
    assert SECRET not in text
    assert error.value.__suppress_context__


def test_refusal_with_a_body_that_is_not_json(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(request: Any, timeout: float) -> None:
        raise HTTPError(request.full_url, 502, "Bad Gateway", Message(), io.BytesIO(b"<html>proxy</html>"))

    monkeypatch.setattr(module, "urlopen", refuse)
    with pytest.raises(DevCallerError, match="HTTP 502, a body that is not JSON"):
        dev_writer_caller(FastAPI())


def test_unreachable_authentik_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    def unreachable(request: Any, timeout: float) -> None:
        raise URLError(ConnectionRefusedError(61, "Connection refused"))

    monkeypatch.setattr(module, "urlopen", unreachable)
    with pytest.raises(DevCallerError, match="Cannot reach Authentik at http://localhost:9000/application/o/token/"):
        dev_writer_caller(FastAPI())

"""Requests for the closed beta from the product site: POST /api/v1/beta-requests (openspec/specs/api/beta-requests).

The route works without a token (app/auth/authorization.py excludes exactly this path). A new and a repeated e-mail
get the same answer, so the route does not tell who has asked. The e-mail and the name never reach the logs.
"""

import logging
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict
from starlette.concurrency import run_in_threadpool

from app.api.body import read_small_object
from app.api.problems import Problem
from core.beta_requests import TooManyRequests, submit
from core.engine import get_engine
from core.tables import BETA_REQUEST_ROLES

router = APIRouter(prefix="/api/v1", tags=["Beta"])
log = logging.getLogger(__name__)

MAX_BODY_BYTES = 4096
_REQUIRED = ("email", "name", "role", "consent")
_ALLOWED = {*_REQUIRED, "website"}


class BetaRequestIn(BaseModel):
    """Body of the request; `website` is a trap field that a person never sees."""

    model_config = ConfigDict(extra="forbid")

    email: str
    name: str
    role: Literal["screenwriter", "writer", "other"]
    consent: Literal[True]
    website: str | None = None


class Accepted(BaseModel):
    status: Literal["accepted"]


def _invalid(detail: str) -> Problem:
    return Problem(422, "Unprocessable Content", detail)


def _checked(body: dict[str, Any]) -> tuple[str, str, str, str]:
    """email, name, role and the trap field of a body; refuses unknown, missing and mistyped fields."""
    unknown = sorted(set(body) - _ALLOWED)
    if unknown:
        raise _invalid(f"Поле «{unknown[0]}» не принимается.")
    missing = [field for field in _REQUIRED if field not in body]
    if missing:
        raise _invalid(f"Поле «{missing[0]}» обязательно.")
    for field in ("email", "name", "role"):
        if not isinstance(body[field], str):
            raise _invalid(f"Поле «{field}» должно быть строкой.")
    if body["role"] not in BETA_REQUEST_ROLES:
        raise _invalid(f"Поле «role»: одно из {', '.join(BETA_REQUEST_ROLES)}.")
    if body["consent"] is not True:
        raise _invalid("Поле «consent»: нужно согласие на обработку персональных данных.")
    trap = body.get("website")
    if trap is not None and not isinstance(trap, str):
        raise _invalid("Поле «website» должно быть строкой.")
    return body["email"], body["name"], body["role"], trap or ""


def _store(email: str, name: str, role: str) -> None:
    try:
        with get_engine().begin() as connection:
            stored = submit(connection, email, name, role, datetime.now(UTC))
    except TooManyRequests as error:
        log.info("beta request refused: window is full")
        raise Problem(429, "Too Many Requests", str(error), {"Retry-After": str(error.retry_after)}) from error
    log.info("beta request %s", stored if stored is not None else "repeated")


# The body is read and checked here, not by FastAPI (see app/api/body.py); the schema is still published in OpenAPI.
@router.post(
    "/beta-requests",
    status_code=202,
    response_model=Accepted,
    summary="Ask for the closed beta (no token)",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": BetaRequestIn.model_json_schema()}},
        }
    },
)
async def post_beta_request(request: Request) -> Accepted:
    email, name, role, trap = _checked(await read_small_object(request, MAX_BODY_BYTES))
    if trap.strip():
        log.info("beta request dropped: the trap field is filled")
        return Accepted(status="accepted")
    await run_in_threadpool(_store, email, name, role)
    return Accepted(status="accepted")

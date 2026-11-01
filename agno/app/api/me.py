"""The user's own account: GET and PATCH /api/v1/me (openspec/specs/api/me)."""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

from app.api.problems import Problem
from app.auth import Identity, Principal, current_identity, current_principal
from core.engine import get_engine
from core.users import UNSET, Account, AccountDeleted, AccountNotFound, Theme, get_or_create_user, update_account

router = APIRouter(prefix="/api/v1", tags=["Account"])


class Settings(BaseModel):
    theme: Theme | None


class Me(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    settings: Settings


class MeChanges(BaseModel):
    """Body of PATCH: at least one field; a theme of null follows the system setting."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    theme: Theme | None = None

    @field_validator("display_name")
    @classmethod
    def _name_not_empty(cls, value: str | None) -> str:
        if value is None or not value.strip():
            raise ValueError("Имя не может быть пустым.")
        return value.strip()

    @model_validator(mode="after")
    def _something_to_change(self) -> MeChanges:
        if not self.model_fields_set:
            raise ValueError("Передайте display_name или theme.")
        return self


def _me(account: Account) -> Me:
    return Me(
        id=account.id,
        email=account.email,
        display_name=account.display_name,
        settings=Settings(theme=account.theme),
    )


_GONE = Problem(410, "Gone", "Аккаунт удалён.")


def _get_or_create(principal: Principal, identity: Identity) -> Account:
    try:
        with get_engine().begin() as connection:
            return get_or_create_user(connection, principal.user_id, identity.email, identity.name)
    except AccountDeleted as error:
        raise _GONE from error


def _update(principal: Principal, changes: MeChanges) -> Account:
    fields = changes.model_fields_set
    try:
        with get_engine().begin() as connection:
            return update_account(
                connection,
                principal.user_id,
                display_name=changes.display_name if "display_name" in fields and changes.display_name else UNSET,
                theme=changes.theme if "theme" in fields else UNSET,
            )
    except AccountDeleted as error:
        raise _GONE from error
    except AccountNotFound as error:
        raise Problem(404, "Not Found", "Аккаунта ещё нет: сначала вызовите GET /api/v1/me.") from error


def _invalid(error: ValidationError) -> Problem:
    first = error.errors()[0]
    field = ".".join(str(part) for part in first["loc"])
    if first["type"] == "extra_forbidden":
        return Problem(422, "Unprocessable Content", f"Поле «{field}» нельзя менять здесь.")
    reason = str(first["msg"]).removeprefix("Value error, ")
    return Problem(422, "Unprocessable Content", f"Поле «{field}»: {reason}" if field else reason)


@router.get("/me", response_model=Me, summary="The caller's account and settings")
def get_me(
    principal: Principal = Depends(current_principal),
    identity: Identity = Depends(current_identity),
) -> Me:
    return _me(_get_or_create(principal, identity))


# The body is read and validated here, not by FastAPI: its validation errors go through Agno's
# app-wide handler, which does not answer problem+json. The schema is still published in OpenAPI.
@router.patch(
    "/me",
    response_model=Me,
    summary="Change the caller's name or theme",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": MeChanges.model_json_schema()}},
        }
    },
)
async def patch_me(request: Request, principal: Principal = Depends(current_principal)) -> Me:
    try:
        body: Any = await request.json()
    except json.JSONDecodeError as error:
        raise Problem(422, "Unprocessable Content", "Тело запроса — не JSON.") from error
    if not isinstance(body, dict):
        raise Problem(422, "Unprocessable Content", "Тело запроса должно быть объектом JSON.")
    try:
        changes = MeChanges.model_validate(body)
    except ValidationError as error:
        raise _invalid(error) from error
    return _me(await run_in_threadpool(_update, principal, changes))

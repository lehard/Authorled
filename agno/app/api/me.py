"""The user's own account: GET and PATCH /api/v1/me (openspec/specs/api/me)."""

import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

from app.api.body import read_object
from app.api.problems import Problem
from app.auth import Identity, Principal, current_identity, current_principal
from core.engine import get_engine
from core.users import (
    UNSET,
    Account,
    AccountDeleted,
    AccountNotFound,
    CoauthorMode,
    Theme,
    get_or_create_user,
    update_account,
)

router = APIRouter(prefix="/api/v1", tags=["Account"])


class Settings(BaseModel):
    theme: Theme | None
    coauthor_mode: CoauthorMode


class Me(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    settings: Settings


class MeChanges(BaseModel):
    """Body of PATCH: at least one field; a theme of null follows the system setting, a mode has no null."""

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = None
    theme: Theme | None = None
    # None only marks "not passed": a null in the body is refused by the validator below.
    coauthor_mode: CoauthorMode | None = None

    @field_validator("coauthor_mode")
    @classmethod
    def _mode_not_null(cls, value: CoauthorMode | None) -> CoauthorMode:
        if value is None:
            raise ValueError("Режим соавтора должен быть ask или auto.")
        return value

    @field_validator("display_name")
    @classmethod
    def _name_not_empty(cls, value: str | None) -> str:
        if value is None or not value.strip():
            raise ValueError("Имя не может быть пустым.")
        return value.strip()

    @model_validator(mode="after")
    def _something_to_change(self) -> MeChanges:
        if not self.model_fields_set:
            raise ValueError("Передайте display_name, theme или coauthor_mode.")
        return self


def _me(account: Account) -> Me:
    return Me(
        id=account.id,
        email=account.email,
        display_name=account.display_name,
        settings=Settings(theme=account.theme, coauthor_mode=account.coauthor_mode),
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
                coauthor_mode=changes.coauthor_mode if "coauthor_mode" in fields and changes.coauthor_mode else UNSET,
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
    summary="Change the caller's name, theme or co-author mode",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": MeChanges.model_json_schema()}},
        }
    },
)
async def patch_me(request: Request, principal: Principal = Depends(current_principal)) -> Me:
    body = await read_object(request)
    try:
        changes = MeChanges.model_validate(body)
    except ValidationError as error:
        raise _invalid(error) from error
    return _me(await run_in_threadpool(_update, principal, changes))

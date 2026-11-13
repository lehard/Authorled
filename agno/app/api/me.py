"""The user's own account: GET and PATCH /api/v1/me (openspec/specs/api/me)."""

import uuid
from typing import cast

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator, model_validator
from starlette.concurrency import run_in_threadpool

import billing
from app.api.body import read_object
from app.api.problems import Problem
from app.auth import Identity, Principal, current_identity, current_principal
from core import members
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
from core.writing import GOAL_RULE, is_goal

router = APIRouter(prefix="/api/v1", tags=["Account"])


class Settings(BaseModel):
    theme: Theme | None
    coauthor_mode: CoauthorMode
    daily_word_goal: int | None


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
    # Words a day for all stories of the author; null takes the goal away.
    daily_word_goal: int | None = None

    @field_validator("daily_word_goal", mode="before")
    @classmethod
    def _goal_in_range(cls, value: object) -> int | None:
        if value is None:
            return None
        if not is_goal(value):
            raise ValueError(f"Цель должна быть {GOAL_RULE}.")
        return cast(int, value)

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
            raise ValueError("Передайте display_name, theme, coauthor_mode или daily_word_goal.")
        return self


def _me(account: Account) -> Me:
    return Me(
        id=account.id,
        email=account.email,
        display_name=account.display_name,
        settings=Settings(
            theme=account.theme, coauthor_mode=account.coauthor_mode, daily_word_goal=account.daily_word_goal
        ),
    )


_GONE = Problem(410, "Gone", "Аккаунт удалён.")


def _get_or_create(principal: Principal, identity: Identity) -> Account:
    """The account of the token with the invitations to its e-mail accepted, then its subscription from billing in a
    transaction of its own.

    A failed grant is not caught: the call answers 500, the account stays, and the next call grants it
    (openspec/specs/billing/subscriptions, «Подписка при входе»).
    """
    try:
        with get_engine().begin() as connection:
            account = get_or_create_user(connection, principal.user_id, identity.email, identity.name)
            # Invitations to the account's e-mail become participation (openspec/specs/api/story-sharing).
            members.accept_invitations(connection, account.id)
    except AccountDeleted as error:
        raise _GONE from error
    billing.ensure_subscription(account.id, account.created_at)
    return account


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
                daily_word_goal=changes.daily_word_goal if "daily_word_goal" in fields else UNSET,
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
    summary="Change the caller's name, theme, co-author mode or daily word goal",
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

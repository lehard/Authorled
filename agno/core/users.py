"""Users of the product and their settings (openspec/specs/core/database, «Запись пользователя по входу»)."""

import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Final, Literal

from sqlalchemy import Connection, func, select, update
from sqlalchemy.dialects.postgresql import insert

from core.plans import plans
from core.subscriptions import start_subscription
from core.tables import user_settings, users

Theme = Literal["light", "sepia", "dark"]
# Mode of the co-author (business-intents/coauthor-actions.md): `ask` waits for the author before each change.
CoauthorMode = Literal["ask", "auto"]


class _Unset(Enum):
    UNSET = "unset"


# "Not passed", as opposed to None, which is the theme "as the system".
UNSET: Final = _Unset.UNSET


@dataclass(frozen=True)
class Account:
    id: uuid.UUID
    email: str
    display_name: str
    theme: Theme | None
    coauthor_mode: CoauthorMode


class AccountDeleted(Exception):
    """The account was deleted softly; it is neither shown nor recreated."""


class AccountNotFound(Exception):
    """There is no account for this subject yet: GET /api/v1/me creates it."""


def _account(connection: Connection, subject: str) -> Account:
    row = connection.execute(
        select(
            users.c.id,
            users.c.email,
            users.c.display_name,
            users.c.deleted_at,
            user_settings.c.theme,
            user_settings.c.coauthor_mode,
        )
        .join(user_settings, user_settings.c.user_id == users.c.id)
        .where(users.c.auth_subject == subject)
    ).one_or_none()
    if row is None:
        raise AccountNotFound(f"No account for subject {subject!r}")
    if row.deleted_at is not None:
        raise AccountDeleted(f"Account {row.id} is deleted")
    return Account(
        id=row.id, email=row.email, display_name=row.display_name, theme=row.theme, coauthor_mode=row.coauthor_mode
    )


def active_user_id(connection: Connection, subject: str) -> uuid.UUID:
    """The id of the account of the token subject; a missing or deleted account is an error."""
    row = connection.execute(
        select(users.c.id, users.c.deleted_at).where(users.c.auth_subject == subject)
    ).one_or_none()
    if row is None:
        raise AccountNotFound(f"No account for subject {subject!r}")
    if row.deleted_at is not None:
        raise AccountDeleted(f"Account {row.id} is deleted")
    return row.id


def get_or_create_user(connection: Connection, subject: str, email: str, name: str) -> Account:
    """Return the account of the token subject, creating it with its settings on the first call.

    The name of the token is used only on creation; later the user changes it. The e-mail and
    last_seen_at follow every call. Run inside one transaction: concurrent first calls of one
    subject meet at the unique auth_subject and create one row. A new account gets a subscription to the plan of
    new accounts with its period from the creation (openspec/specs/api/me).
    """
    inserted = connection.execute(
        insert(users)
        .values(auth_subject=subject, email=email, display_name=name)
        .on_conflict_do_nothing(index_elements=[users.c.auth_subject])
        .returning(users.c.id, users.c.created_at)
    ).one_or_none()
    if inserted is None:
        row = connection.execute(
            select(users.c.id, users.c.email, users.c.deleted_at)
            .where(users.c.auth_subject == subject)
            .with_for_update()
        ).one()
        if row.deleted_at is not None:
            raise AccountDeleted(f"Account {row.id} is deleted")
        changes: dict[str, object] = {"last_seen_at": func.now()}
        if row.email != email:
            changes.update(email=email, updated_at=func.now())
        connection.execute(update(users).where(users.c.id == row.id).values(**changes))
        user_id = row.id
    else:
        user_id = inserted.id
        start_subscription(connection, user_id, plans().signup.code, "granted", inserted.created_at)
    connection.execute(
        insert(user_settings).values(user_id=user_id).on_conflict_do_nothing(index_elements=[user_settings.c.user_id])
    )
    return _account(connection, subject)


def update_account(
    connection: Connection,
    subject: str,
    display_name: str | _Unset = UNSET,
    theme: Theme | None | _Unset = UNSET,
    coauthor_mode: CoauthorMode | _Unset = UNSET,
) -> Account:
    """Change the name, the theme and/or the co-author mode; fields left UNSET stay as they are."""
    account = _account(connection, subject)
    if display_name is not UNSET:
        connection.execute(
            update(users).where(users.c.id == account.id).values(display_name=display_name, updated_at=func.now())
        )
    if theme is not UNSET:
        connection.execute(
            update(user_settings)
            .where(user_settings.c.user_id == account.id)
            .values(theme=theme, updated_at=func.now())
        )
    if coauthor_mode is not UNSET:
        connection.execute(
            update(user_settings)
            .where(user_settings.c.user_id == account.id)
            .values(coauthor_mode=coauthor_mode, updated_at=func.now())
        )
    return _account(connection, subject)

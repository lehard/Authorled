"""Requests for the closed beta from the product site (openspec/specs/api/beta-requests).

One request per e-mail: a repeat changes nothing. New requests are limited for everyone together, by the rows of
the core and not by the memory of a process: an advisory lock makes the count and the insert one step.
All operations run in the caller's transaction.
"""

import math
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Connection, exists, func, select, text
from sqlalchemy.dialects.postgresql import insert

from core.errors import Invalid
from core.tables import BETA_REQUEST_ROLES, beta_requests, users

WINDOW_SECONDS = 60
WINDOW_LIMIT = 20
# Key of the transaction-level advisory lock that orders new requests.
_LOCK_KEY = 7_405_310_011

MAX_EMAIL = 254
MAX_NAME = 100


class TooManyRequests(Exception):
    """The window of new requests is full; `retry_after` is the number of seconds until a place frees up."""

    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Слишком много заявок. Попробуйте через {retry_after} с.")
        self.retry_after = retry_after


@dataclass(frozen=True)
class BetaRequest:
    id: uuid.UUID
    email: str
    name: str
    role: str
    created_at: datetime
    is_user: bool


def normalize_email(value: str) -> str:
    """The e-mail in lower case without surrounding spaces; refuses what does not look like an address."""
    email = value.strip().lower()
    local, at, domain = email.partition("@")
    if (
        not 3 <= len(email) <= MAX_EMAIL
        or not at
        or "@" in domain
        or not local
        or "." not in domain
        or domain.startswith(".")
        or domain.endswith(".")
        or any(char.isspace() for char in email)
    ):
        raise Invalid("Поле «email»: это не адрес почты.", field="email")
    return email


def normalize_name(value: str) -> str:
    name = value.strip()
    if not 1 <= len(name) <= MAX_NAME:
        raise Invalid(f"Поле «name»: имя от 1 до {MAX_NAME} символов.", field="name")
    return name


def _role(value: str) -> str:
    if value not in BETA_REQUEST_ROLES:
        raise Invalid(f"Поле «role»: одно из {', '.join(BETA_REQUEST_ROLES)}.", field="role")
    return value


def submit(connection: Connection, email: str, name: str, role: str, consent_at: datetime) -> uuid.UUID | None:
    """Store a request; return its id, or None when a request with this e-mail is already there.

    Raises TooManyRequests when WINDOW_LIMIT requests were stored in the last WINDOW_SECONDS; nothing is stored then.
    """
    if consent_at.tzinfo is None:
        raise ValueError("consent_at must carry a time zone")
    values = {"email": normalize_email(email), "name": normalize_name(name), "role": _role(role)}
    connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _LOCK_KEY})
    window = connection.execute(
        select(func.count(), func.min(beta_requests.c.created_at), func.clock_timestamp()).where(
            beta_requests.c.created_at > func.clock_timestamp() - text(f"interval '{WINDOW_SECONDS} seconds'")
        )
    ).one()
    count, oldest, now = window
    if count >= WINDOW_LIMIT:
        left = (oldest - now).total_seconds() + WINDOW_SECONDS
        raise TooManyRequests(max(1, math.ceil(left)))
    stored = connection.execute(
        insert(beta_requests)
        .values(**values, consent_at=consent_at, created_at=func.clock_timestamp())
        .on_conflict_do_nothing(index_elements=[beta_requests.c.email])
        .returning(beta_requests.c.id)
    ).scalar_one_or_none()
    return stored


def list_requests(connection: Connection) -> list[BetaRequest]:
    """All requests, the newest first, each marked when a not deleted user has this e-mail."""
    is_user = exists().where(func.lower(users.c.email) == beta_requests.c.email, users.c.deleted_at.is_(None))
    rows = connection.execute(
        select(beta_requests, is_user.label("is_user")).order_by(beta_requests.c.created_at.desc(), beta_requests.c.id)
    ).all()
    return [
        BetaRequest(
            id=row.id, email=row.email, name=row.name, role=row.role, created_at=row.created_at, is_user=row.is_user
        )
        for row in rows
    ]

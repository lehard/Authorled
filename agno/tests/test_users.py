"""Table authorled.users (openspec/specs/core/database, «Таблица пользователей»)."""

import uuid

import pytest
from sqlalchemy import Connection, insert, inspect, select
from sqlalchemy.exc import IntegrityError

from core.tables import SCHEMA, users

USER = {"auth_subject": "s1", "email": "writer@authorled.test", "display_name": "Сценарист"}


def test_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("users", schema=SCHEMA)]
    assert columns == [
        "id",
        "auth_subject",
        "email",
        "display_name",
        "created_at",
        "updated_at",
        "last_seen_at",
        "deleted_at",
    ]


def test_defaults(connection: Connection) -> None:
    connection.execute(insert(users).values(**USER))
    row = connection.execute(select(users)).one()
    assert isinstance(row.id, uuid.UUID)
    assert row.created_at is not None
    assert row.created_at == row.updated_at == row.last_seen_at
    assert row.deleted_at is None


def test_auth_subject_is_unique(connection: Connection) -> None:
    connection.execute(insert(users).values(**USER))
    with pytest.raises(IntegrityError, match="uq_users_auth_subject"):
        connection.execute(insert(users).values(**{**USER, "email": "editor@authorled.test"}))


@pytest.mark.parametrize("field", ["auth_subject", "email", "display_name"])
def test_required_fields_reject_null(connection: Connection, field: str) -> None:
    with pytest.raises(IntegrityError, match="not-null"):
        connection.execute(insert(users).values(**{**USER, field: None}))


@pytest.mark.parametrize("field", ["auth_subject", "email", "display_name"])
def test_required_fields_reject_empty(connection: Connection, field: str) -> None:
    with pytest.raises(IntegrityError, match=f"ck_users_{field}_not_empty"):
        connection.execute(insert(users).values(**{**USER, field: ""}))

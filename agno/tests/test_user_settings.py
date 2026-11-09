"""Table authorled.user_settings (openspec/specs/core/database, «Таблица профиля»)."""

import uuid

import pytest
from sqlalchemy import Connection, insert, inspect, select, update
from sqlalchemy.exc import IntegrityError

from core.tables import SCHEMA, user_settings, users


def _user(connection: Connection) -> uuid.UUID:
    return connection.execute(
        insert(users)
        .values(auth_subject="s1", email="writer@authorled.test", display_name="Сценарист")
        .returning(users.c.id)
    ).scalar_one()


def test_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("user_settings", schema=SCHEMA)]
    assert columns == ["user_id", "theme", "updated_at", "coauthor_mode", "daily_word_goal"]


def test_defaults(connection: Connection) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    row = connection.execute(select(user_settings)).one()
    assert row.theme is None
    assert row.updated_at is not None
    assert row.coauthor_mode == "ask"
    assert row.daily_word_goal is None


@pytest.mark.parametrize("theme", ["light", "sepia", "dark"])
def test_known_themes(connection: Connection, theme: str) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id, theme=theme))


def test_unknown_theme_is_rejected(connection: Connection) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    with pytest.raises(IntegrityError, match="ck_user_settings_theme_known"):
        connection.execute(update(user_settings).values(theme="blue"))


def test_settings_need_a_user(connection: Connection) -> None:
    with pytest.raises(IntegrityError, match="fk_user_settings_user_id_users"):
        connection.execute(insert(user_settings).values(user_id=uuid.uuid4()))


def test_one_row_per_user(connection: Connection) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    with pytest.raises(IntegrityError, match="pk_user_settings"):
        connection.execute(insert(user_settings).values(user_id=user_id))


def test_user_with_settings_cannot_be_deleted(connection: Connection) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    with pytest.raises(IntegrityError, match="fk_user_settings_user_id_users"):
        connection.execute(users.delete().where(users.c.id == user_id))


@pytest.mark.parametrize("mode", ["ask", "auto"])
def test_known_coauthor_modes(connection: Connection, mode: str) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id, coauthor_mode=mode))


@pytest.mark.parametrize("mode", ["always", None])
def test_unknown_coauthor_mode_is_rejected(connection: Connection, mode: str | None) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    with pytest.raises(IntegrityError, match="ck_user_settings_coauthor_mode_known|coauthor_mode"):
        connection.execute(update(user_settings).values(coauthor_mode=mode))


@pytest.mark.parametrize("goal", [1, 500, 1_000_000])
def test_daily_word_goal_in_range(connection: Connection, goal: int) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id, daily_word_goal=goal))


@pytest.mark.parametrize("goal", [0, -5, 1_000_001])
def test_daily_word_goal_out_of_range_is_rejected(connection: Connection, goal: int) -> None:
    user_id = _user(connection)
    connection.execute(insert(user_settings).values(user_id=user_id))
    with pytest.raises(IntegrityError, match="ck_user_settings_daily_word_goal_range"):
        connection.execute(update(user_settings).values(daily_word_goal=goal))

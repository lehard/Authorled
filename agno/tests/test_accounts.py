"""Operations on users and their settings (openspec/specs/core/database, «Запись пользователя по входу»)."""

import threading
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import Connection, Engine, delete, func, select, update

from core.tables import user_settings, users
from core.users import AccountDeleted, AccountNotFound, get_or_create_user, update_account

EMAIL = "anna@example.com"
NAME = "Анна Петрова"


def _count(connection: Connection, subject: str) -> tuple[int, int]:
    user_rows = connection.execute(
        select(func.count()).select_from(users).where(users.c.auth_subject == subject)
    ).scalar_one()
    settings_rows = connection.execute(
        select(func.count())
        .select_from(user_settings.join(users, user_settings.c.user_id == users.c.id))
        .where(users.c.auth_subject == subject)
    ).scalar_one()
    return user_rows, settings_rows


def test_first_call_creates_user_and_settings(connection: Connection) -> None:
    account = get_or_create_user(connection, "s1", EMAIL, NAME)
    assert (account.email, account.display_name, account.theme) == (EMAIL, NAME, None)
    assert _count(connection, "s1") == (1, 1)


def test_repeated_call_keeps_one_record(connection: Connection) -> None:
    first = get_or_create_user(connection, "s1", EMAIL, NAME)
    second = get_or_create_user(connection, "s1", EMAIL, NAME)
    assert second.id == first.id
    assert _count(connection, "s1") == (1, 1)


def test_repeated_call_touches_last_seen(connection: Connection) -> None:
    get_or_create_user(connection, "s1", EMAIL, NAME)
    connection.execute(update(users).values(last_seen_at=func.now() - func.make_interval(0, 0, 0, 1)))
    before = connection.execute(select(users.c.last_seen_at)).scalar_one()
    get_or_create_user(connection, "s1", EMAIL, NAME)
    assert connection.execute(select(users.c.last_seen_at)).scalar_one() > before


def test_name_of_the_token_does_not_overwrite_a_changed_name(connection: Connection) -> None:
    get_or_create_user(connection, "s1", EMAIL, NAME)
    update_account(connection, "s1", display_name="Анна П.")
    assert get_or_create_user(connection, "s1", EMAIL, NAME).display_name == "Анна П."


def test_email_follows_the_token(connection: Connection) -> None:
    first = get_or_create_user(connection, "s1", "old@example.com", NAME)
    second = get_or_create_user(connection, "s1", "new@example.com", NAME)
    assert (second.id, second.email) == (first.id, "new@example.com")


def test_settings_row_is_added_to_an_existing_user(connection: Connection) -> None:
    connection.execute(users.insert().values(auth_subject="s1", email=EMAIL, display_name=NAME))
    assert get_or_create_user(connection, "s1", EMAIL, NAME).theme is None
    assert _count(connection, "s1") == (1, 1)


def test_deleted_account_is_not_restored(connection: Connection) -> None:
    get_or_create_user(connection, "s1", EMAIL, NAME)
    connection.execute(update(users).values(deleted_at=func.now()))
    with pytest.raises(AccountDeleted):
        get_or_create_user(connection, "s1", EMAIL, NAME)
    with pytest.raises(AccountDeleted):
        update_account(connection, "s1", theme="dark")
    assert connection.execute(select(users.c.deleted_at)).scalar_one() is not None
    assert _count(connection, "s1") == (1, 1)


def test_update_before_first_call(connection: Connection) -> None:
    with pytest.raises(AccountNotFound):
        update_account(connection, "s1", display_name="Анна")


def test_update_changes_only_passed_fields(connection: Connection) -> None:
    get_or_create_user(connection, "s1", EMAIL, NAME)
    assert update_account(connection, "s1", theme="sepia").display_name == NAME
    assert update_account(connection, "s1", display_name="Анна П.").theme == "sepia"
    assert update_account(connection, "s1", theme=None).theme is None


def test_update_touches_updated_at_of_its_table(connection: Connection) -> None:
    get_or_create_user(connection, "s1", EMAIL, NAME)
    past = func.now() - func.make_interval(0, 0, 0, 1)
    connection.execute(update(users).values(updated_at=past))
    connection.execute(update(user_settings).values(updated_at=past))
    update_account(connection, "s1", theme="dark")
    user_updated = connection.execute(select(users.c.updated_at)).scalar_one()
    settings_updated = connection.execute(select(user_settings.c.updated_at)).scalar_one()
    assert settings_updated > user_updated


def test_only_own_record_changes(connection: Connection) -> None:
    get_or_create_user(connection, "a", "a@example.com", "А")
    get_or_create_user(connection, "b", "b@example.com", "Б")
    update_account(connection, "a", display_name="Новое имя")
    names = {
        row.auth_subject: row.display_name
        for row in connection.execute(select(users.c.auth_subject, users.c.display_name))
    }
    assert names == {"a": "Новое имя", "b": "Б"}


@pytest.fixture
def subject(engine: Engine) -> Iterator[str]:
    """A subject for tests that commit; its rows are removed afterwards."""
    subject = f"concurrent-{uuid.uuid4()}"
    yield subject
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject == subject).scalar_subquery()
        connection.execute(delete(user_settings).where(user_settings.c.user_id.in_(ids)))
        connection.execute(delete(users).where(users.c.auth_subject == subject))


def test_concurrent_first_calls_create_one_record(engine: Engine, subject: str) -> None:
    barrier = threading.Barrier(2)
    errors: list[BaseException] = []

    def call() -> None:
        try:
            with engine.begin() as connection:
                barrier.wait()
                get_or_create_user(connection, subject, EMAIL, NAME)
        except BaseException as error:
            errors.append(error)

    threads = [threading.Thread(target=call) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert errors == []
    with engine.connect() as connection:
        assert _count(connection, subject) == (1, 1)

"""Requests for the closed beta in the core (openspec/specs/core/database, api/beta-requests)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Connection, Engine, insert, inspect, select, text, update
from sqlalchemy.exc import IntegrityError

from admin.__main__ import main as admin_main
from admin.__main__ import print_requests
from core.beta_requests import WINDOW_LIMIT, TooManyRequests, list_requests, normalize_email, submit
from core.errors import Invalid
from core.tables import SCHEMA, beta_requests, users
from core.users import get_or_create_user

NOW = datetime(2026, 11, 8, 12, 0, tzinfo=UTC)


def test_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("beta_requests", schema=SCHEMA)]
    assert columns == ["id", "email", "name", "role", "consent_at", "created_at"]


def _row(email: str = "anna@example.com", role: str = "writer") -> dict[str, object]:
    return {"email": email, "name": "Анна", "role": role, "consent_at": NOW}


def test_database_refuses_second_row_with_the_same_email(connection: Connection) -> None:
    connection.execute(insert(beta_requests).values(**_row()))
    with pytest.raises(IntegrityError, match="uq_beta_requests_email"):
        connection.execute(insert(beta_requests).values(**_row()))


def test_database_refuses_unknown_role(connection: Connection) -> None:
    with pytest.raises(IntegrityError, match="ck_beta_requests_role_known"):
        connection.execute(insert(beta_requests).values(**_row(role="producer")))


def test_database_refuses_upper_case_email(connection: Connection) -> None:
    with pytest.raises(IntegrityError, match="ck_beta_requests_email_lower"):
        connection.execute(insert(beta_requests).values(**_row(email="Anna@example.com")))


def test_new_request_is_stored_normalized(connection: Connection) -> None:
    stored = submit(connection, " Anna@Example.com ", "  Анна ", "screenwriter", NOW)
    assert stored is not None
    row = connection.execute(select(beta_requests).where(beta_requests.c.id == stored)).one()
    assert (row.email, row.name, row.role, row.consent_at) == ("anna@example.com", "Анна", "screenwriter", NOW)


def test_repeat_changes_nothing(connection: Connection) -> None:
    first = submit(connection, "anna@example.com", "Анна", "screenwriter", NOW)
    again = submit(connection, "ANNA@example.com", "Другая", "other", NOW + timedelta(days=1))
    assert first is not None
    assert again is None
    rows = connection.execute(select(beta_requests)).all()
    assert [(row.id, row.name, row.role, row.consent_at) for row in rows] == [(first, "Анна", "screenwriter", NOW)]


@pytest.mark.parametrize(
    "email",
    ["", "a@b", "anna", "anna@@example.com", "@example.com", "anna@.com", "anna@example.", "an na@example.com"],
)
def test_bad_email_is_refused(email: str) -> None:
    with pytest.raises(Invalid) as refused:
        normalize_email(email)
    assert refused.value.field == "email"


def test_bad_name_and_role_are_refused(connection: Connection) -> None:
    with pytest.raises(Invalid) as no_name:
        submit(connection, "anna@example.com", "   ", "writer", NOW)
    assert no_name.value.field == "name"
    with pytest.raises(Invalid) as long_name:
        submit(connection, "anna@example.com", "я" * 101, "writer", NOW)
    assert long_name.value.field == "name"
    with pytest.raises(Invalid) as role:
        submit(connection, "anna@example.com", "Анна", "producer", NOW)
    assert role.value.field == "role"
    assert connection.execute(select(beta_requests)).all() == []


def test_window_refuses_the_request_over_the_limit(connection: Connection) -> None:
    for number in range(WINDOW_LIMIT):
        assert submit(connection, f"author{number}@example.com", "Автор", "writer", NOW) is not None
    with pytest.raises(TooManyRequests) as refused:
        submit(connection, "late@example.com", "Поздний", "writer", NOW)
    assert 1 <= refused.value.retry_after <= 60
    stored = connection.execute(select(beta_requests.c.email).where(beta_requests.c.email == "late@example.com"))
    assert stored.all() == []


def test_window_frees_up_after_a_minute(connection: Connection) -> None:
    for number in range(WINDOW_LIMIT):
        submit(connection, f"author{number}@example.com", "Автор", "writer", NOW)
    connection.execute(update(beta_requests).values(created_at=text("clock_timestamp() - interval '61 seconds'")))
    assert submit(connection, "late@example.com", "Поздний", "writer", NOW) is not None


def test_list_newest_first_and_marks_users(connection: Connection) -> None:
    get_or_create_user(connection, "beta-anna", "Anna@Example.com", "Анна")
    connection.execute(
        insert(beta_requests).values(**_row("anna@example.com"), created_at=NOW - timedelta(days=1)),
    )
    connection.execute(insert(beta_requests).values(**_row("boris@example.com"), created_at=NOW))
    listed = list_requests(connection)
    assert [(item.email, item.is_user) for item in listed] == [
        ("boris@example.com", False),
        ("anna@example.com", True),
    ]


def test_deleted_user_is_not_marked(connection: Connection) -> None:
    get_or_create_user(connection, "beta-anna", "anna@example.com", "Анна")
    connection.execute(update(users).where(users.c.auth_subject == "beta-anna").values(deleted_at=NOW))
    connection.execute(insert(beta_requests).values(**_row("anna@example.com")))
    assert [item.is_user for item in list_requests(connection)] == [False]


def test_admin_lists_requests(connection: Connection, capsys: pytest.CaptureFixture[str]) -> None:
    get_or_create_user(connection, "beta-anna", "anna@example.com", "Анна")
    connection.execute(insert(beta_requests).values(**_row("anna@example.com"), created_at=NOW - timedelta(days=1)))
    connection.execute(insert(beta_requests).values(**_row("boris@example.com", role="other"), created_at=NOW))
    print_requests(list_requests(connection))
    lines = capsys.readouterr().out.splitlines()
    assert lines[0].split() == ["время", "(UTC)", "почта", "имя", "кто", "уже", "пользователь"]
    assert lines[1].split() == ["2026-11-08", "12:00", "boris@example.com", "Анна", "другое", "нет"]
    assert lines[2].split() == ["2026-11-07", "12:00", "anna@example.com", "Анна", "писатель", "да"]


def test_admin_without_requests(engine: Engine, capsys: pytest.CaptureFixture[str]) -> None:
    with engine.connect() as connection:
        assert connection.execute(select(beta_requests)).all() == [], "rows of another run are in the table"
    assert admin_main(["beta-requests"]) == 0
    assert capsys.readouterr().out == "Заявок нет.\n"

"""Marks of answers of the co-author in the core (openspec/specs/api/coauthor-feedback, core/database).

The conversation of a run comes from billing through the route (billing-module, design D8): here it is given, and
which runs a caller may mark is checked by the route tests (test_feedback_routes.py).
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Connection, delete, insert, select, text, update
from sqlalchemy.exc import IntegrityError

from admin.__main__ import print_feedback
from core.errors import Invalid
from core.feedback import (
    FeedbackReport,
    NotUsefulLine,
    clear_feedback,
    feedback_report,
    session_feedback,
    session_project,
    set_feedback,
)
from core.tables import coauthor_feedback, users

NOW = datetime.now(UTC)


def _author(connection: Connection, email: str | None = None) -> uuid.UUID:
    subject = f"test-{uuid.uuid4()}"
    user_id: uuid.UUID = connection.execute(
        insert(users)
        .values(auth_subject=subject, email=email or f"{subject}@example.com", display_name="Автор")
        .returning(users.c.id)
    ).scalar_one()
    return user_id


def _session() -> str:
    return f"{uuid.uuid4()}:{uuid.uuid4()}:{uuid.uuid4()}"


def _run() -> str:
    return str(uuid.uuid4())


def test_columns(connection: Connection) -> None:
    columns = connection.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'authorled' AND table_name = 'coauthor_feedback'"
        )
    ).scalars()
    assert sorted(columns) == sorted(["id", "user_id", "run_id", "session_id", "value", "created_at", "updated_at"])


def test_second_mark_of_a_run_is_refused(connection: Connection) -> None:
    user_id = _author(connection)
    row = {"user_id": user_id, "run_id": "r1", "session_id": "p:d:c", "value": "useful"}
    connection.execute(insert(coauthor_feedback).values(row))
    with pytest.raises(IntegrityError, match="uq_coauthor_feedback_user_id_run_id"):
        connection.execute(insert(coauthor_feedback).values(row))


def test_unknown_value_is_refused(connection: Connection) -> None:
    user_id = _author(connection)
    with pytest.raises(IntegrityError, match="ck_coauthor_feedback_value_known"):
        connection.execute(
            insert(coauthor_feedback).values(user_id=user_id, run_id="r1", session_id="p:d:c", value="great")
        )


def test_user_with_marks_cannot_be_deleted(connection: Connection) -> None:
    user_id = _author(connection)
    connection.execute(insert(coauthor_feedback).values(user_id=user_id, run_id="r1", session_id="p:d:c"))
    with pytest.raises(IntegrityError, match="fk_coauthor_feedback_user_id_users"):
        connection.execute(delete(users).where(users.c.id == user_id))


def test_set_change_and_clear(connection: Connection) -> None:
    user_id = _author(connection)
    session_id = _session()
    run_id = _run()

    put = set_feedback(connection, user_id, run_id, session_id, "useful")
    assert (put.run_id, put.session_id, put.value) == (run_id, session_id, "useful")
    changed = set_feedback(connection, user_id, run_id, session_id, "not_useful")
    assert changed.value == "not_useful"
    assert [(f.run_id, f.value) for f in session_feedback(connection, user_id, session_id)] == [(run_id, "not_useful")]
    rows = connection.execute(select(coauthor_feedback).where(coauthor_feedback.c.user_id == user_id)).all()
    assert len(rows) == 1

    clear_feedback(connection, user_id, run_id)
    assert session_feedback(connection, user_id, session_id) == []
    (row,) = connection.execute(select(coauthor_feedback).where(coauthor_feedback.c.user_id == user_id)).all()
    assert row.value is None
    clear_feedback(connection, user_id, run_id)

    again = set_feedback(connection, user_id, run_id, session_id, "useful")
    assert again.value == "useful"


def test_clear_without_a_mark(connection: Connection) -> None:
    user_id = _author(connection)
    clear_feedback(connection, user_id, _run())
    assert connection.execute(select(coauthor_feedback).where(coauthor_feedback.c.user_id == user_id)).all() == []


def test_unknown_value(connection: Connection) -> None:
    user_id = _author(connection)
    with pytest.raises(Invalid) as refused:
        set_feedback(connection, user_id, _run(), _session(), "great")
    assert refused.value.field == "value"


def test_marks_of_a_conversation(connection: Connection) -> None:
    user_id = _author(connection)
    other_id = _author(connection)
    session_id = _session()
    first = _run()
    set_feedback(connection, user_id, first, session_id, "useful")
    set_feedback(connection, user_id, _run(), _session(), "not_useful")
    set_feedback(connection, other_id, _run(), session_id, "not_useful")
    assert [(f.run_id, f.value) for f in session_feedback(connection, user_id, session_id)] == [(first, "useful")]


def test_session_project() -> None:
    story = uuid.uuid4()
    assert session_project(f"{story}:{uuid.uuid4()}:{uuid.uuid4()}") == story
    for bad in ("", "p:d:c", f"{story}:{uuid.uuid4()}", f"{story}:{uuid.uuid4()}:{uuid.uuid4()}:x"):
        with pytest.raises(Invalid) as refused:
            session_project(bad)
        assert refused.value.field == "session_id"


def test_report(connection: Connection) -> None:
    user_id = _author(connection, email="anna@example.com")
    since = NOW - timedelta(days=30)
    before = feedback_report(connection, since)
    session_id = _session()
    for _ in range(3):
        set_feedback(connection, user_id, _run(), session_id, "useful")
    bad = _run()
    set_feedback(connection, user_id, bad, session_id, "not_useful")
    taken_back = _run()
    set_feedback(connection, user_id, taken_back, session_id, "not_useful")
    clear_feedback(connection, user_id, taken_back)
    old = _run()
    set_feedback(connection, user_id, old, session_id, "not_useful")
    connection.execute(
        update(coauthor_feedback).where(coauthor_feedback.c.run_id == old).values(updated_at=NOW - timedelta(days=31))
    )

    report = feedback_report(connection, since)
    assert (report.useful - before.useful, report.not_useful - before.not_useful) == (3, 1)
    ours = [line for line in report.recent_not_useful if line.email == "anna@example.com"]
    assert [(line.run_id, line.session_id) for line in ours] == [(bad, session_id)]


def test_report_needs_a_time_zone(connection: Connection) -> None:
    with pytest.raises(ValueError, match="time zone"):
        feedback_report(connection, datetime(2026, 11, 1))


def test_report_command_output(capsys: pytest.CaptureFixture[str]) -> None:
    print_feedback(FeedbackReport(useful=0, not_useful=0, recent_not_useful=[]))
    assert capsys.readouterr().out == "Оценок нет.\n"
    line = NotUsefulLine(updated_at=NOW, email="anna@example.com", session_id="s:d:c", run_id="r-bad")
    print_feedback(FeedbackReport(useful=3, not_useful=1, recent_not_useful=[line]))
    out = capsys.readouterr().out
    assert "«Полезно» 3, «Не то» 1, доля «Не то» 25 %" in out
    assert "anna@example.com" in out and "s:d:c" in out and "r-bad" in out

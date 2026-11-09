"""Marks of the author on answers of the co-author (openspec/specs/api/coauthor-feedback).

A mark belongs to a run of the co-author that the usage journal records for this user; the conversation of the mark
is the conversation of that run, a fact of the server. Taking a mark back keeps the row with an empty value.
All operations run in the caller's transaction and never read the tables of Agno.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, Row, func, select, update
from sqlalchemy.dialects.postgresql import insert

from core.errors import Invalid, NotFound
from core.tables import COAUTHOR_FEEDBACK_VALUES, coauthor_feedback, usage_records, users

COAUTHOR = "coauthor"
RUN_NOT_FOUND = "Ответ соавтора не найден."


@dataclass(frozen=True)
class Feedback:
    run_id: str
    session_id: str
    value: str | None
    updated_at: datetime


@dataclass(frozen=True)
class NotUsefulLine:
    updated_at: datetime
    email: str
    session_id: str
    run_id: str


@dataclass(frozen=True)
class FeedbackReport:
    useful: int
    not_useful: int
    recent_not_useful: list[NotUsefulLine]


def session_project(session_id: str) -> uuid.UUID:
    """The story of a conversation `<story>:<draft>:<uuid>`; anything else is refused."""
    parts = session_id.split(":")
    try:
        if len(parts) != 3:
            raise ValueError(session_id)
        project_id = uuid.UUID(parts[0])
        uuid.UUID(parts[1])
        uuid.UUID(parts[2])
    except ValueError as error:
        raise Invalid(
            "Поле «session_id»: нужна беседа истории в форме <история>:<драфт>:<uuid>.", field="session_id"
        ) from error
    return project_id


def run_session(connection: Connection, user_id: uuid.UUID, run_id: str) -> str:
    """The conversation of a run of the co-author that the journal records for this user."""
    sessions = connection.execute(
        select(usage_records.c.session_id)
        .where(
            usage_records.c.run_id == run_id,
            usage_records.c.user_id == user_id,
            usage_records.c.agent_id == COAUTHOR,
        )
        .distinct()
    ).scalars()
    found = list(sessions)
    if not found:
        raise NotFound(RUN_NOT_FOUND)
    if len(found) > 1:
        raise RuntimeError(f"Run {run_id} has {len(found)} conversations in the usage journal")
    return found[0]


def _value(value: str) -> str:
    if value not in COAUTHOR_FEEDBACK_VALUES:
        raise Invalid(f"Поле «value»: одно из {', '.join(COAUTHOR_FEEDBACK_VALUES)}.", field="value")
    return value


def _feedback(row: Row[Any]) -> Feedback:
    return Feedback(run_id=row.run_id, session_id=row.session_id, value=row.value, updated_at=row.updated_at)


def set_feedback(connection: Connection, user_id: uuid.UUID, run_id: str, value: str) -> Feedback:
    """Put or replace the user's mark of a run of the co-author."""
    checked = _value(value)
    session_id = run_session(connection, user_id, run_id)
    row = connection.execute(
        insert(coauthor_feedback)
        .values(user_id=user_id, run_id=run_id, session_id=session_id, value=checked)
        .on_conflict_do_update(
            index_elements=[coauthor_feedback.c.user_id, coauthor_feedback.c.run_id],
            set_={"value": checked, "updated_at": func.now()},
        )
        .returning(coauthor_feedback)
    ).one()
    return _feedback(row)


def clear_feedback(connection: Connection, user_id: uuid.UUID, run_id: str) -> None:
    """Take the user's mark of a run back; a run without a mark stays as it is."""
    run_session(connection, user_id, run_id)
    connection.execute(
        update(coauthor_feedback)
        .where(
            coauthor_feedback.c.user_id == user_id,
            coauthor_feedback.c.run_id == run_id,
            coauthor_feedback.c.value.is_not(None),
        )
        .values(value=None, updated_at=func.now())
    )


def session_feedback(connection: Connection, user_id: uuid.UUID, session_id: str) -> list[Feedback]:
    """The user's marks in a conversation, without the ones taken back."""
    rows = connection.execute(
        select(coauthor_feedback)
        .where(
            coauthor_feedback.c.user_id == user_id,
            coauthor_feedback.c.session_id == session_id,
            coauthor_feedback.c.value.is_not(None),
        )
        .order_by(coauthor_feedback.c.updated_at, coauthor_feedback.c.run_id)
    ).all()
    return [_feedback(row) for row in rows]


def feedback_report(connection: Connection, since: datetime, limit: int = 20) -> FeedbackReport:
    """Marks changed since `since`: the counts and the latest «Не то», the newest first."""
    if since.tzinfo is None:
        raise ValueError("since must carry a time zone")
    in_window = (coauthor_feedback.c.updated_at >= since, coauthor_feedback.c.value.is_not(None))
    counts: dict[str, int] = dict(
        connection.execute(
            select(coauthor_feedback.c.value, func.count()).where(*in_window).group_by(coauthor_feedback.c.value)
        ).all()
    )
    recent = connection.execute(
        select(
            coauthor_feedback.c.updated_at,
            users.c.email,
            coauthor_feedback.c.session_id,
            coauthor_feedback.c.run_id,
        )
        .join(users, users.c.id == coauthor_feedback.c.user_id)
        .where(*in_window, coauthor_feedback.c.value == "not_useful")
        .order_by(coauthor_feedback.c.updated_at.desc(), coauthor_feedback.c.run_id)
        .limit(limit)
    ).all()
    return FeedbackReport(
        useful=counts.get("useful", 0),
        not_useful=counts.get("not_useful", 0),
        recent_not_useful=[
            NotUsefulLine(updated_at=row.updated_at, email=row.email, session_id=row.session_id, run_id=row.run_id)
            for row in recent
        ],
    )

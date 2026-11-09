"""Writing of the author: words of the screenplay, words written a day, goals (openspec/specs/api/writing).

Only the author's save of the text from the editor counts as writing: import, rollbacks, a copy of a draft and the demo
content change the text without it. The journal keeps the sum of differences per user, story and period of 15 minutes
of UTC; days are put together from periods in the time zone the reader gives.
"""

import math
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import Connection, Date, DateTime, cast, func, literal_column, select
from sqlalchemy.dialects.postgresql import insert

from core.documents import document_row
from core.errors import Invalid
from core.tables import (
    MAX_WORD_GOAL,
    WRITING_EPOCH,
    WRITING_PERIOD,
    drafts,
    projects,
    user_settings,
    writing_progress,
)
from core.texts import Doc, Text, block_text, put_text, screenplay_id, text_row

# Paragraphs that are no text of the screenplay: acts, groups of scenes, beats and notes (as for screen time,
# web/src/editor/document.ts, UNTIMED).
UNCOUNTED = ("act", "sequence", "beat", "inlineNote")
# What a goal in words may be, for the refusals of the routes; MAX_WORD_GOAL is 1 000 000.
GOAL_RULE = "целым числом от 1 до 1 000 000 или null"


def is_goal(value: object) -> bool:
    """A goal in words or None (no goal). bool is an int in Python: it is refused like strings and fractions."""
    return value is None or (type(value) is int and 1 <= value <= MAX_WORD_GOAL)


def count_words(doc: Doc) -> int:
    """Words of a screenplay: pieces between whitespace with at least one letter or digit.

    The examples in web/src/editor/wordCount.cases.json define the rule for the core and the editor alike.
    """
    words = 0
    for block in doc["content"]:
        if block["type"] in UNCOUNTED:
            continue
        words += sum(1 for piece in block_text(block).split() if any(ch.isalnum() for ch in piece))
    return words


def _period() -> Any:
    """Start of the period of 15 minutes of UTC that holds the current time of the database."""
    return func.date_bin(
        literal_column(f"interval '{WRITING_PERIOD}'"), func.now(), literal_column(f"timestamptz '{WRITING_EPOCH}'")
    )


def record(connection: Connection, user_id: uuid.UUID, project_id: uuid.UUID, words: int) -> None:
    """Add `words` (zero and below too) to the current period of the user in the story."""
    statement = insert(writing_progress).values(
        user_id=user_id, project_id=project_id, period_start=_period(), words=words
    )
    connection.execute(
        statement.on_conflict_do_update(
            index_elements=[writing_progress.c.user_id, writing_progress.c.project_id, writing_progress.c.period_start],
            set_={"words": writing_progress.c.words + statement.excluded.words},
        )
    )


def save_author_text(
    connection: Connection, document_id: uuid.UUID, expected_revision: int, content: Any, user_id: uuid.UUID
) -> Text:
    """The author's save of the text: replace it as `put_text` does and add the difference in words to the journal."""
    document = document_row(connection, document_id)
    before = count_words(text_row(connection, document_id, for_update=True).content)
    saved = put_text(connection, document_id, expected_revision, content, user_id)
    record(connection, user_id, document.project_id, count_words(saved.content) - before)
    return saved


# Days of the chart of the writing block: the last 30, today included.
DAYS = 30


@dataclass(frozen=True)
class Day:
    date: date
    # None: no save of the author that day (a gap), as opposed to 0 words.
    words: int | None
    # None without words or without a daily goal.
    met: bool | None


@dataclass(frozen=True)
class StoryGoal:
    words: int
    goal: int | None
    deadline: date | None
    days_left: int | None
    per_day: int | None


@dataclass(frozen=True)
class Writing:
    today: date
    daily_goal: int | None
    days: list[Day]
    story: StoryGoal


def check_zone(connection: Connection, zone: str | None) -> str:
    """The time zone of the reader by its IANA name, as the database knows it; no zone is assumed."""
    known = (
        zone is not None
        and connection.execute(
            select(func.count()).select_from(func.pg_timezone_names()).where(literal_column("name") == zone)
        ).scalar_one()
    )
    if not known:
        raise Invalid(
            f"Параметр «tz»: неизвестный часовой пояс {zone!r}, нужно имя IANA, например Europe/Moscow.", "tz"
        )
    assert zone is not None
    return zone


def per_day(goal: int | None, deadline: date | None, words: int, today: date) -> tuple[int | None, int | None]:
    """Days left to the deadline and words a day to meet the goal of the story (openspec/specs/api/writing)."""
    days_left = None if deadline is None else (deadline - today).days
    if goal is None or days_left is None:
        return days_left, None
    if words >= goal:
        return days_left, 0
    if days_left <= 0:
        return days_left, None
    return days_left, math.ceil((goal - words) / days_left)


def statistics(connection: Connection, user_id: uuid.UUID, draft_id: uuid.UUID, zone: str | None) -> Writing:
    """The words of the user by day in `zone` for all their stories, and the goal of the story of the draft."""
    zone = check_zone(connection, zone)
    today: date = connection.execute(select(cast(func.timezone(zone, func.now()), Date))).scalar_one()
    first = today - timedelta(days=DAYS - 1)
    local_day = cast(func.timezone(zone, writing_progress.c.period_start), Date)
    rows = connection.execute(
        select(local_day.label("day"), func.sum(writing_progress.c.words).label("words"))
        .where(
            writing_progress.c.user_id == user_id,
            writing_progress.c.period_start >= func.timezone(zone, cast(first, DateTime)),
        )
        .group_by(local_day)
    ).all()
    written = {row.day: int(row.words) for row in rows}
    daily_goal = connection.execute(
        select(user_settings.c.daily_word_goal).where(user_settings.c.user_id == user_id)
    ).scalar_one()
    days = []
    for offset in range(DAYS):
        day = first + timedelta(days=offset)
        words = written.get(day)
        met = None if words is None or daily_goal is None else words >= daily_goal
        days.append(Day(day, words, met))
    project = connection.execute(
        select(projects.c.word_goal, projects.c.goal_deadline)
        .join(drafts, drafts.c.project_id == projects.c.id)
        .where(drafts.c.id == draft_id)
    ).one()
    story_words = count_words(text_row(connection, screenplay_id(connection, draft_id)).content)
    days_left, needed = per_day(project.word_goal, project.goal_deadline, story_words, today)
    story = StoryGoal(story_words, project.word_goal, project.goal_deadline, days_left, needed)
    return Writing(today, daily_goal, days, story)

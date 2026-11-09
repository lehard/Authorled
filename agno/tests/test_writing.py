"""Writing of the author (openspec/specs/api/writing): words of the screenplay and the journal of words written."""

import json
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import Connection, func, insert, select, update

from core.drafts import create_draft, update_draft
from core.errors import Conflict, Invalid, Locked
from core.files import upload_file
from core.imports import create_project_from_file, import_into
from core.projects import create_project, update_project
from core.saves import create_point, list_versions, restore_point, restore_version
from core.tables import user_settings, writing_progress
from core.texts import ELEMENT_NAMES, get_text, heading, put_text, screenplay_id
from core.users import get_or_create_user
from core.writing import Writing, count_words, per_day, save_author_text, statistics

REPO = Path(__file__).resolve().parents[2]
CASES = REPO / "web" / "src" / "editor" / "wordCount.cases.json"
SAMPLES = Path(__file__).parent / "fixtures" / "import"
MOSCOW = "Europe/Moscow"


def _cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = json.loads(CASES.read_text())
    return cases


def _doc(*words: str) -> dict[str, Any]:
    """A screenplay of an empty scene heading and one action paragraph per argument."""
    blocks: list[dict[str, Any]] = [heading("s1")]
    blocks += [{"type": "action", "content": [{"type": "text", "text": text}]} for text in words]
    return {"type": "doc", "content": blocks}


def _words(n: int) -> dict[str, Any]:
    return _doc(" ".join(["слово"] * n)) if n else _doc()


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
    """The owner, the story, its first draft and its screenplay."""
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, draft, script = create_project(connection, owner, "Маяк")
    return owner, project.id, draft, script


def _written(connection: Connection, owner: uuid.UUID) -> tuple[int, int]:
    """Rows of the journal of the owner and the sum of their words."""
    rows, total = connection.execute(
        select(func.count(), func.coalesce(func.sum(writing_progress.c.words), 0)).where(
            writing_progress.c.user_id == owner
        )
    ).one()
    return rows, total


def test_cases_file_covers_every_paragraph_type() -> None:
    kinds = {block["type"] for case in _cases() for block in case["doc"]["content"]}
    assert set(ELEMENT_NAMES) <= kinds
    assert len(_cases()) >= 10


@pytest.mark.parametrize("case", _cases(), ids=lambda case: case["name"])
def test_words_of_the_shared_cases(case: dict[str, Any]) -> None:
    assert count_words(case["doc"]) == case["words"]


def test_signs_and_hyphens() -> None:
    assert count_words(_doc("Вера — кто-то стоит у воды...")) == 5


def test_beats_and_notes_do_not_count() -> None:
    doc = {
        "type": "doc",
        "content": [
            heading("s1", "ИНТ. КУХНЯ — ДЕНЬ"),
            {"type": "beat", "content": [{"type": "text", "text": "Вера решает"}]},
            {"type": "inlineNote", "content": [{"type": "text", "text": "проверить"}]},
        ],
    }
    assert count_words(doc) == 3


def test_written_and_deleted(connection: Connection) -> None:
    owner, _, _, script = _story(connection)
    put_text(connection, script, 1, _words(100), owner)
    save_author_text(connection, script, 2, _words(160), owner)
    save_author_text(connection, script, 3, _words(140), owner)
    assert _written(connection, owner) == (1, 40)


def test_edit_without_new_words_is_recorded_as_zero(connection: Connection) -> None:
    owner, _, _, script = _story(connection)
    put_text(connection, script, 1, _words(3), owner)
    retyped = _words(3)
    retyped["content"][1]["type"] = "dialogue"
    save_author_text(connection, script, 2, retyped, owner)
    assert _written(connection, owner) == (1, 0)


def test_refused_saves_record_nothing(connection: Connection) -> None:
    owner, _, draft, script = _story(connection)
    with pytest.raises(Conflict):
        save_author_text(connection, script, 7, _words(10), owner)
    update_draft(connection, draft, {"locked": True})
    with pytest.raises(Locked):
        save_author_text(connection, script, 1, _words(10), owner)
    assert _written(connection, owner) == (0, 0)


def test_import_records_nothing(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    stored = upload_file(
        connection, project, owner, "manuscript.txt", "import", None, (SAMPLES / "manuscript.txt").read_bytes()
    )
    import_into(connection, draft, stored.id, 1, owner)
    create_project_from_file(connection, owner, "Из файла", "manuscript.txt", (SAMPLES / "manuscript.txt").read_bytes())
    assert _written(connection, owner) == (0, 0)


def test_rollback_to_a_snapshot_records_nothing(connection: Connection) -> None:
    owner, _, _, script = _story(connection)
    put_text(connection, script, 1, _words(300), owner)
    put_text(connection, script, 2, _words(500), owner, "import")
    (version,) = [v for v in list_versions(connection, script, "text") if count_words(v.content) == 300]
    restore_version(connection, version.id, 3, owner)
    assert _written(connection, owner) == (0, 0)
    save_author_text(connection, script, get_text(connection, script).revision, _words(310), owner)
    assert _written(connection, owner) == (1, 10)


def test_point_copy_and_new_story_record_nothing(connection: Connection) -> None:
    owner, project, draft, script = _story(connection)
    point = create_point(connection, draft, "Точка", owner)
    put_text(connection, script, 1, _words(50), owner)
    restore_point(connection, point.id, owner)
    create_draft(connection, project, "Драфт 2", draft, owner)
    create_project(connection, owner, "Паром")
    assert _written(connection, owner) == (0, 0)


# --- statistics


def _at(connection: Connection, owner: uuid.UUID, project: uuid.UUID, when: datetime, words: int) -> None:
    """A period of the journal put straight into the table, at a moment of `when` on a boundary of 15 minutes."""
    connection.execute(
        insert(writing_progress).values(
            user_id=owner, project_id=project, period_start=when.astimezone(UTC), words=words
        )
    )


def _local(days_ago: int, hour: int = 12, zone: str = MOSCOW) -> datetime:
    """A moment `days_ago` days before today in `zone`, at `hour` local time."""
    today = datetime.now(ZoneInfo(zone)).date()
    day = today - timedelta(days=days_ago)
    return datetime(day.year, day.month, day.day, hour, tzinfo=ZoneInfo(zone))


def _goal(connection: Connection, owner: uuid.UUID, goal: int | None) -> None:
    connection.execute(update(user_settings).where(user_settings.c.user_id == owner).values(daily_word_goal=goal))


def _day(stats: Writing, days_ago: int) -> tuple[int | None, bool | None]:
    day = stats.days[-1 - days_ago]
    assert day.date == stats.today - timedelta(days=days_ago)
    return day.words, day.met


def test_thirty_days_end_today(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    _at(connection, owner, project, _local(30), 999)
    stats = statistics(connection, owner, draft, MOSCOW)
    assert stats.today == datetime.now(ZoneInfo(MOSCOW)).date()
    assert len(stats.days) == 30 and stats.days[0].date == stats.today - timedelta(days=29)
    assert all(day.words is None and day.met is None for day in stats.days)
    assert stats.daily_goal is None


def test_day_boundary_follows_the_zone(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    day = datetime.now(UTC).date() - timedelta(days=3)
    _at(connection, owner, project, datetime(day.year, day.month, day.day, 22, 30, tzinfo=UTC), 200)
    moscow = {d.date: d.words for d in statistics(connection, owner, draft, MOSCOW).days}
    london = {d.date: d.words for d in statistics(connection, owner, draft, "Europe/London").days}
    assert moscow[day + timedelta(days=1)] == 200 and moscow.get(day) is None
    assert london[day] == 200


def test_goal_met_and_the_next_day_starts_empty(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    _goal(connection, owner, 500)
    _at(connection, owner, project, _local(1), 600)
    stats = statistics(connection, owner, draft, MOSCOW)
    assert stats.daily_goal == 500
    assert _day(stats, 1) == (600, True)
    assert _day(stats, 0) == (None, None)


def test_two_stories_in_one_day(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    other, other_draft, _ = create_project(connection, owner, "Паром")
    _goal(connection, owner, 500)
    _at(connection, owner, project, _local(2, 10), 300)
    _at(connection, owner, other.id, _local(2, 18), 250)
    assert _day(statistics(connection, owner, draft, MOSCOW), 2) == (550, True)
    assert _day(statistics(connection, owner, other_draft, MOSCOW), 2) == (550, True)


def test_more_deleted_than_written(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    _goal(connection, owner, 500)
    _at(connection, owner, project, _local(4, 10), 100)
    _at(connection, owner, project, _local(4, 11), -300)
    assert _day(statistics(connection, owner, draft, MOSCOW), 4) == (-200, False)


def test_zero_is_no_gap_and_no_goal_marks_nothing(connection: Connection) -> None:
    owner, project, draft, _ = _story(connection)
    _at(connection, owner, project, _local(5), 0)
    _at(connection, owner, project, _local(6), 700)
    stats = statistics(connection, owner, draft, MOSCOW)
    assert _day(stats, 5) == (0, None)
    assert _day(stats, 6) == (700, None)


def test_saves_of_today_count_today(connection: Connection) -> None:
    owner, _, draft, script = _story(connection)
    save_author_text(connection, script, 1, _words(12), owner)
    assert _day(statistics(connection, owner, draft, MOSCOW), 0) == (12, None)


@pytest.mark.parametrize(
    ("goal", "deadline_in", "words", "expected"),
    [
        (20000, 20, 10000, (20, 500)),
        (20000, -1, 15000, (-1, None)),
        (20000, 0, 15000, (0, None)),
        (20000, 5, 21000, (5, 0)),
        (20000, 3, 10001, (3, 3333)),
        (20000, None, 10000, (None, None)),
        (None, None, 10000, (None, None)),
    ],
)
def test_words_a_day_to_the_deadline(
    goal: int | None, deadline_in: int | None, words: int, expected: tuple[int | None, int | None]
) -> None:
    today = date(2026, 11, 9)
    deadline = None if deadline_in is None else today + timedelta(days=deadline_in)
    assert per_day(goal, deadline, words, today) == expected


def test_story_goal_of_the_draft(connection: Connection) -> None:
    owner, project, draft, script = _story(connection)
    put_text(connection, script, 1, _words(8), owner)
    second = create_draft(connection, project, "Драфт 2", draft, owner)
    put_text(connection, screenplay_id(connection, second.id), 1, _words(12), owner)
    today = datetime.now(ZoneInfo(MOSCOW)).date()
    update_project(connection, project, {"word_goal": 20, "goal_deadline": (today + timedelta(days=4)).isoformat()})
    story = statistics(connection, owner, second.id, MOSCOW).story
    assert (story.words, story.goal, story.deadline, story.days_left, story.per_day) == (
        12,
        20,
        today + timedelta(days=4),
        4,
        2,
    )
    assert statistics(connection, owner, draft, MOSCOW).story.words == 8


@pytest.mark.parametrize("zone", [None, "", "Mars/Base", "MSK+3"])
def test_unknown_zone_is_refused(connection: Connection, zone: str | None) -> None:
    owner, _, draft, _ = _story(connection)
    with pytest.raises(Invalid) as error:
        statistics(connection, owner, draft, zone)
    assert error.value.field == "tz"

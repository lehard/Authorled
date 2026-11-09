"""The notes of a demo story brought back to the demo state before a request of the measurement of actions."""

import uuid

import pytest
from sqlalchemy import Connection

from core import notes
from core.projects import list_projects
from core.users import get_or_create_user
from demo.load import load_demo
from evals.coauthor.demo_notes import NotesMismatch, demo_notes, restore_notes
from evals.coauthor.user import DEMO_EDITOR, DEMO_WRITER

WATER, FERRY = "Тихая вода", "Последний паром"


@pytest.fixture
def owner(connection: Connection) -> uuid.UUID:
    writer = get_or_create_user(connection, "demo-notes-writer", "demo-notes-writer@authorled.test", "Автор").id
    editor = get_or_create_user(connection, "demo-notes-editor", "demo-notes-editor@authorled.test", "Редактор").id
    load_demo(connection, {DEMO_WRITER: writer, DEMO_EDITOR: editor})
    return writer


def _story(connection: Connection, owner: uuid.UUID, title: str) -> uuid.UUID:
    (story,) = (p for p in list_projects(connection, owner, trash=False) if p.title == title)
    return story.id


def _state(connection: Connection, story: uuid.UUID) -> list[tuple[str, str, bool]]:
    return [(n.title, n.body, n.deleted_at is not None) for n in notes.list_notes(connection, story)]


def _demo(title: str) -> list[tuple[str, str, bool]]:
    return [(n.title, n.body, n.trashed) for n in demo_notes(title)]


def _note(connection: Connection, story: uuid.UUID, title: str) -> notes.Note:
    (note,) = (n for n in notes.list_notes(connection, story) if n.title == title)
    return note


def test_changes_of_a_request_are_undone(connection: Connection, owner: uuid.UUID) -> None:
    story = _story(connection, owner, WATER)
    assert _state(connection, story) == _demo(WATER)
    questions = _note(connection, story, "Вопросы к читке")
    notes.update_note_by_coauthor(connection, questions.id, {"append": "Не слишком ли много воды?"}, owner)
    notes.update_note_by_coauthor(connection, questions.id, {"title": "Вопросы к первой читке"}, owner)
    notes.create_note(connection, story, "Кастинг", "Вера — актриса 50+.", owner)

    restore_notes(connection, story, demo_notes(WATER), owner)

    assert [n for n in _state(connection, story) if not n[2]] == [n for n in _demo(WATER) if not n[2]]
    assert _state(connection, story)[-1] == ("Кастинг", "Вера — актриса 50+.", True)


def test_story_without_demo_notes_keeps_none(connection: Connection, owner: uuid.UUID) -> None:
    story = _story(connection, owner, FERRY)
    assert demo_notes(FERRY) == ()
    notes.create_note(connection, story, "Факты о переправах", "Паромы на канатной тяге.", owner)

    restore_notes(connection, story, demo_notes(FERRY), owner)

    assert _state(connection, story) == [("Факты о переправах", "Паромы на канатной тяге.", True)]


def test_demo_state_is_left_as_it_is(connection: Connection, owner: uuid.UUID) -> None:
    story = _story(connection, owner, WATER)
    before = [(n.id, n.revision) for n in notes.list_notes(connection, story)]

    restore_notes(connection, story, demo_notes(WATER), owner)

    assert [(n.id, n.revision) for n in notes.list_notes(connection, story)] == before


def test_a_rewritten_note_stops_the_measurement(connection: Connection, owner: uuid.UUID) -> None:
    story = _story(connection, owner, WATER)
    questions = _note(connection, story, "Вопросы к читке")
    notes.update_note(connection, questions.id, questions.revision, {"title": "Другое", "body": "Другой текст"}, owner)

    with pytest.raises(NotesMismatch, match="«Другое» .* is not the demo note «Вопросы к читке»"):
        restore_notes(connection, story, demo_notes(WATER), owner)


def test_a_demo_note_out_of_the_trash_stops_the_measurement(connection: Connection, owner: uuid.UUID) -> None:
    story = _story(connection, owner, WATER)
    (trashed,) = (n for n in notes.list_notes(connection, story) if n.deleted_at is not None)
    notes.restore_note(connection, trashed.id)

    with pytest.raises(NotesMismatch, match="trash state"):
        restore_notes(connection, story, demo_notes(WATER), owner)

"""Comments and co-author suggestions in the core (openspec/specs/api/review; api/agents, suggestions)."""

import uuid
from typing import Any

import pytest
from sqlalchemy import Connection

from core.documents import create_documents
from core.errors import Conflict, Forbidden, Invalid, NotFound
from core.projects import create_project
from core.review import (
    add_reply,
    create_suggestion,
    create_thread,
    decide,
    delete_message,
    edit_message,
    list_suggestions,
    list_threads,
    set_resolved,
)
from core.texts import create_draft, get_text, heading, put_text
from core.users import get_or_create_user

SESSION = "story:1"


def _p(kind: str, text: str) -> dict[str, Any]:
    return {"type": kind, "content": [{"type": "text", "text": text}]}


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """A story whose screenplay has scene s3 «Вера молчит»; returns the project, the screenplay and the author."""
    author = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, script_id = create_project(connection, author, "Маяк")
    put_text(
        connection,
        script_id,
        1,
        {"type": "doc", "content": [heading("s3", "НАТ. ОЗЕРО — ДЕНЬ"), _p("action", "Вера молчит.")]},
    )
    return project.id, script_id, author


def test_new_thread(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    thread = create_thread(connection, script_id, uuid.uuid4(), "Вера смотрит на воду", "Слишком прямо", author, "")
    (listed,) = list_threads(connection, script_id)
    assert listed.id == thread.id
    assert [(m.author_id, m.body) for m in listed.messages] == [(author, "Слишком прямо")]


def test_empty_comment_is_refused(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    with pytest.raises(Invalid):
        create_thread(connection, script_id, uuid.uuid4(), "Вера", "  ", author, "")
    assert list_threads(connection, script_id) == []


def test_repeated_thread_id(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    thread_id = uuid.uuid4()
    create_thread(connection, script_id, thread_id, "Вера", "Да", author, "")
    with pytest.raises(Conflict):
        create_thread(connection, script_id, thread_id, "Вера", "Ещё", author, "")


def test_draft_takes_no_comments(connection: Connection) -> None:
    project_id, script_id, author = _story(connection)
    draft_id = create_draft(connection, project_id, "Драфт", script_id, locked=False)
    with pytest.raises(Conflict):
        create_thread(connection, draft_id, uuid.uuid4(), "Вера", "Да", author, "")


def test_character_has_no_text(connection: Connection) -> None:
    project_id, _, _ = _story(connection)
    (vera,) = create_documents(connection, project_id, [{"kind": "character", "name": "Вера", "role": "main"}])
    with pytest.raises(NotFound):
        list_threads(connection, vera.id)


def test_only_own_messages_change(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    other = get_or_create_user(connection, "s2", "editor@authorled.test", "Редактор").id
    thread = create_thread(connection, script_id, uuid.uuid4(), "Вера", "Слишком прямо", author, "")
    thread = add_reply(connection, thread.id, "Согласен", other, "редактор")
    reply = thread.messages[1]
    with pytest.raises(Forbidden):
        edit_message(connection, thread.id, reply.id, "Нет", author)
    edited = edit_message(connection, thread.id, reply.id, "Согласен полностью", other)
    assert edited.messages[1].body == "Согласен полностью" and edited.messages[1].edited_at is not None
    assert edited.messages[1].author_role == "редактор"


def test_deleting_the_first_message_deletes_the_thread(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    thread = create_thread(connection, script_id, uuid.uuid4(), "Вера", "Первое", author, "")
    add_reply(connection, thread.id, "Второе", author, "")
    thread = add_reply(connection, thread.id, "Третье", author, "")
    assert delete_message(connection, thread.id, thread.messages[1].id, author) is False
    assert delete_message(connection, thread.id, thread.messages[0].id, author) is True
    assert list_threads(connection, script_id) == []


def test_resolve_and_reopen(connection: Connection) -> None:
    _, script_id, author = _story(connection)
    thread = create_thread(connection, script_id, uuid.uuid4(), "Вера", "Да", author, "")
    assert set_resolved(connection, thread.id, True, author).resolved_at is not None
    assert set_resolved(connection, thread.id, False, author).resolved_at is None


def test_suggestion_keeps_the_text(connection: Connection) -> None:
    _, script_id, _ = _story(connection)
    before = get_text(connection, script_id)
    suggestion = create_suggestion(
        connection, script_id, "s3", "Вера молчит", "Вера отворачивается", "Действие", SESSION
    )
    assert suggestion.status == "open"
    after = get_text(connection, script_id)
    assert (after.revision, after.content) == (before.revision, before.content)
    assert [s.id for s in list_suggestions(connection, script_id, "open")] == [suggestion.id]


def test_suggestion_needs_the_quote_in_the_scene(connection: Connection) -> None:
    _, script_id, _ = _story(connection)
    with pytest.raises(Invalid, match="Цитата не найдена в сцене"):
        create_suggestion(connection, script_id, "s3", "Вода холодная", "Вода тёплая", "", SESSION)
    with pytest.raises(NotFound):
        create_suggestion(connection, script_id, "s9", "Вера молчит", "Вера плачет", "", SESSION)
    assert list_suggestions(connection, script_id, None) == []


def test_filter_and_decide_once(connection: Connection) -> None:
    _, script_id, _ = _story(connection)
    first = create_suggestion(connection, script_id, "s3", "Вера молчит", "Вера отворачивается", "", SESSION)
    second = create_suggestion(connection, script_id, "s3", "молчит", "кричит", "", SESSION)
    decide(connection, second.id, "rejected")
    assert [s.id for s in list_suggestions(connection, script_id, "open")] == [first.id]
    accepted = decide(connection, first.id, "accepted")
    assert accepted.decided_at is not None
    with pytest.raises(Conflict):
        decide(connection, first.id, "rejected")
    with pytest.raises(Invalid):
        list_suggestions(connection, script_id, "maybe")

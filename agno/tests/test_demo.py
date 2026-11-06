"""Demo stories of the development users (openspec/specs/runtime, «Демо-контент», «Отказы загрузки демо-контента»)."""

import json
import uuid
from typing import Any

import pytest
from sqlalchemy import Connection, func, select, text

from core.documents import list_documents
from core.drafts import list_drafts
from core.projects import create_project, list_projects, trash_project
from core.review import list_suggestions, list_threads
from core.saves import list_points
from core.tables import SCHEMA, projects
from core.texts import get_text, scenes, screenplay_id
from core.users import get_or_create_user
from demo.load import DemoExists, SchemaBehind, ensure_migrated, load_demo

WRITER = "writer@authorled.test"
EDITOR = "editor@authorled.test"


@pytest.fixture
def accounts(connection: Connection) -> dict[str, uuid.UUID]:
    return {
        email: get_or_create_user(connection, f"demo-{email}", email, email.split("@")[0]).id
        for email in (WRITER, EDITOR)
    }


def _story(connection: Connection, owner: uuid.UUID, title: str, trash: bool = False) -> Any:
    return next(p for p in list_projects(connection, owner, trash) if p.title == title)


def _count(connection: Connection) -> int:
    return connection.execute(select(func.count()).select_from(projects)).scalar_one()


@pytest.mark.parametrize("email", [WRITER, EDITOR])
def test_every_owner_gets_a_copy(connection: Connection, accounts: dict[str, uuid.UUID], email: str) -> None:
    load_demo(connection, accounts)
    owner = accounts[email]

    assert sorted(p.title for p in list_projects(connection, owner, False)) == ["Последний паром", "Тихая вода"]
    assert [p.title for p in list_projects(connection, owner, True)] == ["Без названия"]
    assert _story(connection, owner, "Тихая вода").drafts_count == 2

    ferry = _story(connection, owner, "Последний паром")
    draft = list_drafts(connection, ferry.id)[0]
    assert len(scenes(get_text(connection, screenplay_id(connection, draft.id)).content)) == 6
    kinds = {d.kind for d in list_documents(connection, draft.id)}
    assert kinds == {"script", "character", "location", "world"}


def test_drafts_of_the_water_story(connection: Connection, accounts: dict[str, uuid.UUID]) -> None:
    load_demo(connection, accounts)
    owner = accounts[WRITER]
    story = _story(connection, owner, "Тихая вода")
    first, second = sorted(list_drafts(connection, story.id), key=lambda d: d.created_at)
    assert story.open_draft_id == first.id
    assert second.forked_from_name == first.name == "Драфт 1"

    first_doc = screenplay_id(connection, first.id)
    second_doc = screenplay_id(connection, second.id)
    threads = list_threads(connection, first_doc)
    assert len(threads) == 2
    assert {thread.messages[0].author_id for thread in threads} == {accounts[EDITOR]}
    assert [m.author_id for t in threads for m in t.messages[1:]] == [owner]
    assert len(list_suggestions(connection, first_doc, "open")) == 2
    assert list_threads(connection, second_doc) == []
    assert list_suggestions(connection, second_doc, None) == []
    assert len(list_points(connection, first.id)) == 1
    assert len(list_points(connection, second.id)) == 1

    ending = "В то утро я видела лодку"
    assert ending not in json.dumps(get_text(connection, first_doc).content, ensure_ascii=False)
    assert ending in json.dumps(get_text(connection, second_doc).content, ensure_ascii=False)

    def vera(draft_id: uuid.UUID) -> Any:
        return next(d for d in list_documents(connection, draft_id) if d.name == "Вера")

    assert vera(first.id).summary != vera(second.id).summary
    assert "change" in vera(second.id).fields
    assert "Нина" in [d.name for d in list_documents(connection, first.id) if d.deleted_at]


def test_marks_of_the_text(connection: Connection, accounts: dict[str, uuid.UUID]) -> None:
    load_demo(connection, accounts)
    story = _story(connection, accounts[EDITOR], "Тихая вода")
    first = sorted(list_drafts(connection, story.id), key=lambda d: d.created_at)[0]
    document_id = screenplay_id(connection, first.id)
    marks = [
        mark
        for block in get_text(connection, document_id).content["content"]
        for node in block.get("content", [])
        for mark in node.get("marks", [])
    ]
    assert {mark["type"] for mark in marks} == {"comment"}
    assert {uuid.UUID(mark["attrs"]["id"]) for mark in marks} == {t.id for t in list_threads(connection, document_id)}


def test_a_second_run_changes_nothing(connection: Connection, accounts: dict[str, uuid.UUID]) -> None:
    load_demo(connection, accounts)
    before = _count(connection)

    with pytest.raises(DemoExists, match=f"{EDITOR}: «Последний паром»"):
        load_demo(connection, accounts)

    assert _count(connection) == before


def test_a_demo_title_in_the_trash_refuses(connection: Connection, accounts: dict[str, uuid.UUID]) -> None:
    story, _, _ = create_project(connection, accounts[WRITER], "Последний паром")
    trash_project(connection, story.id)
    before = _count(connection)

    with pytest.raises(DemoExists, match=f"{WRITER}: «Последний паром»"):
        load_demo(connection, accounts)

    assert _count(connection) == before


def test_other_stories_stay(connection: Connection, accounts: dict[str, uuid.UUID]) -> None:
    stranger = get_or_create_user(connection, "demo-stranger", "stranger@example.com", "Третий").id
    theirs, _, _ = create_project(connection, stranger, "Тихая вода")
    mine, _, _ = create_project(connection, accounts[WRITER], "Белая дача")

    load_demo(connection, accounts)

    assert [p.id for p in list_projects(connection, stranger, False)] == [theirs.id]
    assert _story(connection, accounts[WRITER], "Белая дача").id == mine.id


def test_a_schema_behind_refuses(connection: Connection) -> None:
    ensure_migrated(connection)
    connection.execute(text(f"UPDATE {SCHEMA}.alembic_version SET version_num = '0001_old'"))

    with pytest.raises(SchemaBehind, match="dev.sh migrate"):
        ensure_migrated(connection)

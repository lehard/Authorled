"""Notes of a story (openspec/specs/api/stories: «Заметки истории» … «Заметки и драфты»)."""

import uuid

import pytest
from sqlalchemy import Connection, delete, insert, inspect, select
from sqlalchemy.exc import IntegrityError

from core.documents import create_documents, list_documents, update_document
from core.drafts import create_draft, delete_draft, empty_trash, trash_draft, update_draft
from core.errors import Conflict, Invalid, Locked, NotFound
from core.notes import (
    create_note,
    delete_note,
    list_notes,
    note_row,
    restore_note,
    trash_note,
    update_note,
    update_note_by_coauthor,
)
from core.projects import create_project, delete_project, trash_project
from core.saves import create_point, list_points, list_versions, restore_point, restore_version
from core.tables import SCHEMA, notes, projects
from core.users import get_or_create_user


@pytest.fixture
def owner(connection: Connection) -> uuid.UUID:
    return get_or_create_user(connection, "notes-owner", "notes@authorled.test", "Автор").id


@pytest.fixture
def story(connection: Connection, owner: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    project, draft_id, _ = create_project(connection, owner, "Маяк")
    return project.id, draft_id


def test_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("notes", schema=SCHEMA)]
    assert columns == [
        "id",
        "project_id",
        "title",
        "body",
        "revision",
        "updated_by",
        "created_at",
        "updated_at",
        "deleted_at",
    ]


def test_empty_title_is_refused_by_the_database(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    with pytest.raises(IntegrityError, match="ck_notes_title_not_empty"):
        connection.execute(insert(notes).values(project_id=story[0], title="", updated_by=owner))


def test_new_note(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note(connection, story[0], "  Финал ", "", owner)
    assert (note.title, note.body, note.revision, note.deleted_at) == ("Финал", "", 1, None)
    assert list_notes(connection, story[0]) == [note]


def test_order_of_creation_stays_after_edits_and_trash(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    final = create_note(connection, story[0], "Финал", "", owner)
    vera = create_note(connection, story[0], "Вера", "", owner)
    update_note(connection, final.id, 1, {"body": "Лодка"}, owner)
    assert [n.title for n in list_notes(connection, story[0])] == ["Финал", "Вера"]

    trash_note(connection, final.id)
    restore_note(connection, final.id)
    assert [n.id for n in list_notes(connection, story[0])] == [final.id, vera.id]


@pytest.mark.parametrize("title", ["", "   ", None, 7])
def test_title_is_required(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID], title: object
) -> None:
    with pytest.raises(Invalid, match="Название заметки"):
        create_note(connection, story[0], title, "", owner)


def test_body_must_be_text(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    with pytest.raises(Invalid, match="body"):
        create_note(connection, story[0], "Финал", 7, owner)


def test_edit_with_revision(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    changed = update_note(connection, note.id, 1, {"title": "Концовка", "body": "Лодка"}, owner)
    assert (changed.title, changed.body, changed.revision) == ("Концовка", "Лодка", 2)

    with pytest.raises(Conflict, match="ревизия 2"):
        update_note(connection, note.id, 1, {"body": "Старая правка"}, owner)
    assert note_row(connection, note.id).body == "Лодка"


@pytest.mark.parametrize(
    "changes, message", [({}, "title или body"), ({"color": "red"}, "color"), ({"title": " "}, "Название заметки")]
)
def test_refused_changes(
    connection: Connection,
    owner: uuid.UUID,
    story: tuple[uuid.UUID, uuid.UUID],
    changes: dict[str, object],
    message: str,
) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    with pytest.raises(Invalid, match=message):
        update_note(connection, note.id, 1, changes, owner)


def test_coauthor_appends_to_the_end(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note(connection, story[0], "Финал", "Вера уходит к воде.", owner)
    changed = update_note_by_coauthor(connection, note.id, {"append": "Аня идёт за ней."}, owner)
    assert changed.body == "Вера уходит к воде.\nАня идёт за ней."
    assert changed.revision == note.revision + 1
    empty = create_note(connection, story[0], "Пусто", "", owner)
    assert update_note_by_coauthor(connection, empty.id, {"append": "Начало"}, owner).body == "Начало"


def test_coauthor_changes_on_the_current_revision(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    update_note(connection, note.id, note.revision, {"body": "Вода"}, owner)
    changed = update_note_by_coauthor(connection, note.id, {"title": "Финал истории"}, owner)
    assert (changed.title, changed.body) == ("Финал истории", "Вода")


@pytest.mark.parametrize(
    ("changes", "field"), [({"body": "a", "append": "b"}, "append"), ({"append": "  "}, "append"), ({}, None)]
)
def test_coauthor_refused_changes(
    connection: Connection,
    owner: uuid.UUID,
    story: tuple[uuid.UUID, uuid.UUID],
    changes: dict[str, object],
    field: str | None,
) -> None:
    note = create_note(connection, story[0], "Финал", "Вода", owner)
    with pytest.raises(Invalid) as error:
        update_note_by_coauthor(connection, note.id, changes, owner)
    assert error.value.field == field
    assert note_row(connection, note.id).body == "Вода"


def test_coauthor_change_in_the_trash(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    trash_note(connection, note.id)
    with pytest.raises(Conflict):
        update_note_by_coauthor(connection, note.id, {"append": "Вода"}, owner)
    other = create_note(connection, story[0], "Начало", "", owner)
    trash_project(connection, story[0])
    with pytest.raises(Conflict):
        update_note_by_coauthor(connection, other.id, {"append": "Вода"}, owner)


def test_trash_keeps_the_note(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note(connection, story[0], "Финал", "Лодка", owner)
    assert trash_note(connection, note.id).deleted_at is not None

    with pytest.raises(Conflict, match="в корзине"):
        update_note(connection, note.id, 1, {"body": "Новое"}, owner)
    with pytest.raises(Conflict, match="уже в корзине"):
        trash_note(connection, note.id)

    restored = restore_note(connection, note.id)
    assert (restored.title, restored.body, restored.deleted_at) == ("Финал", "Лодка", None)
    with pytest.raises(Conflict, match="не в корзине"):
        restore_note(connection, note.id)


def test_delete_only_from_trash(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    with pytest.raises(Conflict, match="только заметку из корзины"):
        delete_note(connection, note.id)

    trash_note(connection, note.id)
    delete_note(connection, note.id)
    with pytest.raises(NotFound):
        note_row(connection, note.id)


def test_story_in_trash_refuses_everything(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    live = create_note(connection, story[0], "Финал", "", owner)
    deleted = create_note(connection, story[0], "Вера", "", owner)
    trash_note(connection, deleted.id)
    trash_project(connection, story[0])

    for refused in (
        lambda: create_note(connection, story[0], "Новая", "", owner),
        lambda: update_note(connection, live.id, 1, {"body": "Новое"}, owner),
        lambda: trash_note(connection, live.id),
        lambda: restore_note(connection, deleted.id),
        lambda: delete_note(connection, deleted.id),
    ):
        with pytest.raises(Conflict, match="История в корзине"):
            refused()


def test_notes_go_with_the_story(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note(connection, story[0], "Финал", "", owner)
    trash_project(connection, story[0])
    delete_project(connection, story[0])
    assert connection.execute(select(notes.c.id).where(notes.c.id == note.id)).one_or_none() is None


def test_rows_go_with_a_deleted_project(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    create_note(connection, story[0], "Финал", "", owner)
    connection.execute(delete(projects).where(projects.c.id == story[0]))
    assert connection.execute(select(notes.c.id).where(notes.c.project_id == story[0])).all() == []


def test_new_draft_copies_no_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    note = create_note(connection, project_id, "Финал", "", owner)
    create_draft(connection, project_id, "Драфт 2", draft_id, owner)
    assert list_notes(connection, project_id) == [note]


def test_rollback_to_a_point_keeps_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    note = create_note(connection, project_id, "Финал", "Старое", owner)
    create_point(connection, draft_id, "Перед правкой", owner)
    changed = update_note(connection, note.id, 1, {"body": "Новое"}, owner)

    restore_point(connection, list_points(connection, draft_id)[0].id, owner)

    assert note_row(connection, note.id) == changed


def test_rollback_to_a_snapshot_keeps_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    world = create_documents(connection, draft_id, [{"kind": "world", "name": "Мир"}], owner)[0]
    update_document(connection, world.id, world.revision, {"summary": "Первое"}, owner)
    note = create_note(connection, project_id, "Финал", "Старое", owner)
    changed = update_note(connection, note.id, 1, {"body": "Новое"}, owner)

    (version,) = list_versions(connection, world.id, "fields")
    restore_version(connection, version.id, world.revision + 1, owner)

    assert note_row(connection, note.id) == changed


def test_lock_and_trash_of_drafts_do_not_touch_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    second = create_draft(connection, project_id, "Драфт 2", draft_id, owner)
    note = create_note(connection, project_id, "Финал", "", owner)
    update_draft(connection, draft_id, {"locked": True})
    update_draft(connection, second.id, {"locked": True})

    changed = update_note(connection, note.id, 1, {"body": "Лодка"}, owner)
    assert changed.body == "Лодка"
    fresh = create_note(connection, project_id, "Вера", "", owner)
    trash_note(connection, fresh.id)
    restore_note(connection, fresh.id)
    trash_note(connection, fresh.id)
    delete_note(connection, fresh.id)

    update_draft(connection, second.id, {"locked": False})
    trash_draft(connection, second.id)
    delete_draft(connection, second.id)
    assert note_row(connection, note.id) == changed


def test_draft_row_deleted_keeps_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    second = create_draft(connection, project_id, "Драфт 2", draft_id, owner)
    note = create_note(connection, project_id, "Финал", "", owner)
    trash_draft(connection, second.id)
    delete_draft(connection, second.id)
    assert list_notes(connection, project_id) == [note]


def test_empty_trash_deletes_notes_of_the_story(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    second = create_draft(connection, project_id, "Драфт 2", draft_id, owner)
    kept = create_note(connection, project_id, "Финал", "", owner)
    gone = create_note(connection, project_id, "Вера", "", owner)
    trash_note(connection, gone.id)

    empty_trash(connection, second.id)

    assert list_notes(connection, project_id) == [kept]


def test_empty_trash_of_a_locked_draft_keeps_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    project_id, draft_id = story
    note = create_note(connection, project_id, "Финал", "", owner)
    trash_note(connection, note.id)
    update_draft(connection, draft_id, {"locked": True})

    with pytest.raises(Locked):
        empty_trash(connection, draft_id)

    assert note_row(connection, note.id).deleted_at is not None


def test_notes_are_not_documents(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    project_id, draft_id = story
    create_note(connection, project_id, "Финал", "", owner)
    create_documents(connection, draft_id, [{"kind": "world", "name": "Мир"}], owner)
    assert {d.kind for d in list_documents(connection, draft_id)} == {"script", "world"}


def test_updated_by_names_the_last_author(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    other = get_or_create_user(connection, "notes-other", "other@authorled.test", "Другой").id
    note = create_note(connection, story[0], "Финал", "", owner)
    assert update_note(connection, note.id, 1, {"body": "Лодка"}, other).updated_by == other

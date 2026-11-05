"""Drafts of a story (openspec/specs/api/stories: «Драфты», «Создание драфта», «Замок драфта», «Драфт в корзине»,
«Последний открытый драфт»)."""

import uuid
from typing import Any

import pytest
from sqlalchemy import Connection, func, text, update

from core.documents import (
    create_documents,
    delete_document,
    list_documents,
    restore_document,
    trash_document,
    update_document,
)
from core.drafts import (
    FIRST_DRAFT,
    count_drafts,
    create_draft,
    delete_draft,
    empty_trash,
    list_drafts,
    open_draft,
    open_draft_id,
    restore_draft,
    trash_draft,
    update_draft,
)
from core.errors import Conflict, Invalid, Locked, NotFound
from core.projects import create_project, list_projects, trash_project
from core.tables import drafts
from core.texts import get_text, heading, put_text, screenplay_id
from core.users import get_or_create_user


def _doc(*blocks: dict[str, Any]) -> dict[str, Any]:
    return {"type": "doc", "content": list(blocks)}


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """The story, its first draft and the owner."""
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, draft, _ = create_project(connection, owner, "Маяк")
    return project.id, draft, owner


def _vera(connection: Connection, draft: uuid.UUID, owner: uuid.UUID) -> Any:
    (vera,) = create_documents(
        connection, draft, [{"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "вода"}}], owner
    )
    return vera


def test_new_story_has_the_first_draft(connection: Connection) -> None:
    project, _, _ = _story(connection)
    (draft,) = list_drafts(connection, project)
    assert (draft.name, draft.locked, draft.forked_from_id) == (FIRST_DRAFT, False, None)


def test_copy_has_the_cards_and_the_passport_outside_the_trash(connection: Connection) -> None:
    project, first, owner = _story(connection)
    vera = _vera(connection, first, owner)
    (misha,) = create_documents(connection, first, [{"kind": "character", "name": "Миша", "role": "main"}], owner)
    trash_document(connection, misha.id)
    script = screenplay_id(connection, first)
    update_document(connection, script, 1, {"fields": {"logline": "О воде"}}, owner)
    second = create_draft(connection, project, " После читки ", first, owner)
    assert (second.name, second.forked_from_id, second.forked_from_name) == ("После читки", first, FIRST_DRAFT)
    tree = {d.name: d for d in list_documents(connection, second.id)}
    assert sorted(tree) == ["Вера", "Маяк"]
    assert tree["Вера"].fields == vera.fields and tree["Вера"].id != vera.id
    assert tree["Маяк"].fields == {"logline": "О воде"}


def test_drafts_are_independent(connection: Connection) -> None:
    project, first, owner = _story(connection)
    vera = _vera(connection, first, owner)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    copy = next(d for d in list_documents(connection, second.id) if d.name == "Вера")
    update_document(connection, copy.id, copy.revision, {"name": "Виктор"}, owner)
    copy_script = screenplay_id(connection, second.id)
    put_text(connection, copy_script, 1, _doc(heading("x", "Другое")), owner)
    names = [d.name for d in list_documents(connection, first)]
    assert "Виктор" not in names and vera.name in names
    assert get_text(connection, screenplay_id(connection, first)).revision == 1


def test_base_from_another_story_is_not_found(connection: Connection) -> None:
    project, _, owner = _story(connection)
    _, other, _ = create_project(connection, owner, "Чужая")
    with pytest.raises(NotFound):
        create_draft(connection, project, "Драфт", other, owner)


def test_base_in_the_trash_is_refused(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    trash_draft(connection, second.id)
    with pytest.raises(Conflict):
        create_draft(connection, project, "Драфт 3", second.id, owner)


def test_empty_name_is_refused(connection: Connection) -> None:
    project, first, owner = _story(connection)
    with pytest.raises(Invalid):
        create_draft(connection, project, " ", first, owner)
    with pytest.raises(Invalid):
        update_draft(connection, first, {"name": " "})


def test_label_stays_after_the_base_is_gone(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    trash_draft(connection, first)
    delete_draft(connection, first)
    (left,) = list_drafts(connection, project)
    assert (left.id, left.forked_from_id, left.forked_from_name) == (second.id, None, FIRST_DRAFT)


def test_lock_stops_every_change_of_the_contents(connection: Connection) -> None:
    project, draft, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    (misha,) = create_documents(connection, draft, [{"kind": "character", "name": "Миша", "role": "main"}], owner)
    trash_document(connection, misha.id)
    update_draft(connection, draft, {"locked": True})
    script = screenplay_id(connection, draft)
    with pytest.raises(Locked):
        update_document(connection, vera.id, vera.revision, {"name": "Вера Андреевна"}, owner)
    with pytest.raises(Locked):
        put_text(connection, script, 1, _doc(heading("x", "Нельзя")), owner)
    with pytest.raises(Locked):
        create_documents(connection, draft, [{"kind": "world", "name": "Мир"}], owner)
    with pytest.raises(Locked):
        trash_document(connection, vera.id)
    with pytest.raises(Locked):
        restore_document(connection, misha.id)
    with pytest.raises(Locked):
        delete_document(connection, misha.id)
    with pytest.raises(Locked):
        empty_trash(connection, draft)


def test_locked_draft_can_be_renamed_copied_and_opened_again(connection: Connection) -> None:
    project, draft, owner = _story(connection)
    update_draft(connection, draft, {"locked": True})
    assert update_draft(connection, draft, {"name": "Запертый"}).name == "Запертый"
    copy = create_draft(connection, project, "Копия", draft, owner)
    assert copy.locked is False
    update_draft(connection, draft, {"locked": False})
    put_text(connection, screenplay_id(connection, draft), 1, _doc(heading("x", "Можно")), owner)


def test_lock_must_be_a_flag(connection: Connection) -> None:
    _, draft, _ = _story(connection)
    with pytest.raises(Invalid):
        update_draft(connection, draft, {"locked": "да"})


def test_last_draft_stays(connection: Connection) -> None:
    project, first, owner = _story(connection)
    with pytest.raises(Conflict):
        trash_draft(connection, first)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    trash_draft(connection, first)
    with pytest.raises(Conflict):
        trash_draft(connection, second.id)


def test_trash_keeps_the_contents(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    _vera(connection, second.id, owner)
    trash_draft(connection, second.id)
    assert count_drafts(connection, project) == 1
    script = screenplay_id(connection, second.id)
    with pytest.raises(Conflict):
        put_text(connection, script, 1, _doc(heading("x", "Нельзя")), owner)
    restore_draft(connection, second.id)
    assert [d.name for d in list_documents(connection, second.id) if d.kind == "character"] == ["Вера"]


def test_only_a_draft_in_the_trash_is_deleted(connection: Connection) -> None:
    _, first, _ = _story(connection)
    with pytest.raises(Conflict):
        delete_draft(connection, first)


def test_emptying_the_trash_keeps_other_drafts_documents(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    third = create_draft(connection, project, "Драфт 3", first, owner)
    trash_document(connection, _vera(connection, first, owner).id)
    other = _vera(connection, second.id, owner)
    trash_document(connection, other.id)
    trash_draft(connection, third.id)
    empty_trash(connection, first)
    assert [d.kind for d in list_documents(connection, first)] == ["script"]
    assert other.id in [d.id for d in list_documents(connection, second.id)]
    assert [d.id for d in list_drafts(connection, project)] == [first, second.id]


def test_story_opens_in_the_last_opened_draft(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    open_draft(connection, first, owner)
    assert open_draft_id(connection, owner, project) == first
    open_draft(connection, second.id, owner)
    (listed,) = list_projects(connection, owner, trash=False)
    assert (listed.open_draft_id, listed.drafts_count) == (second.id, 2)


def test_open_draft_in_the_trash_gives_way_to_the_latest(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    third = create_draft(connection, project, "Драфт 3", first, owner)
    open_draft(connection, second.id, owner)
    trash_draft(connection, second.id)
    connection.execute(
        update(drafts).where(drafts.c.id == third.id).values(updated_at=func.now() + text("interval '1 hour'"))
    )
    assert open_draft_id(connection, owner, project) == third.id
    with pytest.raises(Conflict):
        open_draft(connection, second.id, owner)


def test_saving_makes_a_draft_the_latest(connection: Connection) -> None:
    project, first, owner = _story(connection)
    second = create_draft(connection, project, "Драфт 2", first, owner)
    connection.execute(
        update(drafts).where(drafts.c.id == second.id).values(updated_at=func.now() - text("interval '1 hour'"))
    )
    connection.execute(
        update(drafts).where(drafts.c.id == first).values(updated_at=func.now() - text("interval '2 hours'"))
    )
    put_text(connection, screenplay_id(connection, first), 1, _doc(heading("x", "Свежее")), owner)
    assert open_draft_id(connection, owner, project) == first


def test_draft_of_a_story_in_the_trash_refuses_changes(connection: Connection) -> None:
    project, first, _ = _story(connection)
    trash_project(connection, project)
    with pytest.raises(Conflict):
        update_draft(connection, first, {"name": "Новое"})

"""Saves of a draft (openspec/specs/api/stories: «Снимки документа», «История документа», «Откат документа»,
«Точка драфта», «Откат к точке»)."""

import uuid
from typing import Any

import pytest
from sqlalchemy import Connection, func, select, text, update

from core.documents import create_documents, delete_document, document_row, list_documents, trash_document
from core.documents import update_document as change
from core.drafts import create_draft, update_draft
from core.errors import Conflict, Invalid, Locked, NotFound
from core.projects import create_project
from core.review import create_suggestion, create_thread, decide
from core.saves import create_point, get_version, list_points, list_versions, restore_point, restore_version
from core.tables import document_versions
from core.texts import get_text, heading, put_text, screenplay_id
from core.users import get_or_create_user


def _doc(title: str, *blocks: dict[str, Any]) -> dict[str, Any]:
    return {"type": "doc", "content": [heading("s1", title), *blocks]}


def _marked(kind: str, mark_id: str) -> dict[str, Any]:
    mark = {"type": kind, "attrs": {"id": mark_id}}
    return {"type": "action", "content": [{"type": "text", "text": "Вера молчит", "marks": [mark]}]}


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """The draft, its screenplay and the owner."""
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    _, draft, script = create_project(connection, owner, "Маяк")
    return draft, script, owner


def _vera(connection: Connection, draft: uuid.UUID, owner: uuid.UUID) -> Any:
    (vera,) = create_documents(
        connection, draft, [{"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "вода"}}], owner
    )
    return vera


def _age(connection: Connection) -> None:
    """Every snapshot is older than the interval of automatic snapshots."""
    connection.execute(update(document_versions).values(created_at=func.now() - text("interval '11 minutes'")))


def test_frequent_saves_keep_one_snapshot(connection: Connection) -> None:
    _, script, owner = _story(connection)
    for revision in range(1, 6):
        put_text(connection, script, revision, _doc(f"Правка {revision}"), owner)
    assert len(list_versions(connection, script, "text")) == 1


def test_snapshot_keeps_the_state_before_the_save(connection: Connection) -> None:
    _, script, owner = _story(connection)
    put_text(connection, script, 1, _doc("Было"), owner)
    _age(connection)
    put_text(connection, script, 2, _doc("Стало"), owner)
    newest = list_versions(connection, script, "text")[0]
    assert newest.reason == "auto"
    assert newest.content == _doc("Было")
    assert (newest.saved_by, newest.saved_by_name) == (owner, "Сценарист")


def test_parts_are_independent(connection: Connection) -> None:
    _, script, owner = _story(connection)
    change(connection, script, 1, {"fields": {"logline": "О воде"}}, owner)
    assert len(list_versions(connection, script, "fields")) == 1
    assert list_versions(connection, script, "text") == []


def test_position_alone_keeps_no_snapshot(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    change(connection, vera.id, vera.revision, {"position": 0}, owner)
    assert list_versions(connection, vera.id, "fields") == []


def test_refused_save_keeps_no_snapshot(connection: Connection) -> None:
    _, script, owner = _story(connection)
    with pytest.raises(Conflict):
        put_text(connection, script, 7, _doc("Устарело"), owner)
    assert list_versions(connection, script, "text") == []


def test_unknown_part_is_named(connection: Connection) -> None:
    _, script, _ = _story(connection)
    with pytest.raises(Invalid) as error:
        list_versions(connection, script, "cover")
    assert error.value.field == "part"


def test_missing_version_is_not_found(connection: Connection) -> None:
    with pytest.raises(NotFound):
        get_version(connection, uuid.uuid4())


def test_rollback_of_a_card_touches_nothing_else(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    changed = change(connection, vera.id, vera.revision, {"name": "Виктор", "fields": {"age": "30"}}, owner)
    put_text(connection, script, 1, _doc("Текст"), owner)
    (version,) = list_versions(connection, vera.id, "fields")
    revision = restore_version(connection, version.id, changed.revision, owner)
    restored = document_row(connection, vera.id)
    assert (restored.name, restored.fields, restored.revision) == ("Вера", {"fear": "вода"}, revision)
    assert get_text(connection, script).content == _doc("Текст")


def test_rollback_keeps_the_present_text(connection: Connection) -> None:
    _, script, owner = _story(connection)
    put_text(connection, script, 1, _doc("Было"), owner)
    _age(connection)
    put_text(connection, script, 2, _doc("Стало"), owner)
    version = next(v for v in list_versions(connection, script, "text") if v.content == _doc("Было"))
    assert restore_version(connection, version.id, 3, owner) == 4
    assert get_text(connection, script).content == _doc("Было")
    newest = list_versions(connection, script, "text")[0]
    assert (newest.reason, newest.content) == ("restore", _doc("Стало"))


def test_rollback_on_an_old_revision_is_refused(connection: Connection) -> None:
    _, script, owner = _story(connection)
    put_text(connection, script, 1, _doc("Было"), owner)
    (version,) = list_versions(connection, script, "text")
    with pytest.raises(Conflict):
        restore_version(connection, version.id, 1, owner)
    assert get_text(connection, script).content == _doc("Было")


def test_rollback_in_a_locked_draft_is_refused(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    put_text(connection, script, 1, _doc("Было"), owner)
    (version,) = list_versions(connection, script, "text")
    update_draft(connection, draft, {"locked": True})
    with pytest.raises(Locked):
        restore_version(connection, version.id, 2, owner)


def test_rollback_drops_marks_of_gone_review(connection: Connection) -> None:
    _, script, owner = _story(connection)
    thread = uuid.uuid4()
    create_thread(connection, script, thread, "Вера", "Да", owner, "")
    put_text(connection, script, 1, _doc("Сцена", _marked("comment", str(thread))), owner)
    put_text(connection, script, 2, _doc("Сцена", _marked("comment", "gone")), owner)
    _age(connection)
    put_text(connection, script, 3, _doc("Сцена"), owner)
    old = next(v for v in list_versions(connection, script, "text") if "gone" in str(v.content))
    restore_version(connection, old.id, 4, owner)
    assert "marks" not in get_text(connection, script).content["content"][1]["content"][0]


def test_rollback_keeps_marks_of_live_review_and_drops_decided_suggestions(connection: Connection) -> None:
    _, script, owner = _story(connection)
    put_text(
        connection, script, 1, _doc("Сцена", {"type": "action", "content": [{"type": "text", "text": "Вера"}]}), owner
    )
    open_one = create_suggestion(connection, script, "s1", "Вера", "Аня", "", "x:y:z")
    decided = create_suggestion(connection, script, "s1", "Вера", "Оля", "", "x:y:z")
    decide(connection, decided.id, "rejected")
    thread = uuid.uuid4()
    create_thread(connection, script, thread, "Вера", "Да", owner, "")
    marked = _doc(
        "Сцена",
        _marked("suggestion", str(open_one.id)),
        _marked("suggestion", str(decided.id)),
        _marked("comment", str(thread)),
    )
    put_text(connection, script, 2, marked, owner)
    create_point_id = create_point(connection, screenplay_draft(connection, script), "Метки", owner).id
    put_text(connection, script, 3, _doc("Сцена"), owner)
    restore_point(connection, create_point_id, owner)
    blocks = get_text(connection, script).content["content"]
    assert "marks" in blocks[1]["content"][0]
    assert "marks" not in blocks[2]["content"][0]
    assert "marks" in blocks[3]["content"][0]


def screenplay_draft(connection: Connection, script: uuid.UUID) -> uuid.UUID:
    return document_row(connection, script).draft_id


def test_point_needs_a_name(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    with pytest.raises(Invalid):
        create_point(connection, draft, " ", owner)
    assert list_points(connection, draft) == []


def test_points_belong_to_their_draft(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    point = create_point(connection, draft, " до смены героини ", owner)
    assert (point.name, point.kind, point.created_by_name) == ("до смены героини", "manual", "Сценарист")
    project = document_row(connection, script).project_id
    second = create_draft(connection, project, "Драфт 2", draft, owner)
    assert list_points(connection, second.id) == []


def test_rollback_to_a_point_returns_the_card_and_the_text(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    put_text(connection, script, 1, _doc("С Верой"), owner)
    point = create_point(connection, draft, "до смены героини", owner)
    change(connection, vera.id, vera.revision, {"name": "Виктор"}, owner)
    put_text(connection, script, 2, _doc("С Виктором"), owner)
    saved = restore_point(connection, point.id, owner)
    assert saved.kind == "auto" and saved.name == "Перед откатом к «до смены героини»"
    restored = document_row(connection, vera.id)
    assert restored.name == "Вера"
    assert restored.revision > vera.revision + 1
    text_now = get_text(connection, script)
    assert (text_now.content, text_now.revision) == (_doc("С Верой"), 4)


def test_unchanged_parts_keep_their_revision(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    point = create_point(connection, draft, "Точка", owner)
    restore_point(connection, point.id, owner)
    assert document_row(connection, vera.id).revision == vera.revision
    assert get_text(connection, script).revision == 1


def test_document_made_after_the_point_goes_to_the_trash(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    point = create_point(connection, draft, "Точка", owner)
    nina = _vera(connection, draft, owner)
    restore_point(connection, point.id, owner)
    assert document_row(connection, nina.id).deleted_at is not None


def test_document_of_the_point_comes_back_from_the_trash(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    point = create_point(connection, draft, "Точка", owner)
    trash_document(connection, vera.id)
    restore_point(connection, point.id, owner)
    assert document_row(connection, vera.id).deleted_at is None


def test_document_deleted_for_good_comes_back(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    vera = _vera(connection, draft, owner)
    point = create_point(connection, draft, "Точка", owner)
    trash_document(connection, vera.id)
    delete_document(connection, vera.id)
    restore_point(connection, point.id, owner)
    back = document_row(connection, vera.id)
    assert (back.name, back.fields, back.role) == ("Вера", {"fear": "вода"}, "main")


def test_rollback_can_be_undone(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    point = create_point(connection, draft, "Точка", owner)
    nina = _vera(connection, draft, owner)
    put_text(connection, script, 1, _doc("После точки"), owner)
    saved = restore_point(connection, point.id, owner)
    restore_point(connection, saved.id, owner)
    assert get_text(connection, script).content == _doc("После точки")
    assert document_row(connection, nina.id).deleted_at is None


def test_rollback_to_a_point_in_a_locked_draft_is_refused(connection: Connection) -> None:
    draft, _, owner = _story(connection)
    point = create_point(connection, draft, "Точка", owner)
    update_draft(connection, draft, {"locked": True})
    with pytest.raises(Locked):
        restore_point(connection, point.id, owner)
    assert len(list_points(connection, draft)) == 1


def test_missing_point_is_not_found(connection: Connection) -> None:
    _, _, owner = _story(connection)
    with pytest.raises(NotFound):
        restore_point(connection, uuid.uuid4(), owner)


def test_snapshots_stay_with_their_draft(connection: Connection) -> None:
    draft, script, owner = _story(connection)
    put_text(connection, script, 1, _doc("Было"), owner)
    project = document_row(connection, script).project_id
    second = create_draft(connection, project, "Драфт 2", draft, owner)
    assert list_versions(connection, screenplay_id(connection, second.id), "text") == []
    assert connection.execute(select(func.count()).select_from(document_versions)).scalar_one() == 1
    assert [d.kind for d in list_documents(connection, second.id)] == ["script"]

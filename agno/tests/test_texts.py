"""Text of the screenplay and drafts (openspec/specs/api/stories: «Текст сценария», «Проверка текста», «Драфты»)."""

import copy
import json
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Connection

from core.documents import update_document
from core.errors import Conflict, Invalid, Locked, NotFound
from core.projects import create_project
from core.texts import ELEMENT_NAMES, create_draft, get_text, heading, put_text, scenes, validate_text
from core.users import get_or_create_user

REPO = Path(__file__).resolve().parents[2]
WEB_FIXTURES = Path(__file__).parent / "fixtures" / "texts" / "web-fixtures.json"


def _doc(*blocks: dict[str, Any]) -> dict[str, Any]:
    return {"type": "doc", "content": list(blocks)}


def _p(kind: str, text: str = "", marks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if not text:
        return {"type": kind}
    node: dict[str, Any] = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return {"type": kind, "content": [node]}


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID]:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, script_id = create_project(connection, owner, "Маяк")
    return project.id, script_id


def test_element_names_match_the_editor() -> None:
    source = (REPO / "web" / "src" / "editor" / "elements.ts").read_text()
    union = re.search(r"export type ElementName =(.*?);", source, re.S)
    assert union is not None
    assert tuple(re.findall(r'"(\w+)"', union.group(1))) == ELEMENT_NAMES


def test_mark_colors_match_the_editor() -> None:
    source = (REPO / "web" / "src" / "editor" / "elements.ts").read_text()
    colors = re.search(r"export const MARK_COLORS = \[(.*?)\]", source)
    assert colors is not None
    assert tuple(re.findall(r'"(\w+)"', colors.group(1))) == ("1", "2", "3", "4")


def test_frontend_fixtures_pass() -> None:
    for item in json.loads(WEB_FIXTURES.read_text())["texts"]:
        validate_text(item["text"])


def test_every_paragraph_type_and_mark_passes() -> None:
    blocks = [heading("s1", "ИНТ. КУХНЯ — ДЕНЬ")]
    blocks += [_p(kind, "текст") for kind in ELEMENT_NAMES if kind != "sceneHeading"]
    blocks.append({"type": "pageBreak"})
    blocks.append(
        _p(
            "action",
            "Вера",
            [
                {"type": "bold"},
                {"type": "italic"},
                {"type": "underline"},
                {"type": "textColor", "attrs": {"color": "2"}},
                {"type": "highlight", "attrs": {"color": "4"}},
                {"type": "comment", "attrs": {"id": "c1"}},
                {"type": "suggestion", "attrs": {"id": "p1"}},
            ],
        )
    )
    validate_text(_doc(*blocks))


def test_scene_without_uid_is_named() -> None:
    with pytest.raises(Invalid, match="Абзац 2 .*uid"):
        validate_text(_doc(heading("s1"), {"type": "sceneHeading"}))


def test_repeated_uid_is_refused() -> None:
    with pytest.raises(Invalid, match="повторяется"):
        validate_text(_doc(heading("s1"), heading("s1")))


def test_unknown_paragraph_type_is_named() -> None:
    with pytest.raises(Invalid, match="chorus"):
        validate_text(_doc(heading("s1"), _p("chorus", "Ля")))


@pytest.mark.parametrize(
    "mark",
    [{"type": "strike"}, {"type": "textColor", "attrs": {"color": "9"}}, {"type": "comment", "attrs": {"id": ""}}],
)
def test_bad_marks_are_refused(mark: dict[str, Any]) -> None:
    with pytest.raises(Invalid):
        validate_text(_doc(heading("s1"), _p("action", "Вера", [mark])))


def test_empty_text_node_is_refused() -> None:
    with pytest.raises(Invalid):
        validate_text(_doc({"type": "action", "content": [{"type": "text", "text": ""}]}))


def test_scenes_end_at_groups_and_acts() -> None:
    doc = _doc(
        _p("act", "Акт"),
        heading("a", "НАТ. ОЗЕРО — ДЕНЬ"),
        _p("action", "Вода"),
        _p("sequence", "Группа"),
        _p("action", "Вне сцены"),
        heading("b", "ИНТ. ДОМ — НОЧЬ"),
    )
    found = scenes(doc)
    assert [(s.uid, s.number, len(s.blocks)) for s in found] == [("a", 1, 2), ("b", 2, 1)]


def test_save_with_revision(connection: Connection) -> None:
    _, script_id = _story(connection)
    text = get_text(connection, script_id)
    saved = put_text(connection, script_id, text.revision, _doc(heading("s1", "ИНТ. КУХНЯ — ДЕНЬ")))
    assert saved.revision == text.revision + 1
    assert get_text(connection, script_id).content["content"][0]["content"][0]["text"] == "ИНТ. КУХНЯ — ДЕНЬ"


def test_old_revision_keeps_the_text(connection: Connection) -> None:
    _, script_id = _story(connection)
    text = get_text(connection, script_id)
    put_text(connection, script_id, text.revision, _doc(heading("s1", "Первая")))
    with pytest.raises(Conflict):
        put_text(connection, script_id, text.revision, _doc(heading("s1", "Вторая")))
    assert get_text(connection, script_id).content["content"][0]["content"][0]["text"] == "Первая"


def test_draft_is_a_copy_without_review_marks(connection: Connection) -> None:
    project_id, script_id = _story(connection)
    text = get_text(connection, script_id)
    marked = _doc(
        heading("s1", "ИНТ. КУХНЯ — ДЕНЬ"),
        _p("action", "Вера смотрит", [{"type": "comment", "attrs": {"id": "c1"}}, {"type": "bold"}]),
    )
    put_text(connection, script_id, text.revision, copy.deepcopy(marked))
    draft_id = create_draft(connection, project_id, "Первый", script_id, locked=True)
    content = get_text(connection, draft_id).content
    assert content["content"][1]["content"][0]["marks"] == [{"type": "bold"}]
    with pytest.raises(Locked):
        put_text(connection, draft_id, 1, marked)


def test_unlocked_draft_can_be_edited(connection: Connection) -> None:
    project_id, script_id = _story(connection)
    draft_id = create_draft(connection, project_id, "Черновик", script_id, locked=False)
    put_text(connection, draft_id, 1, _doc(heading("x", "Правка драфта")))
    assert get_text(connection, script_id).revision == 1


def test_lock_is_changed_through_the_document(connection: Connection) -> None:
    project_id, script_id = _story(connection)
    draft_id = create_draft(connection, project_id, "Черновик", script_id, locked=True)
    update_document(connection, draft_id, 1, {"fields": {"locked": False}})
    put_text(connection, draft_id, 1, _doc(heading("x", "Можно")))


def test_draft_base_from_another_story_is_not_found(connection: Connection) -> None:
    project_id, _ = _story(connection)
    owner = get_or_create_user(connection, "s2", "other@authorled.test", "Другой").id
    _, other_script = create_project(connection, owner, "Чужая")
    with pytest.raises(NotFound):
        create_draft(connection, project_id, "Драфт", other_script, locked=True)


def test_empty_draft_name_is_refused(connection: Connection) -> None:
    project_id, script_id = _story(connection)
    with pytest.raises(Invalid):
        create_draft(connection, project_id, " ", script_id, locked=True)

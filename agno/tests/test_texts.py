"""Text of the screenplay and drafts (openspec/specs/api/stories: «Текст сценария», «Проверка текста», «Драфты»)."""

import json
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Connection

from core.errors import Conflict, Invalid
from core.projects import create_project
from core.texts import ELEMENT_NAMES, get_text, heading, put_text, scenes, validate_text
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
    _, _, script_id = create_project(connection, owner, "Маяк")
    return owner, script_id


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
    owner, script_id = _story(connection)
    text = get_text(connection, script_id)
    saved = put_text(connection, script_id, text.revision, _doc(heading("s1", "ИНТ. КУХНЯ — ДЕНЬ")), owner)
    assert saved.revision == text.revision + 1
    assert get_text(connection, script_id).content["content"][0]["content"][0]["text"] == "ИНТ. КУХНЯ — ДЕНЬ"


def test_old_revision_keeps_the_text(connection: Connection) -> None:
    owner, script_id = _story(connection)
    text = get_text(connection, script_id)
    put_text(connection, script_id, text.revision, _doc(heading("s1", "Первая")), owner)
    with pytest.raises(Conflict):
        put_text(connection, script_id, text.revision, _doc(heading("s1", "Вторая")), owner)
    assert get_text(connection, script_id).content["content"][0]["content"][0]["text"] == "Первая"

"""Structure templates as data and the text of a story from a template.

openspec/specs/api/stories: «Каркасы историй», «Текст из каркаса».
"""

import copy
from pathlib import Path
from typing import Any

import pytest

from core import texts
from core.errors import Invalid
from core.story_templates import StoryTemplatesError, parse, read, screenplay, template, templates

POINT = {"name": "Обычный мир", "hint": "Как живёт герой?"}
ACT = {"name": "Завязка", "point": [POINT]}
TEMPLATE = {"id": "three-acts", "name": "Три акта", "description": "Завязка, развитие, развязка.", "act": [ACT]}


def _file(**changes: Any) -> dict[str, Any]:
    return {"template": [{**copy.deepcopy(TEMPLATE), **changes}]}


def test_release_templates() -> None:
    assert [found.id for found in templates()] == ["three-acts", "hero-journey", "fifteen-points", "tv-episode"]
    assert template("three-acts").name == "Три акта"
    assert sum(len(act.points) for act in template("hero-journey").acts) == 12
    assert sum(len(act.points) for act in template("fifteen-points").acts) == 15


def test_release_file_has_no_foreign_names() -> None:
    text = Path(texts.__file__).with_name("story_templates.toml").read_text(encoding="utf-8").lower()
    assert "save the cat" not in text


@pytest.mark.parametrize(
    ("data", "named"),
    [
        (_file(act=[{"name": "Развязка", "point": []}]), ("three-acts", "Развязка", "point")),
        (_file(act=[{"name": "Развязка"}]), ("three-acts", "Развязка", "point")),
        (_file(act=[]), ("three-acts", "act")),
        (_file(color="red"), ("three-acts", "color")),
        (_file(name="  "), ("three-acts", "name")),
        (_file(act=[{"name": "Завязка", "point": [{"name": "Обычный мир", "hint": ""}]}]), ("three-acts", "hint")),
        (_file(act=[{"name": "Завязка", "point": [{**POINT, "note": "x"}]}]), ("three-acts", "note")),
        ({"template": []}, ("template",)),
        ({}, ("template",)),
    ],
)
def test_broken_file_is_named(data: dict[str, Any], named: tuple[str, ...]) -> None:
    with pytest.raises(StoryTemplatesError) as error:
        parse(data, "story_templates.toml")
    message = str(error.value)
    assert "story_templates.toml" in message
    for part in named:
        assert part in message


def test_repeated_id() -> None:
    data = {"template": [copy.deepcopy(TEMPLATE), copy.deepcopy(TEMPLATE)]}
    with pytest.raises(StoryTemplatesError, match="three-acts.*повторяется"):
        parse(data, "story_templates.toml")


def test_unreadable_file(tmp_path: Path) -> None:
    broken = tmp_path / "story_templates.toml"
    broken.write_text("[[template]\n", encoding="utf-8")
    with pytest.raises(StoryTemplatesError, match="story_templates.toml"):
        read(broken)


def test_text_of_three_acts() -> None:
    doc = screenplay("three-acts")
    assert texts.validate_text(doc) is doc
    blocks = doc["content"]
    first = template("three-acts").acts[0]
    assert [block["type"] for block in blocks[:4]] == ["act", "sequence", "sceneHeading", "beat"]
    assert texts.block_text(blocks[0]) == first.name
    assert texts.block_text(blocks[1]) == first.points[0].name
    assert texts.block_text(blocks[2]) == ""
    assert texts.block_text(blocks[3]) == first.points[0].hint
    headings = [block for block in blocks if block["type"] == "sceneHeading"]
    assert len(headings) == sum(len(act.points) for act in template("three-acts").acts)
    assert len({block["attrs"]["uid"] for block in headings}) == len(headings)


@pytest.mark.parametrize("template_id", [found.id for found in templates()])
def test_every_template_makes_valid_text(template_id: str) -> None:
    texts.validate_text(screenplay(template_id))


@pytest.mark.parametrize("value", ["save-the-dog", None, 3, ""])
def test_unknown_template(value: Any) -> None:
    with pytest.raises(Invalid) as error:
        screenplay(value)
    assert str(value) in error.value.detail
    assert error.value.field == "template"

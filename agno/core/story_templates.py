"""Structure templates of a new story (openspec/specs/api/stories, «Каркасы историй», «Текст из каркаса»).

The templates are data: `story_templates.toml` next to this module. Every field is required, unknown fields are
refused, so a broken file stops the API at startup instead of creating a broken story. A template becomes ordinary
screenplay text: an act paragraph per act, then per point a group with its name, an empty scene heading and a beat
with its hint.
"""

import tomllib
import uuid
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from core.errors import Invalid
from core.texts import Doc, heading

TEMPLATES_FILE = Path(__file__).with_name("story_templates.toml")


class StoryTemplatesError(Exception):
    """The templates file breaks its format; the message names the file, the template and the place."""


@dataclass(frozen=True)
class Point:
    name: str
    hint: str


@dataclass(frozen=True)
class Act:
    name: str
    points: tuple[Point, ...]


@dataclass(frozen=True)
class StoryTemplate:
    id: str
    name: str
    description: str
    acts: tuple[Act, ...]


def _table(where: str, value: Any, required: tuple[str, ...], lists: tuple[str, ...] = ()) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise StoryTemplatesError(f"{where}: должна быть таблица.")
    missing = [name for name in (*required, *lists) if name not in value]
    if missing:
        raise StoryTemplatesError(f"{where}: нет поля «{missing[0]}».")
    extra = sorted(set(value) - set(required) - set(lists))
    if extra:
        raise StoryTemplatesError(f"{where}: неизвестное поле «{extra[0]}».")
    for name in required:
        if not isinstance(value[name], str) or not value[name].strip():
            raise StoryTemplatesError(f"{where}: поле «{name}» должно быть непустой строкой.")
    for name in lists:
        if not isinstance(value[name], list) or not value[name]:
            raise StoryTemplatesError(f"{where}: в «{name}» должен быть хотя бы один элемент.")
    return value


def parse(data: Any, source: str) -> tuple[StoryTemplate, ...]:
    """The templates of a parsed file; `source` names the file in the errors."""
    root = _table(source, data, (), ("template",))
    templates: list[StoryTemplate] = []
    seen: set[str] = set()
    for index, raw in enumerate(root["template"], start=1):
        where = f"{source}, каркас {index}"
        if isinstance(raw, dict) and isinstance(raw.get("id"), str):
            where = f"{source}, каркас «{raw['id']}»"
        table = _table(where, raw, ("id", "name", "description"), ("act",))
        if table["id"] in seen:
            raise StoryTemplatesError(f"{where}: id повторяется.")
        seen.add(table["id"])
        acts: list[Act] = []
        for act_index, raw_act in enumerate(table["act"], start=1):
            act_where = f"{where}, акт {act_index}"
            if isinstance(raw_act, dict) and isinstance(raw_act.get("name"), str):
                act_where = f"{where}, акт «{raw_act['name']}»"
            act = _table(act_where, raw_act, ("name",), ("point",))
            points = tuple(
                Point(**_table(f"{act_where}, точка {point_index}", raw_point, ("name", "hint")))
                for point_index, raw_point in enumerate(act["point"], start=1)
            )
            acts.append(Act(name=act["name"], points=points))
        templates.append(
            StoryTemplate(id=table["id"], name=table["name"], description=table["description"], acts=tuple(acts))
        )
    return tuple(templates)


def read(path: Path) -> tuple[StoryTemplate, ...]:
    """Read and check a templates file."""
    try:
        with path.open("rb") as file:
            data = tomllib.load(file)
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise StoryTemplatesError(f"{path.name}: {error}") from error
    return parse(data, path.name)


@cache
def templates() -> tuple[StoryTemplate, ...]:
    """The templates of the repository file, read once per process."""
    return read(TEMPLATES_FILE)


def template(template_id: Any) -> StoryTemplate:
    """The template by id; anything else is refused with the value."""
    if isinstance(template_id, str):
        for found in templates():
            if found.id == template_id:
                return found
    raise Invalid(
        f"Каркаса «{template_id}» нет. Есть: {', '.join(found.id for found in templates())}.", field="template"
    )


def _block(kind: str, text: str) -> dict[str, Any]:
    return {"type": kind, "content": [{"type": "text", "text": text}]}


def screenplay(template_id: Any) -> Doc:
    """The text of a new story from the template: acts, and per point a group, an empty scene and a beat."""
    found = template(template_id)
    blocks: list[dict[str, Any]] = []
    for act in found.acts:
        blocks.append(_block("act", act.name))
        for point in act.points:
            blocks.append(_block("sequence", point.name))
            blocks.append(heading(str(uuid.uuid4())))
            blocks.append(_block("beat", point.hint))
    return {"type": "doc", "content": blocks}

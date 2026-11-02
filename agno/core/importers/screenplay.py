"""The editor document from parsed paragraphs, and the cast and places of a text (openspec/specs/api/story-import).

Every scene heading gets a new uid; the result passes the same check as a saved text. Names follow
«Найти всех персонажей / все локации в тексте» of web/src/editor/scenes.ts (castFromText, placesFromText).
"""

import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from core.errors import Invalid
from core.texts import Doc, block_text, validate_text


@dataclass(frozen=True)
class Run:
    text: str
    marks: tuple[str, ...] = ()


@dataclass(frozen=True)
class Paragraph:
    """A paragraph of an editor type, or "pageBreak"; `scene` holds the parameters of a scene heading."""

    kind: str
    runs: tuple[Run, ...] = ()
    scene: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def plain(kind: str, text: str) -> Paragraph:
        return Paragraph(kind, (Run(text),) if text else ())


def build_doc(paragraphs: list[Paragraph]) -> Doc:
    """The editor document of a manuscript; a file without paragraphs is refused."""
    if not paragraphs:
        raise Invalid("В файле нет абзацев сценария.")
    blocks: list[dict[str, Any]] = []
    for paragraph in paragraphs:
        if paragraph.kind == "pageBreak":
            blocks.append({"type": "pageBreak"})
            continue
        block: dict[str, Any] = {"type": paragraph.kind}
        if paragraph.kind == "sceneHeading":
            block["attrs"] = {"alt": "", "day": "", "color": None, "tags": [], **paragraph.scene}
            block["attrs"]["uid"] = str(uuid.uuid4())
        content = []
        for run in paragraph.runs:
            if run.text:
                node: dict[str, Any] = {"type": "text", "text": run.text}
                if run.marks:
                    node["marks"] = [{"type": mark} for mark in run.marks]
                content.append(node)
        if content:
            block["content"] = content
        blocks.append(block)
    return validate_text({"type": "doc", "content": blocks})


def title_case(name: str) -> str:
    """«ВЕРА АНДРЕЕВНА» → «Вера Андреевна», as titleCase of the frontend."""
    return "".join(
        part if part.strip() == "" or part == "-" else part[0].upper() + part[1:]
        for part in re.split(r"(\s+|-)", name.lower())
    )


def _unique(names: list[str]) -> list[str]:
    seen: set[str] = set()
    found = []
    for name in names:
        key = name.upper()
        if len(name) >= 2 and key not in seen:
            seen.add(key)
            found.append(name)
    return found


_PLACE = re.compile(
    r"^(?:ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.|INT\.\/EXT\.|INT\.|EXT\.)\s+(.+?)(?:\s+[—-](?:\s+.*)?)?$", re.IGNORECASE
)


def cast_from_text(doc: Doc) -> list[str]:
    """Names of the character cues without the marks in brackets, in title case, without repeats."""
    names = [
        re.sub(r"\s*\(.*?\)\s*$", "", block_text(block)).strip()
        for block in doc["content"]
        if block["type"] == "character"
    ]
    return [title_case(name) for name in _unique(names)]


def places_from_text(doc: Doc) -> list[str]:
    """Places of the scene headings: between ИНТ./НАТ. (INT./EXT.) and the dash before the time of day."""
    places = []
    for block in doc["content"]:
        if block["type"] == "sceneHeading":
            match = _PLACE.match(block_text(block).strip())
            if match:
                places.append(match.group(1).strip())
    return [title_case(place) for place in _unique(places)]

"""STARC projects (.starc: a SQLite base of XML documents) to paragraphs, read only (openspec/specs/api/story-import).

STARC has no public format specification, so only what a real file of STARC 0.8.2 showed is read. Anything else is
refused whole, so that nothing is lost silently. What is still to confirm on a fuller sample: group 4 of
openspec/changes/starc-import/tasks.md. The role of a character is not read until then: only one value was seen,
and the import adds everyone as episodic.
"""

import sqlite3
import tempfile
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from core.errors import Invalid
from core.importers.screenplay import Paragraph, title_case

MIME = "application/x-starc/document/"
STRUCTURE = 1
SCREENPLAY_TEXT = 10104

TYPE_OF = {
    "scene_heading": "sceneHeading",
    "action": "action",
    "character": "character",
    "parenthetical": "parenthetical",
    "dialogue": "dialogue",
}


@dataclass(frozen=True)
class StarcProject:
    paragraphs: list[Paragraph]
    characters: list[str]
    locations: list[str]


def _xml(content: object, mime: str) -> ElementTree.Element:
    if not isinstance(content, bytes):
        raise Invalid(f"Это не проект STARC: документ «{mime}» пуст.")
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as error:
        raise Invalid(f"Документ STARC «{mime}» не разобран как XML: {error}.") from error
    if root.tag != "document" or root.get("mime-type") != MIME + mime:
        raise Invalid(f"Это не проект STARC: вместо документа «{mime}» другой документ.")
    return root


def _items(parent: ElementTree.Element) -> Iterator[ElementTree.Element]:
    """The tree of the project without its trash: what the author deleted is not imported."""
    for item in parent.iterfind("item"):
        if item.get("type") != MIME + "recycle-bin":
            yield item
            yield from _items(item)


def _names(items: list[ElementTree.Element], kind: str) -> list[str]:
    """Names of the project; STARC keeps them in capitals like cues, the story in title case like cast_from_text."""
    names = []
    for item in items:
        if item.get("type") == MIME + kind:
            name = (item.get("name") or "").strip()
            if not name:
                raise Invalid(f"В проекте STARC есть документ «{kind}» без имени.")
            names.append(title_case(name) if name.isupper() else name)
    return names


def _paragraph(element: ElementTree.Element) -> Paragraph:
    kind = TYPE_OF.get(element.tag)
    if kind is None:
        raise Invalid(f"Неизвестный тип абзаца STARC «{element.tag}».")
    parts = [child.tag for child in element]
    if parts != ["v"]:
        unknown = next((tag for tag in parts if tag != "v"), "v")
        raise Invalid(f"Абзац STARC «{element.tag}»: разметка «{unknown}» не поддерживается.")
    return Paragraph.plain(kind, "".join(element[0].itertext()))


def _paragraphs(connection: sqlite3.Connection, screenplay: ElementTree.Element) -> list[Paragraph]:
    texts = [item for item in screenplay.iterfind("item") if item.get("type") == MIME + "screenplay/text"]
    if len(texts) != 1:
        raise Invalid("У сценария в файле STARC должен быть ровно один текст.")
    row = connection.execute(
        "SELECT content FROM documents WHERE uuid = ? AND type = ?", (texts[0].get("uuid"), SCREENPLAY_TEXT)
    ).fetchone()
    if row is None:
        raise Invalid("В файле STARC нет текста сценария.")
    out: list[Paragraph] = []
    for group in _xml(row[0], "screenplay/text"):
        if group.tag != "scene":
            raise Invalid(f"Группа STARC «{group.tag}» не поддерживается.")
        parts = [child.tag for child in group]
        if parts != ["content"]:
            unknown = next((tag for tag in parts if tag != "content"), "content")
            raise Invalid(f"Параметр сцены STARC «{unknown}» не поддерживается.")
        out.extend(_paragraph(element) for element in group[0])
    if not out:
        raise Invalid("В сценарии STARC нет абзацев.")
    return out


def _project(connection: sqlite3.Connection) -> StarcProject:
    table = connection.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'documents'").fetchone()
    if table is None:
        raise Invalid("Это не проект STARC: в базе нет таблицы документов.")
    rows = connection.execute("SELECT content FROM documents WHERE type = ?", (STRUCTURE,)).fetchall()
    if len(rows) != 1:
        raise Invalid("Это не проект STARC: нужен ровно один документ структуры.")
    items = list(_items(_xml(rows[0][0], "structure")))
    screenplays = [item for item in items if item.get("type") == MIME + "screenplay"]
    if not screenplays:
        raise Invalid("В файле нет сценария.")
    if len(screenplays) > 1:
        raise Invalid("В файле несколько сценариев, а импортировать можно ровно один.")
    return StarcProject(_paragraphs(connection, screenplays[0]), _names(items, "character"), _names(items, "location"))


def parse_starc(data: bytes) -> StarcProject:
    """Read a temporary copy that SQLite may not change; the copy goes away with its folder."""
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "project.starc"
        path.write_bytes(data)
        try:
            with closing(sqlite3.connect(f"{path.as_uri()}?mode=ro&immutable=1", uri=True)) as connection:
                return _project(connection)
        except sqlite3.DatabaseError as error:
            raise Invalid(f"Файл STARC не читается: {error}.") from error

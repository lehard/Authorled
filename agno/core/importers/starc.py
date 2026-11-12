"""STARC projects (.starc: a SQLite base of XML documents) to paragraphs, read only (openspec/specs/api/story-import).

STARC has no public format specification. The shape comes from a real file of STARC 0.8.2 and, for what that file
did not show (acts, beats, scene parameters, inline formats, role values), from the facts of its public sources; no
code of STARC is used. What a fuller sample has to confirm: openspec/context/backlog-stage-2.md.

An element that is not known is refused whole, so nothing unknown is lost silently. Known data the editor has no
place for is skipped on purpose: see _GROUP_PARTS, _FOLDER_PARTS, _PARAGRAPH_PARTS and _SKIPPED.

A record of the structure whose own document is not in the file at all (a cloud project of STARC saved in part) is
not in the file: a screenplay without its text, a character or a location without its profile. Such records are not
imported and are listed in `StarcProject.skipped` for the author; a document that is there but broken is refused.
"""

import colorsys
import re
import sqlite3
import tempfile
import xml.etree.ElementTree as ElementTree
from collections.abc import Iterator
from contextlib import closing
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Literal

from core.errors import Invalid
from core.importers.screenplay import Paragraph, Run, title_case

MIME = "application/x-starc/document/"
STRUCTURE = 1
SCREENPLAY_TEXT = 10104
CHARACTER = 30001
LOCATION = 40001

TYPE_OF = {
    "scene_heading": "sceneHeading",
    "scene_characters": "sceneCharacters",
    "action": "action",
    "character": "character",
    "parenthetical": "parenthetical",
    "dialogue": "dialogue",
    "lyrics": "lyrics",
    "shot": "shot",
    "transition": "transition",
    "unformatted_text": "unformatted",
    "inline_note": "inlineNote",
    "beat_heading": "beat",
    "sequence_heading": "sequence",
    "act_heading": "act",
}
# Story roles of characters and locations: primary, secondary, tertiary, undefined.
ROLE_OF = {"0": "main", "1": "secondary", "2": "episodic", "3": "episodic"}

_FOLDERS = ("act", "sequence")
_GROUPS = ("scene", "beat")
# Elements without text of their own for the editor: ends of acts and groups, and the markers of dialogue tables.
_SKIPPED = ("act_footer", "sequence_footer", "page_splitter", "splitter")
_FOLDER_PARTS = ("color", "description", "stamp", "content")
_GROUP_PARTS = (
    "number",
    "color",
    "title",
    "story_day",
    "start_date_time",
    "description",
    "stamp",
    "tags",
    "planned_duration",
    "resources",
    "content",
)
# Alignment, bookmarks, review marks and resources do not reach the editor; comments are out of the import.
_PARAGRAPH_PARTS = ("params", "bm", "v", "rms", "fms", "rss")
_STYLES = (("bold", "bold"), ("italic", "italic"), ("underline", "underline"))

# Hues of the four labels of the editor: --mark-1…4 of web/src/design-system/tokens.css (crimson, amber, teal, blue).
_MARK_HUES = {"1": 340, "2": 40, "3": 175, "4": 210}
_GREY_SATURATION = 0.15
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass(frozen=True)
class Named:
    name: str
    role: str


@dataclass(frozen=True)
class Skipped:
    """A record of the structure whose document is not in the file; the name is as STARC shows it."""

    kind: Literal["screenplay", "character", "location"]
    name: str


@dataclass(frozen=True)
class StarcProject:
    paragraphs: list[Paragraph]
    characters: list[Named]
    locations: list[Named]
    skipped: list[Skipped]


def _text(element: ElementTree.Element) -> str:
    """STARC escapes HTML inside CDATA: the XML parser leaves «&quot;» as it is."""
    text = "".join(element.itertext())
    for escaped, plain in (("&quot;", '"'), ("&lt;", "<"), ("&gt;", ">"), ("&amp;", "&")):
        text = text.replace(escaped, plain)
    return text


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


def _in_file(connection: sqlite3.Connection, item: ElementTree.Element) -> bool:
    """Whether the file has any document of this record of the structure."""
    row = connection.execute("SELECT 1 FROM documents WHERE uuid = ?", (item.get("uuid"),)).fetchone()
    return row is not None


def _cast(
    connection: sqlite3.Connection,
    items: list[ElementTree.Element],
    kind: Literal["character", "location"],
    document_type: int,
    skipped: list[Skipped],
) -> list[Named]:
    """Names and roles of the project; names in capitals like cues get the title case of cast_from_text.

    A record without its profile in the file goes to `skipped`.
    """
    found = []
    for item in items:
        if item.get("type") != MIME + kind:
            continue
        name = (item.get("name") or "").strip()
        if not name:
            raise Invalid(f"В проекте STARC есть документ «{kind}» без имени.")
        if not _in_file(connection, item):
            skipped.append(Skipped(kind, name))
            continue
        row = connection.execute(
            "SELECT content FROM documents WHERE uuid = ? AND type = ?", (item.get("uuid"), document_type)
        ).fetchone()
        if row is None:
            raise Invalid(f"В файле STARC нет профиля «{name}».")
        value = (_xml(row[0], kind).findtext("story_role") or "").strip()
        role = ROLE_OF.get(value)
        if role is None:
            raise Invalid(f"Неизвестная роль STARC «{value}» у «{name}».")
        found.append(Named(title_case(name) if name.isupper() else name, role))
    return found


def _mark_color(value: str) -> str | None:
    """The nearest of the four labels by hue; a grey has none."""
    if not _COLOR.match(value):
        raise Invalid(f"Неизвестный цвет STARC «{value}».")
    red, green, blue = (int(value[index : index + 2], 16) / 255 for index in (1, 3, 5))
    hue, _, saturation = colorsys.rgb_to_hls(red, green, blue)
    if saturation < _GREY_SATURATION:
        return None
    degrees = hue * 360
    return min(_MARK_HUES, key=lambda mark: min(abs(_MARK_HUES[mark] - degrees), 360 - abs(_MARK_HUES[mark] - degrees)))


def _scene_params(scene: ElementTree.Element) -> dict[str, Any]:
    params: dict[str, Any] = {}
    for tag, attribute in (("title", "alt"), ("story_day", "day")):
        element = scene.find(tag)
        if element is not None:
            params[attribute] = _text(element)
    color = scene.find("color")
    if color is not None:
        params["color"] = _mark_color(_text(color).strip())
    tags = [_text(tag) for tag in scene.iterfind("tags/tag")]
    if tags:
        params["tags"] = tags
    return params


def _offset(format: ElementTree.Element, name: str) -> int:
    value = format.get(name)
    if value is None or not value.isdigit():
        raise Invalid(f"Разметка STARC: у «fm» неверное значение «{name}».")
    return int(value)


def _runs(text: str, formats: list[ElementTree.Element]) -> tuple[Run, ...]:
    """Pieces of the text by inline formats; STARC counts offsets in UTF-16 units."""
    units = text.encode("utf-16-le")
    length = len(units) // 2
    spans = []
    for format in formats:
        if format.tag != "fm":
            raise Invalid(f"Разметка STARC «{format.tag}» не поддерживается.")
        start = _offset(format, "from")
        end = start + _offset(format, "length")
        if end > length:
            raise Invalid("Разметка STARC выходит за пределы абзаца.")
        spans.append((start, end, format))
    edges = sorted({0, length, *(edge for start, end, _ in spans for edge in (start, end))})
    runs: list[Run] = []
    for start, end in zip(edges, edges[1:], strict=False):
        active = [format for first, last, format in spans if first <= start and end <= last]
        marks = tuple(mark for name, mark in _STYLES if any(format.get(name) == "true" for format in active))
        try:
            piece = units[start * 2 : end * 2].decode("utf-16-le")
        except UnicodeDecodeError as error:
            raise Invalid("Разметка STARC делит символ абзаца пополам.") from error
        if runs and runs[-1].marks == marks:
            runs[-1] = Run(runs[-1].text + piece, marks)
        else:
            runs.append(Run(piece, marks))
    return tuple(runs)


def _paragraph(element: ElementTree.Element) -> Paragraph:
    kind = TYPE_OF.get(element.tag)
    if kind is None:
        raise Invalid(f"Неизвестный тип абзаца STARC «{element.tag}».")
    parts = {child.tag: child for child in element}
    unknown = sorted(set(parts) - set(_PARAGRAPH_PARTS))
    if unknown:
        raise Invalid(f"Абзац STARC «{element.tag}»: разметка «{unknown[0]}» не поддерживается.")
    if "v" not in parts:
        raise Invalid(f"У абзаца STARC «{element.tag}» нет текста.")
    formats = list(parts["fms"]) if "fms" in parts else []
    return Paragraph(kind, _runs(_text(parts["v"]), formats))


def _content(element: ElementTree.Element, allowed: tuple[str, ...]) -> ElementTree.Element:
    for child in element:
        if child.tag not in allowed:
            raise Invalid(f"Элемент STARC «{child.tag}» в «{element.tag}» не поддерживается.")
    content = element.find("content")
    if content is None:
        raise Invalid(f"У элемента STARC «{element.tag}» нет содержимого.")
    return content


def _group(group: ElementTree.Element, out: list[Paragraph]) -> None:
    """A scene or a beat; the parameters of a scene go to its heading, the editor keeps none for a beat."""
    start = len(out)
    _walk(_content(group, _GROUP_PARTS), out)
    if group.tag != "scene":
        return
    params = _scene_params(group)
    if params:
        heading = next((index for index in range(start, len(out)) if out[index].kind == "sceneHeading"), None)
        if heading is None:
            raise Invalid("У сцены STARC с параметрами нет заголовка.")
        out[heading] = replace(out[heading], scene=params)


def _walk(parent: ElementTree.Element, out: list[Paragraph]) -> None:
    for element in parent:
        if element.tag in _FOLDERS:
            _walk(_content(element, _FOLDER_PARTS), out)
        elif element.tag in _GROUPS:
            _group(element, out)
        elif element.tag not in _SKIPPED:
            out.append(_paragraph(element))


def _text_item(screenplay: ElementTree.Element) -> ElementTree.Element:
    texts = [item for item in screenplay.iterfind("item") if item.get("type") == MIME + "screenplay/text"]
    if len(texts) != 1:
        raise Invalid("У сценария в файле STARC должен быть ровно один текст.")
    return texts[0]


def _paragraphs(connection: sqlite3.Connection, screenplay: ElementTree.Element) -> list[Paragraph]:
    row = connection.execute(
        "SELECT content FROM documents WHERE uuid = ? AND type = ?",
        (_text_item(screenplay).get("uuid"), SCREENPLAY_TEXT),
    ).fetchone()
    if row is None:
        raise Invalid("В файле STARC нет текста сценария.")
    out: list[Paragraph] = []
    _walk(_xml(row[0], "screenplay/text"), out)
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
    skipped: list[Skipped] = []
    screenplays = []
    for item in items:
        if item.get("type") != MIME + "screenplay":
            continue
        if _in_file(connection, _text_item(item)):
            screenplays.append(item)
            continue
        name = (item.get("name") or "").strip()
        if not name:
            raise Invalid("В проекте STARC есть сценарий без имени.")
        skipped.append(Skipped("screenplay", name))
    if not screenplays:
        raise Invalid("В файле нет сценария.")
    if len(screenplays) > 1:
        raise Invalid("В файле несколько сценариев, а импортировать можно ровно один.")
    paragraphs = _paragraphs(connection, screenplays[0])
    characters = _cast(connection, items, "character", CHARACTER, skipped)
    locations = _cast(connection, items, "location", LOCATION, skipped)
    # The author reads the list in the order of the navigator of STARC.
    order = {(item.get("type"), (item.get("name") or "").strip()): index for index, item in enumerate(items)}
    skipped.sort(key=lambda record: order[(MIME + record.kind, record.name)])
    return StarcProject(paragraphs, characters, locations, skipped)


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

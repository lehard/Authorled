"""Text of the screenplay of a draft (openspec/specs/api/stories, «Текст сценария», «Проверка текста»).

The text is the JSON document of the editor (web/src/editor/document.ts). The core checks it against the same
paragraph types, marks and scene attributes as web/src/editor/schema; anything unknown is refused, never dropped.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, func, insert, select, update

from core import snapshots
from core.documents import document_row, ensure_open, touch_draft
from core.errors import Conflict, Invalid, NotFound
from core.tables import documents, screenplay_texts

# Paragraph types of web/src/editor/elements.ts (ElementName); tests/test_texts.py compares the lists.
ELEMENT_NAMES = (
    "sceneHeading",
    "sceneCharacters",
    "action",
    "character",
    "parenthetical",
    "dialogue",
    "lyrics",
    "shot",
    "transition",
    "unformatted",
    "inlineNote",
    "beat",
    "sequence",
    "act",
)
MARK_COLORS = ("1", "2", "3", "4")
PLAIN_MARKS = ("bold", "italic", "underline")
# A scene runs from its heading to the next heading, group or act (web/src/editor/document.ts, scenes).
SCENE_ENDS = ("sceneHeading", "sequence", "act")

Doc = dict[str, Any]


@dataclass(frozen=True)
class Text:
    document_id: uuid.UUID
    content: Doc
    revision: int
    updated_by: uuid.UUID
    updated_at: datetime


def heading(uid: str, text: str = "") -> dict[str, Any]:
    node: dict[str, Any] = {
        "type": "sceneHeading",
        "attrs": {"alt": "", "day": "", "color": None, "tags": [], "uid": uid},
    }
    if text:
        node["content"] = [{"type": "text", "text": text}]
    return node


def new_screenplay() -> Doc:
    """The text of a new story: one empty scene heading."""
    return {"type": "doc", "content": [heading(str(uuid.uuid4()))]}


def _mark(mark: Any, where: str) -> None:
    if not isinstance(mark, dict):
        raise Invalid(f"{where}: метка должна быть объектом.")
    kind = mark.get("type")
    attrs = mark.get("attrs")
    if kind in PLAIN_MARKS:
        if set(mark) - {"type", "attrs"} or attrs not in (None, {}):
            raise Invalid(f"{where}: у метки «{kind}» нет атрибутов.")
    elif kind in ("textColor", "highlight"):
        if not isinstance(attrs, dict) or set(attrs) != {"color"} or attrs["color"] not in MARK_COLORS:
            raise Invalid(f"{where}: у метки «{kind}» цвет должен быть одним из {', '.join(MARK_COLORS)}.")
    elif kind in ("comment", "suggestion"):
        if not isinstance(attrs, dict) or set(attrs) != {"id"} or not isinstance(attrs["id"], str) or not attrs["id"]:
            raise Invalid(f"{where}: у метки «{kind}» должен быть непустой id.")
    else:
        raise Invalid(f"{where}: неизвестная метка «{kind}».")


def _inline(node: Any, where: str) -> None:
    if not isinstance(node, dict) or node.get("type") != "text":
        raise Invalid(f"{where}: внутри абзаца допустим только текст.")
    if set(node) - {"type", "text", "marks"}:
        raise Invalid(f"{where}: лишние поля у текста.")
    if not isinstance(node.get("text"), str) or node["text"] == "":
        raise Invalid(f"{where}: текст не может быть пустым.")
    marks = node.get("marks", [])
    if not isinstance(marks, list):
        raise Invalid(f"{where}: метки должны быть списком.")
    for mark in marks:
        _mark(mark, where)


def _scene_attrs(attrs: Any, where: str) -> str:
    if not isinstance(attrs, dict):
        raise Invalid(f"{where}: у заголовка сцены нет uid.")
    unknown = set(attrs) - {"alt", "day", "color", "tags", "uid"}
    if unknown:
        raise Invalid(f"{where}: неизвестный атрибут заголовка сцены «{sorted(unknown)[0]}».")
    for name in ("alt", "day"):
        if not isinstance(attrs.get(name, ""), str):
            raise Invalid(f"{where}: атрибут «{name}» должен быть строкой.")
    if attrs.get("color") is not None and attrs["color"] not in MARK_COLORS:
        raise Invalid(f"{where}: цвет сцены должен быть одним из {', '.join(MARK_COLORS)}.")
    tags = attrs.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        raise Invalid(f"{where}: теги сцены — список строк.")
    uid = attrs.get("uid")
    if not isinstance(uid, str) or not uid:
        raise Invalid(f"{where}: у заголовка сцены нет uid.")
    return uid


def validate_text(doc: Any) -> Doc:
    """Check the editor document; returns it unchanged or refuses with the reason."""
    if not isinstance(doc, dict) or doc.get("type") != "doc" or set(doc) - {"type", "content"}:
        raise Invalid("Текст должен быть документом редактора: объект с type «doc».")
    blocks = doc.get("content")
    if not isinstance(blocks, list) or not blocks:
        raise Invalid("В тексте должен быть хотя бы один абзац.")
    uids: set[str] = set()
    for index, block in enumerate(blocks, start=1):
        where = f"Абзац {index}"
        if not isinstance(block, dict):
            raise Invalid(f"{where}: абзац должен быть объектом.")
        kind = block.get("type")
        if kind == "pageBreak":
            if set(block) - {"type"}:
                raise Invalid(f"{where}: у разрыва страницы нет содержимого.")
            continue
        if kind not in ELEMENT_NAMES:
            raise Invalid(f"{where}: неизвестный тип абзаца «{kind}».")
        if set(block) - {"type", "attrs", "content"}:
            raise Invalid(f"{where}: лишние поля абзаца.")
        if kind == "sceneHeading":
            uid = _scene_attrs(block.get("attrs"), f"{where} (заголовок сцены)")
            if uid in uids:
                raise Invalid(f"{where} (заголовок сцены): uid «{uid}» повторяется.")
            uids.add(uid)
        elif block.get("attrs") not in (None, {}):
            raise Invalid(f"{where}: у абзаца «{kind}» нет атрибутов.")
        content = block.get("content", [])
        if not isinstance(content, list):
            raise Invalid(f"{where}: содержимое должно быть списком.")
        for node in content:
            _inline(node, where)
    return doc


def block_text(block: dict[str, Any]) -> str:
    return "".join(node["text"] for node in block.get("content", []))


def strip_marks(doc: Doc, kinds: tuple[str, ...]) -> Doc:
    """The document without marks of `kinds`: a draft copies the text without comments and suggestions."""
    return filter_marks(doc, lambda mark: mark["type"] not in kinds)


def filter_marks(doc: Doc, keep: Callable[[dict[str, Any]], bool]) -> Doc:
    """The document with only the marks `keep` accepts."""
    blocks = []
    for block in doc["content"]:
        if "content" in block:
            nodes = []
            for node in block["content"]:
                marks = [mark for mark in node.get("marks", []) if keep(mark)]
                nodes.append({**{k: v for k, v in node.items() if k != "marks"}, **({"marks": marks} if marks else {})})
            block = {**block, "content": nodes}
        blocks.append(block)
    return {"type": "doc", "content": blocks}


@dataclass(frozen=True)
class Scene:
    uid: str
    number: int
    heading: str
    blocks: list[dict[str, Any]]


def scenes(doc: Doc) -> list[Scene]:
    """Scenes of the text: a heading and the paragraphs up to the next heading, group or act."""
    found: list[Scene] = []
    current: list[dict[str, Any]] | None = None
    for block in doc["content"]:
        kind = block["type"]
        if kind in SCENE_ENDS:
            current = None
        if kind == "sceneHeading":
            current = [block]
            found.append(Scene(block["attrs"]["uid"], len(found) + 1, block_text(block), current))
        elif current is not None:
            current.append(block)
    return found


def text_row(connection: Connection, document_id: uuid.UUID, for_update: bool = False) -> Text:
    query = select(screenplay_texts).where(screenplay_texts.c.document_id == document_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"У документа {document_id} нет текста.")
    return Text(row.document_id, row.content, row.revision, row.updated_by, row.updated_at)


def get_text(connection: Connection, document_id: uuid.UUID) -> Text:
    document_row(connection, document_id)
    return text_row(connection, document_id)


def write_text(connection: Connection, document_id: uuid.UUID, doc: Doc, user_id: uuid.UUID) -> Text:
    """Store a checked text as a new revision; the caller holds the row and has taken its snapshot."""
    row = connection.execute(
        update(screenplay_texts)
        .where(screenplay_texts.c.document_id == document_id)
        .values(content=doc, revision=screenplay_texts.c.revision + 1, updated_by=user_id, updated_at=func.now())
        .returning(screenplay_texts)
    ).one()
    connection.execute(update(documents).where(documents.c.id == document_id).values(updated_at=func.now()))
    return Text(document_id, doc, row.revision, row.updated_by, row.updated_at)


def keep_text(connection: Connection, document_id: uuid.UUID, reason: str) -> None:
    """A snapshot of the saved text for an action that is about to change it."""
    current = text_row(connection, document_id)
    snapshots.keep(connection, document_id, "text", current.content, current.updated_by, current.updated_at, reason)


def put_text(
    connection: Connection,
    document_id: uuid.UUID,
    expected_revision: int,
    content: Any,
    user_id: uuid.UUID,
    reason: str | None = None,
) -> Text:
    """Replace the whole text if its revision is still `expected_revision`.

    The state it replaces becomes a snapshot: with `reason` always, without it when the last one is old enough.
    """
    document = document_row(connection, document_id)
    ensure_open(connection, document)
    doc = validate_text(content)
    current = text_row(connection, document_id, for_update=True)
    if current.revision != expected_revision:
        raise Conflict(f"Текст изменился: ревизия {current.revision}, а не {expected_revision}.")
    snapshots.keep(connection, document_id, "text", current.content, current.updated_by, current.updated_at, reason)
    text = write_text(connection, document_id, doc, user_id)
    touch_draft(connection, document.draft_id)
    return text


def add_text(connection: Connection, document_id: uuid.UUID, content: Doc, user_id: uuid.UUID) -> None:
    connection.execute(
        insert(screenplay_texts).values(document_id=document_id, content=validate_text(content), updated_by=user_id)
    )


def screenplay_id(connection: Connection, draft_id: uuid.UUID) -> uuid.UUID:
    script = connection.execute(
        select(documents.c.id).where(documents.c.draft_id == draft_id, documents.c.kind == "script")
    ).scalar_one_or_none()
    if script is None:
        raise Conflict(f"У драфта {draft_id} нет сценария.")
    return script

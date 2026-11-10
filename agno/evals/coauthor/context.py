"""The chat's context block of a case, as the chat attaches it to the author's message (docContext.ts).

Without the agent: tests build it without the co-author's model.
"""

from dataclasses import dataclass

from core.documents import list_documents
from core.engine import get_engine
from core.texts import Doc, block_text, get_text, scenes, screenplay_id
from evals.coauthor.doc_tasks import DOC_TITLES
from evals.coauthor.user import Place

# What the chat attaches to every message (web/src/screens/project/chat/CoauthorChat.tsx, docContext.ts).
CONTEXT_DESCRIPTION = "Что сейчас открыто у автора в Соавторе"
# The open document in the chat's context and the author's selection are cut as the chat cuts them
# (docContext.ts MAX_CHARS, useSelectionIn.ts MAX).
DOCUMENT_CHARS = 20_000
SELECTION_CHARS = 2000
# Labels of the screenplay elements in the chat's context (web/src/editor/elements.ts).
ELEMENT_LABELS = {
    "sceneHeading": "Заголовок сцены",
    "sceneCharacters": "Участники сцены",
    "action": "Описание действия",
    "character": "Персонаж",
    "parenthetical": "Ремарка",
    "dialogue": "Реплика",
    "lyrics": "Лирика",
    "shot": "Кадр",
    "transition": "Переход",
    "unformatted": "Простой текст",
    "inlineNote": "Заметка по тексту",
    "beat": "Бит",
    "sequence": "Группа",
    "act": "Акт",
}


@dataclass(frozen=True)
class Opened:
    """The screenplay open in the chat and the scene the author selected (spec «Случай с открытым текстом сценария»)."""

    document: str  # the paragraphs with element labels, as docContext.ts sends the text of the screenplay
    selection: str  # the paragraphs of the scene, as the browser's selection gives them


@dataclass(frozen=True)
class OpenedDoc:
    """«Логлайн» or «Синопсис» open in the chat (spec «Случай с открытым документом»)."""

    title: str
    text: str  # as docContext.ts sends it: cut, or «(пусто)» for an empty document


def _label(block: dict[str, object]) -> str:
    kind = block["type"]
    if kind not in ELEMENT_LABELS:
        raise RuntimeError(f"The screenplay has an element {kind!r} the chat's context does not label")
    return ELEMENT_LABELS[str(kind)]


def opened_scene(doc: Doc, number: int) -> Opened:
    found = {scene.number: scene for scene in scenes(doc)}
    if number not in found:
        raise RuntimeError(f"The screenplay has no scene {number}")
    blocks = [b for b in doc["content"] if b["type"] != "pageBreak"]
    document = "\n".join(f"[{_label(b)}] {block_text(b)}" for b in blocks if block_text(b).strip())
    if len(document) > DOCUMENT_CHARS:
        document = f"{document[:DOCUMENT_CHARS]}\n…(текст обрезан)"
    selection = "\n".join(block_text(b) for b in found[number].blocks).strip()[:SELECTION_CHARS]
    return Opened(document, selection)


def open_scene(place: Place, number: int) -> Opened:
    """The open draft's screenplay of the place, as the core keeps it, with scene `number` selected."""
    with get_engine().connect() as connection:
        doc = get_text(connection, screenplay_id(connection, place.draft_id)).content
    return opened_scene(doc, number)


def opened_doc(doc: str, fields: dict[str, object]) -> OpenedDoc:
    """The document `doc` of the screenplay's fields as the chat shows it (docContext.ts, part «logline» or
    «synopsis»)."""
    if doc not in DOC_TITLES:
        raise RuntimeError(f"The chat opens no document {doc!r} of the screenplay")
    # An absent field is an empty document, as the web reads it (apiProvider.ts, `text`).
    text = fields[doc] if doc in fields else ""
    if not isinstance(text, str):
        raise RuntimeError(f"The screenplay's {doc} is not text")
    if len(text) > DOCUMENT_CHARS:
        text = f"{text[:DOCUMENT_CHARS]}\n…(текст обрезан)"
    return OpenedDoc(DOC_TITLES[doc], text or "(пусто)")


def open_doc(place: Place, doc: str) -> OpenedDoc:
    """The logline or the synopsis of the open draft of the place, as the core keeps it."""
    with get_engine().connect() as connection:
        script = next(d for d in list_documents(connection, place.draft_id) if d.kind == "script")
    return opened_doc(doc, script.fields)


def chat_context(place: Place, opened: Opened | OpenedDoc | None = None) -> dict[str, str]:
    """The chat's context with the story card open (docContext.ts, kind «info»), given `opened`, the text of the
    screenplay open and a scene of it selected (docContext.ts, part «text»), or the logline or the synopsis open.

    AG-UI passes the chat's context as run dependencies with add_dependencies_to_context, and Agno appends them to
    the author's message as an <additional context> block (agno os/interfaces/agui/router.py, agent/_messages.py);
    the measurement runs the agent the same way.
    """
    story = f"История: «{place.title}» (полнометражный сценарий), драфт «{place.draft_name}»."
    if opened is None:
        lines = [
            story,
            "Открыт документ: История.",
            "Содержимое документа:",
            f"Название: {place.title}\nТэглайн: {place.tagline}",
        ]
    elif isinstance(opened, OpenedDoc):
        lines = [story, f"Открыт документ: {opened.title}.", "Содержимое документа:", opened.text]
    else:
        lines = [
            story,
            "Открыт документ: Текст сценария.",
            "Содержимое документа:",
            opened.document,
            "",
            "Автор выделил фрагмент:",
            opened.selection,
        ]
    return {CONTEXT_DESCRIPTION: "\n".join(lines)}

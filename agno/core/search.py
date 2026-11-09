"""Search of a draft and its story (openspec/specs/api/stories, «Поиск по драфту истории»; design of project-search).

A plain pass over the canon, no index: the screenplay of the draft by scenes, its logline and synopsis, the
characters, locations and worlds outside the trash, the notes of the story outside the trash. A match is a
substring ignoring case and the difference of «ё» and «е»; folding keeps every character in place, so a position
in the folded text is the position in the written one. The route and the co-author's tool both call
`search_draft`, so they refuse and answer alike.
"""

import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

from sqlalchemy import Connection

from core import documents as docs
from core import notes, texts
from core.errors import Invalid
from core.fields import FIELD_HINTS

MIN_QUERY = 2
MAX_QUERY = 200
# Characters of the written text kept on each side of the first match.
CONTEXT = 40
ELLIPSIS = "…"
ENTITY_KINDS = ("character", "location", "world")
SCRIPT_FIELDS = ("logline", "synopsis")
# A code, not a text: «f», «m», «o».
UNSEARCHED_FIELDS = ("gender",)


@dataclass(frozen=True)
class Snippet:
    before: str
    match: str
    after: str


@dataclass(frozen=True)
class SceneHit:
    """A scene of the screenplay; number 0 without uid gathers the paragraphs outside scenes."""

    uid: str | None
    number: int
    heading: str
    count: int
    snippet: Snippet


@dataclass(frozen=True)
class DocumentHit:
    """A character, location or world, or a part of the screenplay (`field` logline or synopsis)."""

    id: uuid.UUID
    kind: str
    name: str
    field: str
    count: int
    snippet: Snippet


@dataclass(frozen=True)
class NoteHit:
    id: uuid.UUID
    title: str
    field: str
    count: int
    snippet: Snippet


@dataclass(frozen=True)
class SearchResult:
    query: str
    scenes: tuple[SceneHit, ...]
    documents: tuple[DocumentHit, ...]
    notes: tuple[NoteHit, ...]


def fold(text: str) -> str:
    """Lower case and «ё» as «е», one character for one: a character whose lower case is longer stays as is."""
    lowered = text.lower()
    if len(lowered) != len(text):
        lowered = "".join(low if len(low := char.lower()) == 1 else char for char in text)
    return lowered.replace("ё", "е")


def check_query(query: str) -> str:
    """The query without spaces at its ends, or a refusal with the reason."""
    stripped = query.strip()
    if not stripped:
        raise Invalid("Пустой запрос: введите, что искать.", "q")
    if len(stripped) < MIN_QUERY:
        raise Invalid(f"Запрос слишком короткий: нужно не меньше {MIN_QUERY} символов.", "q")
    if len(stripped) > MAX_QUERY:
        raise Invalid(f"Запрос слишком длинный: не больше {MAX_QUERY} символов.", "q")
    return stripped


def _positions(folded: str, query: str) -> Iterator[int]:
    at = folded.find(query)
    while at >= 0:
        yield at
        at = folded.find(query, at + len(query))


# Line breaks and tabs become spaces one for one: a piece of text is one line.
_FLAT = str.maketrans({char: " " for char in "\r\n\t\v\f\x1c\x1d\x1e\x85\u2028\u2029"})


def _flat(text: str) -> str:
    return text.translate(_FLAT)


def _snippet(text: str, at: int, length: int) -> Snippet:
    """The first match with up to CONTEXT characters on each side, cut on a space, the cut marked with «…»."""
    before, after = _flat(text[:at]), _flat(text[at + length :])
    if len(before) > CONTEXT:
        cut = before[-CONTEXT:]
        space = cut.find(" ")
        if before[-CONTEXT - 1] != " " and 0 <= space < len(cut) - 1:
            cut = cut[space + 1 :]
        before = ELLIPSIS + cut
    if len(after) > CONTEXT:
        cut = after[:CONTEXT]
        space = cut.rfind(" ")
        if after[CONTEXT] != " " and space > 0:
            cut = cut[:space]
        after = cut + ELLIPSIS
    return Snippet(before, _flat(text[at : at + length]), after)


@dataclass(frozen=True)
class _Found:
    key: str
    count: int
    snippet: Snippet


def _find(parts: Iterable[tuple[str, str]], query: str) -> _Found | None:
    """Matches in the texts of one result, as (key, text): the count of all and the first one's place."""
    first: tuple[str, Snippet] | None = None
    count = 0
    for key, text in parts:
        for at in _positions(fold(text), query):
            count += 1
            if first is None:
                first = (key, _snippet(text, at, len(query)))
    if first is None:
        return None
    return _Found(first[0], count, first[1])


def _scenes(content: texts.Doc, query: str) -> list[SceneHit]:
    found = texts.scenes(content)
    scene_of = {id(block): scene for scene in found for block in scene.blocks}
    outside: list[tuple[str, str]] = []
    inside: dict[str, list[tuple[str, str]]] = {scene.uid: [] for scene in found}
    for block in content["content"]:
        if block["type"] == "pageBreak":
            continue
        scene = scene_of.get(id(block))
        (outside if scene is None else inside[scene.uid]).append(("text", texts.block_text(block)))
    hits: list[SceneHit] = []
    if (hit := _find(outside, query)) is not None:
        hits.append(SceneHit(None, 0, "", hit.count, hit.snippet))
    for scene in found:
        if (hit := _find(inside[scene.uid], query)) is not None:
            hits.append(SceneHit(scene.uid, scene.number, scene.heading, hit.count, hit.snippet))
    return hits


def _entity_parts(document: docs.Document) -> list[tuple[str, str]]:
    keys = [key for key in FIELD_HINTS[document.kind] if key not in UNSEARCHED_FIELDS]
    values = [(key, document.fields.get(key)) for key in keys]
    return [("name", document.name), ("summary", document.summary)] + [
        (key, value) for key, value in values if isinstance(value, str)
    ]


def _documents(listed: list[docs.Document], query: str) -> list[DocumentHit]:
    alive = [document for document in listed if document.deleted_at is None]
    hits: list[DocumentHit] = []
    for kind in ENTITY_KINDS:
        for document in (d for d in alive if d.kind == kind):
            if (hit := _find(_entity_parts(document), query)) is not None:
                hits.append(DocumentHit(document.id, kind, document.name, hit.key, hit.count, hit.snippet))
    script = next(document for document in alive if document.kind == "script")
    for key in SCRIPT_FIELDS:
        value = script.fields.get(key)
        if isinstance(value, str) and (hit := _find([(key, value)], query)) is not None:
            hits.append(DocumentHit(script.id, "script", script.name, key, hit.count, hit.snippet))
    return hits


def _notes(listed: list[notes.Note], query: str) -> list[NoteHit]:
    hits: list[NoteHit] = []
    for note in (n for n in listed if n.deleted_at is None):
        if (hit := _find([("title", note.title), ("body", note.body)], query)) is not None:
            hits.append(NoteHit(note.id, note.title, hit.key, hit.count, hit.snippet))
    return hits


def search_draft(connection: Connection, draft_id: uuid.UUID, query: str) -> SearchResult:
    """Matches of `query` in the draft and the notes of its story, in the order of the text and the navigator."""
    stripped = check_query(query)
    folded = fold(stripped)
    draft = docs.draft_row(connection, draft_id)
    content = texts.text_row(connection, texts.screenplay_id(connection, draft_id)).content
    return SearchResult(
        query=stripped,
        scenes=tuple(_scenes(content, folded)),
        documents=tuple(_documents(docs.list_documents(connection, draft_id), folded)),
        notes=tuple(_notes(notes.list_notes(connection, draft.project_id), folded)),
    )

"""The library of sources on storytelling (openspec/specs/sources/library).

A book of the library is its canon: one Markdown file with a YAML front matter and the text of the book under headings
of its structure. This module reads and checks the canon, cuts it into pieces, writes and removes a book, searches the
pieces by a ready vector of the query and by its words, and checks a quotation. Vectors come from the caller: the core
never calls a model (design of storytelling-sources, decision 1).
"""

import re
import uuid
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import yaml  # type: ignore[import-untyped]
from markdown_it import MarkdownIt
from markdown_it.token import Token
from sqlalchemy import Connection, delete, func, insert, select

from core.errors import Invalid, NotFound
from core.tables import SOURCE_LANGUAGES, SOURCE_VECTOR_DIMENSIONS, source_books, source_fragments

# The longest piece: 1 200 characters keep a piece of Russian text under the 512 tokens of gigachat-embeddings, as the
# knowledge of the template does (db/__init__.py, CHUNK_SIZE).
PIECE_MAX_CHARS = 1_200
# The longest quotation the author sees (business-intents/storytelling-sources.md, decision of the owner 2026-11-11).
QUOTE_MAX_CHARS = 300
# How many pieces each kind of search hands to the fusion, and its constant (Reciprocal Rank Fusion).
SEARCH_DEPTH = 20
RRF_K = 60

REQUIRED_KEYS = ("title", "authors", "language")
YEAR_KEYS = ("original_year", "edition_year", "translation_year")
TEXT_KEYS = ("translator", "original_title")
KNOWN_KEYS = (*REQUIRED_KEYS, *YEAR_KEYS, *TEXT_KEYS)

_SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
_EMPTY_ILLUSTRATION = re.compile(r"\[Иллюстрация:\s*\]")
_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")
_PARSER = MarkdownIt("commonmark").enable("table")


@dataclass(frozen=True)
class BookMeta:
    """Metadata of a book from the front matter of its canon; the optional ones are None when unknown."""

    slug: str
    title: str
    authors: tuple[str, ...]
    language: str
    original_year: int | None = None
    edition_year: int | None = None
    translator: str | None = None
    translation_year: int | None = None
    original_title: str | None = None


@dataclass(frozen=True)
class Piece:
    """A piece of a book: its number through the book, the path of headings to its section and its text."""

    position: int
    path: tuple[str, ...]
    content: str


@dataclass(frozen=True)
class Book:
    meta: BookMeta
    pieces: tuple[Piece, ...]


@dataclass
class _Section:
    path: tuple[str, ...]
    # Units of text: a paragraph, an item of a list, a row of a table, a whole diagram.
    units: list[tuple[str, bool]] = field(default_factory=list)


def _refuse(name: str, message: str, where: tuple[str, ...] | None = None) -> Invalid:
    place = f", раздел «{' → '.join(where)}»" if where else ""
    return Invalid(f"{name}{place}: {message}")


def _front_matter(name: str, text: str) -> tuple[dict[str, Any], str]:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        raise _refuse(name, "нет шапки: файл должен начинаться со строки «---».")
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            header = yaml.safe_load("".join(lines[1:index]))
            if not isinstance(header, dict):
                raise _refuse(name, "шапка должна быть словарём YAML.")
            return header, "".join(lines[index + 1 :])
    raise _refuse(name, "шапка не закрыта строкой «---».")


def _meta(name: str, slug: str, header: dict[str, Any]) -> BookMeta:
    unknown = sorted(str(key) for key in header if key not in KNOWN_KEYS)
    if unknown:
        raise _refuse(name, f"неизвестные поля шапки: {', '.join(unknown)}; допустимы {', '.join(KNOWN_KEYS)}.")
    for key in REQUIRED_KEYS:
        if header.get(key) in (None, "", []):
            raise _refuse(name, f"нет обязательного поля «{key}».")
    title = header["title"]
    if not isinstance(title, str) or not title.strip():
        raise _refuse(name, "поле «title» должно быть непустой строкой.")
    authors = header["authors"]
    if not isinstance(authors, list) or not all(isinstance(a, str) and a.strip() for a in authors):
        raise _refuse(name, "поле «authors» должно быть списком непустых строк.")
    language = header["language"]
    if language not in SOURCE_LANGUAGES:
        raise _refuse(name, f"язык «{language}» не поддерживается; допустимы {', '.join(SOURCE_LANGUAGES)}.")
    values: dict[str, Any] = {}
    for key in YEAR_KEYS:
        value = header.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
            raise _refuse(name, f"поле «{key}» должно быть целым годом.")
        values[key] = value
    for key in TEXT_KEYS:
        value = header.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise _refuse(name, f"поле «{key}» должно быть непустой строкой.")
        values[key] = value.strip() if isinstance(value, str) else None
    return BookMeta(
        slug=slug,
        title=title.strip(),
        authors=tuple(author.strip() for author in authors),
        language=language,
        **values,
    )


def _inline_text(name: str, token: Token, path: tuple[str, ...]) -> str:
    parts: list[str] = []
    for child in token.children or []:
        match child.type:
            case "image":
                raise _refuse(name, "в каноне осталась картинка; замените её описанием «[Иллюстрация: …]».", path)
            case "html_inline":
                raise _refuse(name, f"в каноне осталась разметка HTML «{child.content}».", path)
            case "softbreak":
                parts.append(" ")
            case "hardbreak":
                parts.append("\n")
            case "text" | "code_inline":
                parts.append(child.content)
    return "".join(parts).strip()


def _sections(name: str, body: str) -> list[_Section]:
    """Sections of the body by its headings, each with its units of plain text."""
    sections = [_Section(path=())]
    headings: list[tuple[int, str]] = []
    prefix: list[str] = []
    row: list[str] = []
    tokens = _PARSER.parse(body)
    for index, token in enumerate(tokens):
        path = sections[-1].path
        match token.type:
            case "heading_open":
                level = int(token.tag[1:])
                title = _inline_text(name, tokens[index + 1], path)
                if not title:
                    raise _refuse(name, "пустой заголовок.", path)
                headings = [(lvl, text) for lvl, text in headings if lvl < level] + [(level, title)]
                sections.append(_Section(path=tuple(text for _, text in headings)))
            case "bullet_list_open" | "ordered_list_open":
                prefix.append("- " if token.type == "bullet_list_open" else "")
            case "bullet_list_close" | "ordered_list_close":
                prefix.pop()
            case "fence" if token.info.strip() == "mermaid":
                sections[-1].units.append((f"```mermaid\n{token.content.rstrip()}\n```", True))
            case "fence" | "code_block":
                if token.content.strip():
                    sections[-1].units.append((token.content.strip(), False))
            case "html_block":
                raise _refuse(name, f"в каноне осталась разметка HTML «{token.content.strip()[:60]}».", path)
            case "tr_open":
                row = []
            case "tr_close":
                if any(row):
                    sections[-1].units.append((" | ".join(row), False))
            case "inline" if tokens[index - 1].type in ("th_open", "td_open"):
                row.append(_inline_text(name, token, path))
            case "inline" if tokens[index - 1].type == "paragraph_open":
                text = _inline_text(name, token, path)
                if _EMPTY_ILLUSTRATION.fullmatch(text):
                    raise _refuse(name, "пустое описание иллюстрации «[Иллюстрация: ]».", path)
                if text:
                    sections[-1].units.append((f"{prefix[-1] if prefix else ''}{text}", False))
    if len(sections) == 1:
        raise _refuse(name, "в каноне нет ни одного заголовка: главы книги размечаются заголовками «#».")
    return sections


def _split_long(text: str) -> Iterator[str]:
    """A unit longer than a piece, cut by sentences, a sentence longer than a piece by spaces, a word by length."""
    for sentence in _SENTENCE_END.split(text):
        if len(sentence) <= PIECE_MAX_CHARS:
            yield sentence
            continue
        line = ""
        for word in sentence.split():
            while len(word) > PIECE_MAX_CHARS:
                if line:
                    yield line
                    line = ""
                yield word[:PIECE_MAX_CHARS]
                word = word[PIECE_MAX_CHARS:]
            if line and len(line) + 1 + len(word) > PIECE_MAX_CHARS:
                yield line
                line = word
            else:
                line = f"{line} {word}" if line else word
        if line:
            yield line


def _pieces(name: str, sections: list[_Section]) -> tuple[Piece, ...]:
    pieces: list[Piece] = []
    for section in sections:
        units: list[str] = []
        for text, diagram in section.units:
            if len(text) <= PIECE_MAX_CHARS:
                units.append(text)
            elif diagram:
                raise _refuse(
                    name, f"схема Mermaid длиннее {PIECE_MAX_CHARS} знаков; разделите или сократите её.", section.path
                )
            else:
                units.extend(_split_long(text))
        current = ""
        for unit in units:
            if current and len(current) + 2 + len(unit) > PIECE_MAX_CHARS:
                pieces.append(Piece(position=len(pieces), path=section.path, content=current))
                current = unit
            else:
                current = f"{current}\n\n{unit}" if current else unit
        if current:
            pieces.append(Piece(position=len(pieces), path=section.path, content=current))
    return tuple(pieces)


def parse_canon(name: str, text: str) -> Book:
    """The book of a canon file `name` (`<slug>.md`) with its text, checked and cut into pieces."""
    if not name.endswith(".md"):
        raise _refuse(name, "файл канона должен иметь расширение .md.")
    slug = name.removesuffix(".md")
    if not _SLUG.fullmatch(slug):
        raise _refuse(name, "имя файла канона — латиница в нижнем регистре, цифры и дефисы, например «impro.md».")
    header, body = _front_matter(name, text)
    meta = _meta(name, slug, header)
    pieces = _pieces(name, _sections(name, body))
    if not pieces:
        raise _refuse(name, "в книге нет текста.")
    return Book(meta=meta, pieces=pieces)


def save_book(connection: Connection, book: Book, vectors: list[list[float]], embedding_model: str) -> uuid.UUID:
    """Write the book with the vectors of its pieces in place of the book of the same slug; one transaction."""
    if len(vectors) != len(book.pieces):
        raise ValueError(f"{len(vectors)} vectors for {len(book.pieces)} pieces of {book.meta.slug}")
    if any(len(vector) != SOURCE_VECTOR_DIMENSIONS for vector in vectors):
        raise ValueError(f"vectors of {book.meta.slug} must have {SOURCE_VECTOR_DIMENSIONS} dimensions")
    meta = book.meta
    with connection.begin_nested():
        connection.execute(delete(source_books).where(source_books.c.slug == meta.slug))
        book_id = connection.execute(
            insert(source_books)
            .values(
                slug=meta.slug,
                title=meta.title,
                authors=list(meta.authors),
                language=meta.language,
                original_year=meta.original_year,
                edition_year=meta.edition_year,
                translator=meta.translator,
                translation_year=meta.translation_year,
                original_title=meta.original_title,
                embedding_model=embedding_model,
            )
            .returning(source_books.c.id)
        ).scalar_one()
        connection.execute(
            insert(source_fragments),
            [
                {
                    "book_id": book_id,
                    "position": piece.position,
                    "path": list(piece.path),
                    "content": piece.content,
                    "ts_config": SOURCE_LANGUAGES[meta.language],
                    "embedding": vector,
                }
                for piece, vector in zip(book.pieces, vectors, strict=True)
            ],
        )
    return book_id


def remove_book(connection: Connection, slug: str) -> None:
    """Remove the book and its pieces; a book that is not there is NotFound."""
    if connection.execute(delete(source_books).where(source_books.c.slug == slug)).rowcount == 0:
        raise NotFound(f"Книги «{slug}» в библиотеке нет.")


@dataclass(frozen=True)
class LoadedBook:
    slug: str
    title: str
    authors: tuple[str, ...]
    language: str
    pieces: int
    embedding_model: str
    loaded_at: datetime


def list_books(connection: Connection) -> list[LoadedBook]:
    count = func.count(source_fragments.c.id)
    rows = connection.execute(
        select(source_books, count.label("pieces"))
        .outerjoin(source_fragments, source_fragments.c.book_id == source_books.c.id)
        .group_by(source_books.c.id)
        .order_by(source_books.c.slug)
    ).all()
    return [
        LoadedBook(
            slug=row.slug,
            title=row.title,
            authors=tuple(row.authors),
            language=row.language,
            pieces=row.pieces,
            embedding_model=row.embedding_model,
            loaded_at=row.loaded_at,
        )
        for row in rows
    ]


def reference(meta: BookMeta, path: tuple[str, ...]) -> str:
    """Where a quotation comes from: authors, title, translator and edition when known, the place in the book."""
    parts = [f"{', '.join(meta.authors)}, «{meta.title}»"]
    if meta.translator:
        parts.append(f"пер. {meta.translator}")
    if meta.edition_year is not None:
        parts.append(str(meta.edition_year))
    parts.extend(path)
    return ", ".join(parts)


@dataclass(frozen=True)
class Found:
    fragment_id: uuid.UUID
    meta: BookMeta
    path: tuple[str, ...]
    content: str

    @property
    def reference(self) -> str:
        return reference(self.meta, self.path)


def _meta_of(row: Any) -> BookMeta:
    return BookMeta(
        slug=row.slug,
        title=row.title,
        authors=tuple(row.authors),
        language=row.language,
        original_year=row.original_year,
        edition_year=row.edition_year,
        translator=row.translator,
        translation_year=row.translation_year,
        original_title=row.original_title,
    )


def _fragments(connection: Connection, ids: list[uuid.UUID]) -> dict[uuid.UUID, Found]:
    rows = connection.execute(
        select(
            source_books,
            source_fragments.c.id.label("fragment_id"),
            source_fragments.c.path,
            source_fragments.c.content,
        )
        .join(source_fragments, source_fragments.c.book_id == source_books.c.id)
        .where(source_fragments.c.id.in_(ids))
    ).all()
    return {
        row.fragment_id: Found(
            fragment_id=row.fragment_id, meta=_meta_of(row), path=tuple(row.path), content=row.content
        )
        for row in rows
    }


def search(
    connection: Connection, query: str, query_vector: list[float], embedding_model: str, limit: int = 5
) -> list[Found]:
    """Pieces nearest to the query by meaning and by its words in the language of each book, fused by their ranks.

    Books whose vectors come from another embedding model are refused by name: vectors of two models do not compare.
    """
    if not query.strip():
        raise Invalid("Пустой запрос к библиотеке.")
    stale = connection.execute(
        select(source_books.c.slug).where(source_books.c.embedding_model != embedding_model).order_by("slug")
    ).scalars()
    if names := list(stale):
        raise Invalid(
            f"Векторы книг {', '.join(names)} посчитаны другой моделью эмбеддингов, а сейчас {embedding_model}; "
            "загрузите эти книги заново."
        )
    by_meaning = connection.execute(
        select(source_fragments.c.id)
        .order_by(source_fragments.c.embedding.cosine_distance(query_vector))
        .limit(SEARCH_DEPTH)
    ).scalars()
    words = func.websearch_to_tsquery(source_fragments.c.ts_config, query)
    by_words = connection.execute(
        select(source_fragments.c.id)
        .where(source_fragments.c.tsv.op("@@")(words))
        .order_by(func.ts_rank_cd(source_fragments.c.tsv, words).desc())
        .limit(SEARCH_DEPTH)
    ).scalars()
    scores: dict[uuid.UUID, float] = {}
    for ranked in (list(by_meaning), list(by_words)):
        for rank, fragment_id in enumerate(ranked, start=1):
            scores[fragment_id] = scores.get(fragment_id, 0.0) + 1 / (RRF_K + rank)
    best = sorted(scores, key=lambda fragment_id: scores[fragment_id], reverse=True)[:limit]
    found = _fragments(connection, best)
    return [found[fragment_id] for fragment_id in best]


def _squeeze(text: str) -> str:
    return " ".join(text.split())


@dataclass(frozen=True)
class Citation:
    quote: str
    reference: str


def cite(connection: Connection, fragment_id: uuid.UUID, quote: str) -> Citation:
    """The quotation with its reference, when it stands word for word in the piece and is not too long.

    Spaces and line breaks do not count; quotes, dashes and case do.
    """
    text = _squeeze(quote)
    if not text:
        raise Invalid("Пустая цитата.")
    if len(text) > QUOTE_MAX_CHARS:
        raise Invalid(f"Цитата длиннее {QUOTE_MAX_CHARS} знаков ({len(text)}); возьмите самое важное.")
    found = _fragments(connection, [fragment_id]).get(fragment_id)
    if found is None:
        raise NotFound("Куска библиотеки с таким id нет.")
    if text not in _squeeze(found.content):
        raise Invalid("Цитаты нет в источнике: текст должен совпадать с куском дословно.")
    return Citation(quote=text, reference=found.reference)

"""Import of a manuscript into a story (openspec/specs/api/story-import).

The file passed the checks of an upload (core/files.py): size, type and the antivirus. The text of the
screenplay of a draft is replaced and the missing characters and locations are added in one transaction;
other drafts, comments and suggestions stay as they are.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Connection, select

from core.documents import create_documents, draft_row, ensure_writable
from core.errors import Invalid
from core.files import check_upload, file_bytes, file_format, get_file, store_file
from core.importers.fdx import parse_fdx
from core.importers.fountain import parse_fountain
from core.importers.plain import parse_docx, parse_txt, text_of_txt
from core.importers.screenplay import Paragraph, build_doc, cast_from_text, places_from_text
from core.importers.starc import Named, parse_starc
from core.projects import Project, create_project
from core.tables import documents
from core.texts import Doc, Text, put_text, screenplay_id


@dataclass(frozen=True)
class Manuscript:
    """The text, and the characters and locations a project file names apart from its text (STARC)."""

    doc: Doc
    characters: list[Named] = field(default_factory=list)
    locations: list[Named] = field(default_factory=list)


def parse_manuscript(extension: str, data: bytes) -> Manuscript:
    if extension == ".starc":
        project = parse_starc(data)
        return Manuscript(build_doc(project.paragraphs), project.characters, project.locations)
    parsers = {
        ".fountain": lambda: parse_fountain(text_of_txt(data)),
        ".fdx": lambda: parse_fdx(data),
        ".docx": lambda: parse_docx(data),
        ".txt": lambda: parse_txt(data),
    }
    paragraphs: list[Paragraph] = parsers[extension]()
    return Manuscript(build_doc(paragraphs))


def _manuscript(connection: Connection, project_id: uuid.UUID, file_id: uuid.UUID) -> Manuscript:
    stored = get_file(connection, file_id)
    if stored.project_id != project_id:
        raise Invalid("Файл загружен в другую историю.", "file_id")
    if stored.purpose != "import":
        raise Invalid("Импортировать можно только файл, загруженный для импорта.", "file_id")
    data = file_bytes(connection, file_id)
    return parse_manuscript(file_format(stored.name, "import", data).extension, data)


def _add_cast_and_places(
    connection: Connection, draft_id: uuid.UUID, manuscript: Manuscript, user_id: uuid.UUID
) -> None:
    have = {
        (kind, name.upper())
        for kind, name in connection.execute(
            select(documents.c.kind, documents.c.name).where(
                documents.c.draft_id == draft_id, documents.c.deleted_at.is_(None)
            )
        ).all()
    }
    doc = manuscript.doc
    items: list[dict[str, Any]] = []
    for kind, names in (
        ("character", [*manuscript.characters, *(Named(name, "episodic") for name in cast_from_text(doc))]),
        ("location", [*manuscript.locations, *(Named(name, "episodic") for name in places_from_text(doc))]),
    ):
        for named in names:
            if (kind, named.name.upper()) not in have:
                have.add((kind, named.name.upper()))
                items.append({"kind": kind, "name": named.name, "role": named.role})
    if items:
        create_documents(connection, draft_id, items, user_id)


def import_into(
    connection: Connection, draft_id: uuid.UUID, file_id: uuid.UUID, expected_revision: int, user_id: uuid.UUID
) -> Text:
    """Replace the screenplay text of a draft by the manuscript if its revision is still `expected_revision`."""
    draft = draft_row(connection, draft_id)
    ensure_writable(connection, draft)
    manuscript = _manuscript(connection, draft.project_id, file_id)
    script_id = screenplay_id(connection, draft_id)
    text = put_text(connection, script_id, expected_revision, manuscript.doc, user_id, "import")
    _add_cast_and_places(connection, draft_id, manuscript, user_id)
    return text


def create_project_from_file(
    connection: Connection, owner_id: uuid.UUID, title: Any, name: str, data: bytes
) -> tuple[Project, uuid.UUID, uuid.UUID]:
    """A new story whose screenplay is the manuscript; the file is checked and parsed before anything is written."""
    checked = check_upload(name, "import", data)
    manuscript = parse_manuscript(checked.format.extension, checked.data)
    project, draft_id, script_id = create_project(connection, owner_id, title, text=manuscript.doc)
    store_file(connection, project.id, owner_id, "import", None, checked)
    _add_cast_and_places(connection, draft_id, manuscript, owner_id)
    return project, draft_id, script_id

"""Import of a manuscript into a story (openspec/specs/api/story-import).

The file passed the checks of an upload (core/files.py): size, type and the antivirus. The text of the
screenplay is replaced and the missing characters and locations are added in one transaction; drafts,
comments and suggestions stay as they are.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Connection, select

from core.documents import create_documents, ensure_project_open
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


def _add_cast_and_places(connection: Connection, project_id: uuid.UUID, manuscript: Manuscript) -> None:
    have = {
        (kind, name.upper())
        for kind, name in connection.execute(
            select(documents.c.kind, documents.c.name).where(
                documents.c.project_id == project_id, documents.c.deleted_at.is_(None)
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
        create_documents(connection, project_id, items)


def import_into(connection: Connection, project_id: uuid.UUID, file_id: uuid.UUID, expected_revision: int) -> Text:
    """Replace the screenplay text by the manuscript if its revision is still `expected_revision`."""
    ensure_project_open(connection, project_id)
    manuscript = _manuscript(connection, project_id, file_id)
    text = put_text(connection, screenplay_id(connection, project_id), expected_revision, manuscript.doc)
    _add_cast_and_places(connection, project_id, manuscript)
    return text


def create_project_from_file(
    connection: Connection, owner_id: uuid.UUID, title: Any, name: str, data: bytes
) -> tuple[Project, uuid.UUID]:
    """A new story whose screenplay is the manuscript; the file is checked and parsed before anything is written."""
    checked = check_upload(name, "import", data)
    manuscript = parse_manuscript(checked.format.extension, checked.data)
    project, script_id = create_project(connection, owner_id, title, text=manuscript.doc)
    store_file(connection, project.id, owner_id, "import", None, checked)
    _add_cast_and_places(connection, project.id, manuscript)
    return project, script_id

"""Import of a manuscript into a story (openspec/specs/api/story-import).

The file passed the checks of an upload (core/files.py): size, type and the antivirus. The text of the
screenplay is replaced and the missing characters and locations are added in one transaction; drafts,
comments and suggestions stay as they are.
"""

import uuid
from typing import Any

from sqlalchemy import Connection, select

from core.documents import create_documents, ensure_project_open
from core.errors import Invalid
from core.files import check_upload, file_bytes, file_format, get_file, store_file
from core.importers.fdx import parse_fdx
from core.importers.fountain import parse_fountain
from core.importers.plain import parse_docx, parse_txt, text_of_txt
from core.importers.screenplay import Paragraph, build_doc, cast_from_text, places_from_text
from core.projects import Project, create_project
from core.tables import documents
from core.texts import Doc, Text, put_text, screenplay_id


def parse_manuscript(extension: str, data: bytes) -> Doc:
    parsers = {
        ".fountain": lambda: parse_fountain(text_of_txt(data)),
        ".fdx": lambda: parse_fdx(data),
        ".docx": lambda: parse_docx(data),
        ".txt": lambda: parse_txt(data),
    }
    paragraphs: list[Paragraph] = parsers[extension]()
    return build_doc(paragraphs)


def _manuscript(connection: Connection, project_id: uuid.UUID, file_id: uuid.UUID) -> Doc:
    stored = get_file(connection, file_id)
    if stored.project_id != project_id:
        raise Invalid("Файл загружен в другую историю.", "file_id")
    if stored.purpose != "import":
        raise Invalid("Импортировать можно только файл, загруженный для импорта.", "file_id")
    data = file_bytes(connection, file_id)
    return parse_manuscript(file_format(stored.name, "import", data).extension, data)


def _add_cast_and_places(connection: Connection, project_id: uuid.UUID, doc: Doc) -> None:
    have = {
        (kind, name.upper())
        for kind, name in connection.execute(
            select(documents.c.kind, documents.c.name).where(
                documents.c.project_id == project_id, documents.c.deleted_at.is_(None)
            )
        ).all()
    }
    items: list[dict[str, Any]] = [
        {"kind": kind, "name": name, "role": "episodic"}
        for kind, names in (("character", cast_from_text(doc)), ("location", places_from_text(doc)))
        for name in names
        if (kind, name.upper()) not in have
    ]
    if items:
        create_documents(connection, project_id, items)


def import_into(connection: Connection, project_id: uuid.UUID, file_id: uuid.UUID, expected_revision: int) -> Text:
    """Replace the screenplay text by the manuscript if its revision is still `expected_revision`."""
    ensure_project_open(connection, project_id)
    doc = _manuscript(connection, project_id, file_id)
    text = put_text(connection, screenplay_id(connection, project_id), expected_revision, doc)
    _add_cast_and_places(connection, project_id, doc)
    return text


def create_project_from_file(
    connection: Connection, owner_id: uuid.UUID, title: Any, name: str, data: bytes
) -> tuple[Project, uuid.UUID]:
    """A new story whose screenplay is the manuscript; the file is checked and parsed before anything is written."""
    checked = check_upload(name, "import", data)
    doc = parse_manuscript(checked.format.extension, checked.data)
    project, script_id = create_project(connection, owner_id, title, text=doc)
    store_file(connection, project.id, owner_id, "import", None, checked)
    _add_cast_and_places(connection, project.id, doc)
    return project, script_id

"""Files of a story (openspec/specs/api/files): checked, scanned and read before they are stored.

The pipeline runs inside the upload request: size and type, the antivirus, text extraction, then one
transaction for the metadata and the bytes. A file that fails any step is not stored.
"""

import hashlib
import io
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy import Connection, Row, delete, insert, select

from core.clamav import scan
from core.documents import ensure_project_open
from core.errors import Conflict, Invalid, NotFound, TooLarge
from core.importers.fdx import parse_fdx
from core.importers.fountain import parse_fountain
from core.importers.plain import text_of_docx, text_of_txt
from core.importers.screenplay import Paragraph
from core.importers.starc import parse_starc
from core.tables import MAX_FILE_BYTES, file_contents, files


@dataclass(frozen=True)
class Format:
    extension: str
    media_type: str
    label: str


FORMATS = {
    format.extension: format
    for format in (
        Format(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"),
        Format(".pdf", "application/pdf", "PDF"),
        Format(".txt", "text/plain; charset=utf-8", "TXT"),
        Format(".md", "text/markdown; charset=utf-8", "Markdown"),
        Format(".fountain", "text/x-fountain; charset=utf-8", "Fountain"),
        Format(".fdx", "application/xml", "Final Draft"),
        Format(".starc", "application/x-starc", "STARC"),
    )
}
ALLOWED = {
    "chat": (".docx", ".pdf", ".txt", ".md", ".fountain", ".fdx", ".starc"),
    "import": (".fountain", ".fdx", ".starc", ".docx", ".txt"),
    # The original of a note (openspec/specs/api/stories, «Заметка из файла»): the same as a file of a conversation.
    "note": (".docx", ".pdf", ".txt", ".md", ".fountain", ".fdx", ".starc"),
}
# Purposes the upload route takes; originals of notes come only through the notes routes.
UPLOAD_PURPOSES = ("chat", "import")


@dataclass(frozen=True)
class StoredFile:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    media_type: str
    size_bytes: int
    purpose: str
    session_id: str | None
    created_at: datetime
    uploaded_by: uuid.UUID


def _stored(row: Row[Any]) -> StoredFile:
    return StoredFile(
        row.id,
        row.project_id,
        row.name,
        row.media_type,
        row.size_bytes,
        row.purpose,
        row.session_id,
        row.created_at,
        row.uploaded_by,
    )


def file_format(name: str, purpose: str, data: bytes) -> Format:
    """The format by the extension, confirmed by the content; refuses another type or a mismatch."""
    extension = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in ALLOWED[purpose]:
        allowed = ", ".join(FORMATS[e].label for e in ALLOWED[purpose])
        raise Invalid(f"Тип файла не поддерживается. Можно: {allowed}.", "file")
    signatures = {
        ".docx": data.startswith(b"PK\x03\x04"),
        ".pdf": data.startswith(b"%PDF-"),
        ".fdx": data.lstrip(b"\xef\xbb\xbf \t\r\n").startswith((b"<?xml", b"<FinalDraft")),
        ".starc": data.startswith(b"SQLite format 3\0"),
    }
    if not signatures.get(extension, True):
        raise Invalid(f"Содержимое файла не похоже на {FORMATS[extension].label}.", "file")
    return FORMATS[extension]


def _starts_lower(line: str) -> bool:
    return line[:1].islower()


def paragraphs_of_page(text: str) -> str:
    """Lines of a PDF page joined into paragraphs (openspec/specs/api/files, «Абзацы текста PDF»).

    A line goes on with the next one when the next starts with a lowercase letter or the line ends with a comma; a
    hyphen at the end before a lowercase letter is a broken word and goes away. Other line breaks stay, so lines of
    details, headings and tables keep their own lines.
    """
    out = ""
    for line in text.split("\n"):
        line = line.strip()
        if not out:
            out = line
            continue
        previous = out.rsplit("\n", 1)[-1]
        if previous and line and _starts_lower(line):
            if previous.endswith("-") and previous[-2:-1].isalpha():
                out = out[:-1] + line
            else:
                out = f"{out} {line}"
        elif previous.endswith(",") and line:
            out = f"{out} {line}"
        else:
            out = f"{out}\n{line}"
    return out


def pdf_text(data: bytes) -> str:
    """Text of a PDF by paragraphs; a PDF without text is refused (also the library of sources, sources/convert.py)."""
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [paragraphs_of_page(page.extract_text() or "") for page in reader.pages]
    except (PdfReadError, ValueError, KeyError) as error:
        raise Invalid(f"Файл PDF не читается: {error}.") from error
    text = "\n\n".join(page.strip() for page in pages if page.strip())
    if not text:
        raise Invalid("В файле PDF нет текста: возможно, это сканы страниц.")
    return text


def _text_of_paragraphs(paragraphs: list[Paragraph]) -> str:
    return "\n".join("".join(run.text for run in paragraph.runs) for paragraph in paragraphs if paragraph.runs)


def extract_text(format: Format, data: bytes) -> str:
    """Text of the file for the co-author; a file that does not read is refused."""
    match format.extension:
        case ".docx":
            return text_of_docx(data)
        case ".pdf":
            return pdf_text(data)
        case ".txt" | ".md":
            return text_of_txt(data)
        case ".fountain":
            return _text_of_paragraphs(parse_fountain(text_of_txt(data)))
        case ".fdx":
            return _text_of_paragraphs(parse_fdx(data))
        case ".starc":
            return _text_of_paragraphs(parse_starc(data).paragraphs)
    raise AssertionError(f"No text extraction for {format.extension}")


def check_session(project_id: uuid.UUID, purpose: str, session_id: str | None) -> None:
    if purpose not in UPLOAD_PURPOSES:
        raise Invalid("Поле «purpose» должно быть chat или import.", "purpose")
    if purpose == "chat":
        if not session_id or not session_id.startswith(f"{project_id}:"):
            raise Invalid("Файл чата должен относиться к беседе этой истории.", "session_id")
    elif session_id is not None:
        raise Invalid("У файла импорта нет беседы.", "session_id")


@dataclass(frozen=True)
class CheckedFile:
    """A file that passed size, type, the antivirus and text extraction, not stored yet."""

    name: str
    format: Format
    data: bytes
    text: str


def check_upload(name: str, purpose: str, data: bytes) -> CheckedFile:
    """Size, type by extension and content, the antivirus, then the text: nothing is stored here."""
    name = name.strip()
    if not name:
        raise Invalid("У файла нет имени.", "file")
    if not data:
        raise Invalid("Файл пустой.", "file")
    if len(data) > MAX_FILE_BYTES:
        raise TooLarge(f"Файл больше {MAX_FILE_BYTES // (1024 * 1024)} МБ.")
    format = file_format(name, purpose, data)
    if scan(data) is not None:
        raise Invalid("Файл не прошёл антивирусную проверку.", "file")
    return CheckedFile(name, format, data, extract_text(format, data))


def store_file(
    connection: Connection,
    project_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    purpose: str,
    session_id: str | None,
    checked: CheckedFile,
) -> StoredFile:
    row = connection.execute(
        insert(files)
        .values(
            project_id=project_id,
            uploaded_by=uploaded_by,
            purpose=purpose,
            session_id=session_id,
            name=checked.name,
            media_type=checked.format.media_type,
            size_bytes=len(checked.data),
            sha256=hashlib.sha256(checked.data).hexdigest(),
            text_content=checked.text,
        )
        .returning(files)
    ).one()
    connection.execute(insert(file_contents).values(file_id=row.id, bytes=checked.data))
    return _stored(row)


def upload_file(
    connection: Connection,
    project_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    name: str,
    purpose: str,
    session_id: str | None,
    data: bytes,
) -> StoredFile:
    ensure_project_open(connection, project_id)
    check_session(project_id, purpose, session_id)
    return store_file(connection, project_id, uploaded_by, purpose, session_id, check_upload(name, purpose, data))


def get_file(connection: Connection, file_id: uuid.UUID) -> StoredFile:
    row = connection.execute(select(files).where(files.c.id == file_id)).one_or_none()
    if row is None:
        raise NotFound(f"Файла {file_id} нет.")
    return _stored(row)


def file_bytes(connection: Connection, file_id: uuid.UUID) -> bytes:
    get_file(connection, file_id)
    data: bytes = connection.execute(
        select(file_contents.c.bytes).where(file_contents.c.file_id == file_id)
    ).scalar_one()
    return data


def file_text(connection: Connection, file_id: uuid.UUID) -> str:
    get_file(connection, file_id)
    text: str = connection.execute(select(files.c.text_content).where(files.c.id == file_id)).scalar_one()
    return text


def checked_of_stored(connection: Connection, file_id: uuid.UUID) -> CheckedFile:
    """A stored file as it was checked on upload: it passed size, type, the antivirus and text extraction then."""
    stored = get_file(connection, file_id)
    extension = "." + stored.name.rsplit(".", 1)[-1].lower()
    return CheckedFile(stored.name, FORMATS[extension], file_bytes(connection, file_id), file_text(connection, file_id))


def delete_file(connection: Connection, file_id: uuid.UUID) -> None:
    if get_file(connection, file_id).purpose == "note":
        raise Conflict(
            "Оригинал заметки удаляется вместе с заметкой или действием заметки «Удалить оригинал, оставить текст»."
        )
    connection.execute(delete(files).where(files.c.id == file_id))

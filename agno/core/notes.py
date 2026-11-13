"""Notes of the author (openspec/specs/api/stories: «Заметки истории» … «Место для оригиналов заметок»).

A note belongs to the story: only the trash of the story stops a change, never a draft or its lock. A note made from a
file keeps the file as its original (purpose `note`): the text is the author's to edit, the original never changes and
goes only together with the note.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select, update

from core.documents import ensure_project_open
from core.errors import Conflict, Invalid, NotFound, TooLarge
from core.files import CheckedFile, checked_of_stored, extract_text, file_bytes, file_format, get_file, store_file
from core.snapshots import revision_conflict
from core.tables import files, notes, projects, users

# The longest text of a note made from a file: longer ones slow the screen and fill the co-author's context.
MAX_FILE_TEXT_CHARS = 500_000
MIB = 1024 * 1024


@dataclass(frozen=True)
class NoteFile:
    """The original of a note."""

    id: uuid.UUID
    name: str
    media_type: str
    size_bytes: int


@dataclass(frozen=True)
class Note:
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    body: str
    revision: int
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    file: NoteFile | None


_COLUMNS = (
    *notes.c,
    files.c.name.label("file_name"),
    files.c.media_type.label("file_media_type"),
    files.c.size_bytes.label("file_size_bytes"),
)


def _select() -> Any:
    return select(*_COLUMNS).select_from(notes.outerjoin(files, files.c.id == notes.c.file_id))


def _note(row: Any) -> Note:
    original = (
        None
        if row.file_id is None
        else NoteFile(
            id=row.file_id, name=row.file_name, media_type=row.file_media_type, size_bytes=row.file_size_bytes
        )
    )
    return Note(
        id=row.id,
        project_id=row.project_id,
        title=row.title,
        body=row.body,
        revision=row.revision,
        updated_by=row.updated_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
        file=original,
    )


def _title(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Название заметки не может быть пустым.", "title")
    return value.strip()


def _body(value: Any) -> str:
    if not isinstance(value, str):
        raise Invalid("Поле «body» должно быть строкой.", "body")
    return value


def note_row(connection: Connection, note_id: uuid.UUID, for_update: bool = False) -> Note:
    query = _select().where(notes.c.id == note_id)
    if for_update:
        query = query.with_for_update(of=notes)
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Заметки {note_id} нет.")
    return _note(row)


def project_of_note(connection: Connection, note_id: uuid.UUID) -> uuid.UUID:
    return note_row(connection, note_id).project_id


def list_notes(connection: Connection, project_id: uuid.UUID) -> list[Note]:
    rows = connection.execute(
        _select().where(notes.c.project_id == project_id).order_by(notes.c.created_at, notes.c.id)
    ).all()
    return [_note(row) for row in rows]


def _insert(
    connection: Connection,
    project_id: uuid.UUID,
    title: str,
    body: str,
    user_id: uuid.UUID,
    file_id: uuid.UUID | None = None,
) -> Note:
    note_id = connection.execute(
        insert(notes)
        .values(
            # The time of the statement: notes of one transaction keep their order.
            created_at=func.clock_timestamp(),
            project_id=project_id,
            title=title,
            body=body,
            updated_by=user_id,
            file_id=file_id,
        )
        .returning(notes.c.id)
    ).scalar_one()
    return note_row(connection, note_id)


def create_note(connection: Connection, project_id: uuid.UUID, title: Any, body: Any, user_id: uuid.UUID) -> Note:
    ensure_project_open(connection, project_id)
    return _insert(connection, project_id, _title(title), _body(body), user_id)


def _count(number: int) -> str:
    return f"{number:,}".replace(",", " ")


def _megabytes(size: int) -> str:
    return f"{size / MIB:.1f}".removesuffix(".0").replace(".", ",")


def create_note_from_file(
    connection: Connection, project_id: uuid.UUID, user_id: uuid.UUID, checked: CheckedFile, limit_bytes: int
) -> Note:
    """A note with the file as its original and the file's text, if the text fits and the owner's place does.

    The place is the originals of notes of all the stories of the story's owner, the trash included, whoever uploaded
    them (openspec/specs/api/stories, «Место для оригиналов заметок»); `limit_bytes` comes from the owner's plan. The
    owner's row stays locked to the end of the transaction, so two uploads cannot both fit.
    """
    ensure_project_open(connection, project_id)
    title = checked.name.rsplit(".", 1)[0].strip()
    if not title:
        raise Invalid("У файла нет имени: заметке нужно название.", "file")
    if len(checked.text) > MAX_FILE_TEXT_CHARS:
        raise Invalid(
            f"Текст файла длиннее {_count(MAX_FILE_TEXT_CHARS)} знаков: в нём {_count(len(checked.text))}. "
            "Загрузите часть файла.",
            "file",
        )
    owner = connection.execute(select(projects.c.owner_id).where(projects.c.id == project_id)).scalar_one()
    connection.execute(select(users.c.id).where(users.c.id == owner).with_for_update()).one()
    used = connection.execute(
        select(func.coalesce(func.sum(files.c.size_bytes), 0))
        .join(projects, projects.c.id == files.c.project_id)
        .where(files.c.purpose == "note", projects.c.owner_id == owner)
    ).scalar_one()
    if used + len(checked.data) > limit_bytes:
        raise TooLarge(
            f"Место для файлов заметок кончилось: занято {_megabytes(used)} МБ из {_megabytes(limit_bytes)} МБ."
        )
    stored = store_file(connection, project_id, user_id, "note", None, checked)
    return _insert(connection, project_id, title, checked.text, user_id, stored.id)


def create_note_from_chat_file(
    connection: Connection, file_id: uuid.UUID, user_id: uuid.UUID, limit_bytes: int
) -> Note:
    """A note with a copy of a file of a conversation; the file of the conversation stays as it is."""
    stored = get_file(connection, file_id)
    if stored.purpose != "chat":
        raise Invalid("В заметку сохраняется только файл беседы.", "file")
    return create_note_from_file(
        connection, stored.project_id, user_id, checked_of_stored(connection, file_id), limit_bytes
    )


def update_note(
    connection: Connection, note_id: uuid.UUID, expected_revision: int, changes: dict[str, Any], user_id: uuid.UUID
) -> Note:
    """Change the title or the text if the revision is still `expected_revision`."""
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is not None:
        raise Conflict("Заметка в корзине: сначала восстановите её.")
    if note.revision != expected_revision:
        raise revision_conflict(
            connection,
            f"Заметка изменилась: ревизия {note.revision}, а не {expected_revision}.",
            note.updated_by,
            user_id,
            "fields",
            None,
        )
    unknown = set(changes) - {"title", "body"}
    if unknown:
        name = sorted(unknown)[0]
        raise Invalid(f"Поле «{name}» нельзя менять здесь.", name)
    if not changes:
        raise Invalid("Передайте title или body.")
    values: dict[str, Any] = {}
    if "title" in changes:
        values["title"] = _title(changes["title"])
    if "body" in changes:
        values["body"] = _body(changes["body"])
    connection.execute(
        update(notes)
        .where(notes.c.id == note_id)
        .values(**values, revision=notes.c.revision + 1, updated_by=user_id, updated_at=func.now())
    )
    return note_row(connection, note_id)


def _changeable_original(
    connection: Connection, note_id: uuid.UUID, expected_revision: int, user_id: uuid.UUID
) -> NoteFile:
    """The original of a note the author may act on now: the note and its story are open, the revision holds."""
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is not None:
        raise Conflict("Заметка в корзине: сначала восстановите её.")
    if note.revision != expected_revision:
        raise revision_conflict(
            connection,
            f"Заметка изменилась: ревизия {note.revision}, а не {expected_revision}.",
            note.updated_by,
            user_id,
            "fields",
            None,
        )
    if note.file is None:
        raise Conflict("У заметки нет оригинала.")
    return note.file


def remove_note_file(connection: Connection, note_id: uuid.UUID, expected_revision: int, user_id: uuid.UUID) -> Note:
    """Delete the original of a note for good and keep its title and text («Удаление оригинала заметки»).

    The place of the user's plan frees with the row of the file: the place is the sum of the originals.
    """
    original = _changeable_original(connection, note_id, expected_revision, user_id)
    connection.execute(
        update(notes)
        .where(notes.c.id == note_id)
        .values(file_id=None, revision=notes.c.revision + 1, updated_by=user_id, updated_at=func.now())
    )
    connection.execute(delete(files).where(files.c.id == original.id))
    return note_row(connection, note_id)


def note_text_from_file(connection: Connection, note_id: uuid.UUID, expected_revision: int, user_id: uuid.UUID) -> Note:
    """Replace the text of a note with the text read again from its original («Текст заметки из оригинала»).

    The text comes from the bytes by the current rules of extraction, not from the text stored on upload, so an old
    note gets the current rules; the stored text of the file stays as the file was uploaded.
    """
    original = _changeable_original(connection, note_id, expected_revision, user_id)
    data = file_bytes(connection, original.id)
    text = extract_text(file_format(original.name, "note", data), data)
    if len(text) > MAX_FILE_TEXT_CHARS:
        raise Invalid(
            f"Текст оригинала длиннее {_count(MAX_FILE_TEXT_CHARS)} знаков: в нём {_count(len(text))}.", "file"
        )
    return update_note(connection, note_id, expected_revision, {"body": text}, user_id)


def update_note_by_coauthor(
    connection: Connection, note_id: uuid.UUID, changes: dict[str, Any], user_id: uuid.UUID
) -> Note:
    """A change of the co-author on the current revision: the title, the text, or `append` to the end of the text.

    `append` goes on a new line after the text; it cannot come together with `body`.
    """
    if "append" in changes:
        if "body" in changes:
            raise Invalid("Передайте либо новый текст, либо то, что дописать, но не оба.", "append")
        addition = _body(changes["append"])
        if not addition.strip():
            raise Invalid("Дописать можно только непустой текст.", "append")
    note = note_row(connection, note_id, for_update=True)
    values = {key: value for key, value in changes.items() if key != "append"}
    if "append" in changes:
        values["body"] = f"{note.body}\n{addition}" if note.body else addition
    return update_note(connection, note_id, note.revision, values, user_id)


def trash_note(connection: Connection, note_id: uuid.UUID) -> Note:
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is not None:
        raise Conflict("Заметка уже в корзине.")
    connection.execute(update(notes).where(notes.c.id == note_id).values(deleted_at=func.now()))
    return note_row(connection, note_id)


def restore_note(connection: Connection, note_id: uuid.UUID) -> Note:
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is None:
        raise Conflict("Заметка не в корзине.")
    connection.execute(update(notes).where(notes.c.id == note_id).values(deleted_at=None))
    return note_row(connection, note_id)


def delete_notes(connection: Connection, note_ids: list[uuid.UUID]) -> None:
    """Delete notes for good together with their originals."""
    originals = (
        connection.execute(select(notes.c.file_id).where(notes.c.id.in_(note_ids), notes.c.file_id.is_not(None)))
        .scalars()
        .all()
    )
    connection.execute(delete(notes).where(notes.c.id.in_(note_ids)))
    if originals:
        connection.execute(delete(files).where(files.c.id.in_(originals)))


def delete_note(connection: Connection, note_id: uuid.UUID) -> None:
    """Delete for good a note from the trash, with its original."""
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is None:
        raise Conflict("Удалить навсегда можно только заметку из корзины.")
    delete_notes(connection, [note_id])

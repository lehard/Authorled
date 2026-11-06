"""Notes of the author (openspec/specs/api/stories: «Заметки истории» … «Заметки и драфты»).

A note belongs to the story: only the trash of the story stops a change, never a draft or its lock.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select, update

from core.documents import ensure_project_open
from core.errors import Conflict, Invalid, NotFound
from core.tables import notes


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


def _note(row: Any) -> Note:
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
    query = select(notes).where(notes.c.id == note_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Заметки {note_id} нет.")
    return _note(row)


def project_of_note(connection: Connection, note_id: uuid.UUID) -> uuid.UUID:
    return note_row(connection, note_id).project_id


def list_notes(connection: Connection, project_id: uuid.UUID) -> list[Note]:
    rows = connection.execute(
        select(notes).where(notes.c.project_id == project_id).order_by(notes.c.created_at, notes.c.id)
    ).all()
    return [_note(row) for row in rows]


def create_note(connection: Connection, project_id: uuid.UUID, title: Any, body: Any, user_id: uuid.UUID) -> Note:
    ensure_project_open(connection, project_id)
    row = connection.execute(
        insert(notes)
        .values(
            # The time of the statement: notes of one transaction keep their order.
            created_at=func.clock_timestamp(),
            project_id=project_id,
            title=_title(title),
            body=_body(body),
            updated_by=user_id,
        )
        .returning(notes)
    ).one()
    return _note(row)


def update_note(
    connection: Connection, note_id: uuid.UUID, expected_revision: int, changes: dict[str, Any], user_id: uuid.UUID
) -> Note:
    """Change the title or the text if the revision is still `expected_revision`."""
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is not None:
        raise Conflict("Заметка в корзине: сначала восстановите её.")
    if note.revision != expected_revision:
        raise Conflict(f"Заметка изменилась: ревизия {note.revision}, а не {expected_revision}.")
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
    row = connection.execute(
        update(notes)
        .where(notes.c.id == note_id)
        .values(**values, revision=notes.c.revision + 1, updated_by=user_id, updated_at=func.now())
        .returning(notes)
    ).one()
    return _note(row)


def trash_note(connection: Connection, note_id: uuid.UUID) -> Note:
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is not None:
        raise Conflict("Заметка уже в корзине.")
    row = connection.execute(
        update(notes).where(notes.c.id == note_id).values(deleted_at=func.now()).returning(notes)
    ).one()
    return _note(row)


def restore_note(connection: Connection, note_id: uuid.UUID) -> Note:
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is None:
        raise Conflict("Заметка не в корзине.")
    row = connection.execute(update(notes).where(notes.c.id == note_id).values(deleted_at=None).returning(notes)).one()
    return _note(row)


def delete_note(connection: Connection, note_id: uuid.UUID) -> None:
    """Delete for good a note from the trash."""
    note = note_row(connection, note_id, for_update=True)
    ensure_project_open(connection, note.project_id)
    if note.deleted_at is None:
        raise Conflict("Удалить навсегда можно только заметку из корзины.")
    connection.execute(delete(notes).where(notes.c.id == note_id))

"""Drafts of a story: equal parallel versions, each a copy of another (openspec/specs/api/stories, «Драфты»).

A draft owns its screenplay, cards, review, conversations, snapshots and points. After the copy nothing links the
drafts but the name of the base, kept for the label «от Драфта 1».
"""

import uuid
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as upsert

from core.documents import (
    Draft,
    draft_of,
    draft_row,
    ensure_draft_open,
    ensure_project_open,
    ensure_writable,
)
from core.errors import Conflict, Invalid, NotFound
from core.notes import delete_notes
from core.tables import documents, draft_opens, drafts, notes
from core.texts import add_text, strip_marks, text_row

FIRST_DRAFT = "Драфт 1"


def _name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Название драфта не может быть пустым.", "name")
    return value.strip()


def project_of_draft(connection: Connection, draft_id: uuid.UUID) -> uuid.UUID:
    return draft_row(connection, draft_id).project_id


def add_first_draft(connection: Connection, project_id: uuid.UUID) -> uuid.UUID:
    return connection.execute(
        insert(drafts).values(project_id=project_id, name=FIRST_DRAFT).returning(drafts.c.id)
    ).scalar_one()


def list_drafts(connection: Connection, project_id: uuid.UUID) -> list[Draft]:
    rows = connection.execute(
        select(drafts).where(drafts.c.project_id == project_id).order_by(drafts.c.created_at, drafts.c.id)
    ).all()
    return [draft_of(row) for row in rows]


def count_drafts(connection: Connection, project_id: uuid.UUID) -> int:
    return connection.execute(
        select(func.count()).where(drafts.c.project_id == project_id, drafts.c.deleted_at.is_(None))
    ).scalar_one()


def create_draft(
    connection: Connection, project_id: uuid.UUID, name: Any, base_id: uuid.UUID, user_id: uuid.UUID
) -> Draft:
    """A copy of the screenplay, its passport and the cards of the base; review and history stay with the base."""
    title = _name(name)
    base = draft_row(connection, base_id)
    if base.project_id != project_id:
        raise NotFound("Основа драфта не найдена в этой истории.")
    ensure_draft_open(connection, base)
    row = connection.execute(
        insert(drafts)
        .values(
            created_at=func.clock_timestamp(),
            project_id=project_id,
            name=title,
            forked_from_id=base.id,
            forked_from_name=base.name,
        )
        .returning(drafts)
    ).one()
    originals = connection.execute(
        select(documents).where(documents.c.draft_id == base_id, documents.c.deleted_at.is_(None))
    ).all()
    for original in originals:
        copy_id = connection.execute(
            insert(documents)
            .values(
                project_id=project_id,
                draft_id=row.id,
                kind=original.kind,
                name=original.name,
                role=original.role,
                summary=original.summary,
                position=original.position,
                fields=original.fields,
                updated_by=user_id,
            )
            .returning(documents.c.id)
        ).scalar_one()
        if original.kind == "script":
            content = strip_marks(text_row(connection, original.id).content, ("comment", "suggestion"))
            add_text(connection, copy_id, content, user_id)
    return draft_of(row)


def update_draft(connection: Connection, draft_id: uuid.UUID, changes: dict[str, Any]) -> Draft:
    """Rename a draft or set its lock: both work on a locked draft, which is how it opens again."""
    ensure_draft_open(connection, draft_row(connection, draft_id, for_update=True))
    unknown = set(changes) - {"name", "locked"}
    if unknown:
        name = sorted(unknown)[0]
        raise Invalid(f"Поле «{name}» нельзя менять здесь.", name)
    if not changes:
        raise Invalid("Передайте name или locked.")
    values: dict[str, Any] = {}
    if "name" in changes:
        values["name"] = _name(changes["name"])
    if "locked" in changes:
        if not isinstance(changes["locked"], bool):
            raise Invalid("Поле «locked» должно быть true или false.", "locked")
        values["locked"] = changes["locked"]
    row = connection.execute(
        update(drafts).where(drafts.c.id == draft_id).values(**values, updated_at=func.now()).returning(drafts)
    ).one()
    return draft_of(row)


def trash_draft(connection: Connection, draft_id: uuid.UUID) -> Draft:
    draft = draft_row(connection, draft_id, for_update=True)
    ensure_draft_open(connection, draft)
    if count_drafts(connection, draft.project_id) <= 1:
        raise Conflict("Последний драфт истории не удаляется.")
    row = connection.execute(
        update(drafts).where(drafts.c.id == draft_id).values(deleted_at=func.now()).returning(drafts)
    ).one()
    return draft_of(row)


def restore_draft(connection: Connection, draft_id: uuid.UUID) -> Draft:
    draft = draft_row(connection, draft_id, for_update=True)
    ensure_project_open(connection, draft.project_id)
    if draft.deleted_at is None:
        raise Conflict("Драфт не в корзине.")
    row = connection.execute(
        update(drafts).where(drafts.c.id == draft_id).values(deleted_at=None).returning(drafts)
    ).one()
    return draft_of(row)


def delete_draft(connection: Connection, draft_id: uuid.UUID) -> None:
    """Delete for good a draft from the trash, with everything in it."""
    draft = draft_row(connection, draft_id, for_update=True)
    if draft.deleted_at is None:
        raise Conflict("Удалить навсегда можно только драфт из корзины.")
    connection.execute(delete(drafts).where(drafts.c.id == draft_id))


def empty_trash(connection: Connection, draft_id: uuid.UUID) -> None:
    """Delete for good the documents in the trash of this draft, the drafts and the notes in the trash of the story.

    Notes go with their originals.
    """
    draft = draft_row(connection, draft_id)
    ensure_writable(connection, draft)
    connection.execute(delete(documents).where(documents.c.draft_id == draft_id, documents.c.deleted_at.is_not(None)))
    connection.execute(delete(drafts).where(drafts.c.project_id == draft.project_id, drafts.c.deleted_at.is_not(None)))
    trashed = (
        connection.execute(
            select(notes.c.id).where(notes.c.project_id == draft.project_id, notes.c.deleted_at.is_not(None))
        )
        .scalars()
        .all()
    )
    delete_notes(connection, list(trashed))


def open_draft(connection: Connection, draft_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Remember the draft as the last one this user opened in the story."""
    draft = draft_row(connection, draft_id)
    ensure_draft_open(connection, draft)
    statement = upsert(draft_opens).values(user_id=user_id, project_id=draft.project_id, draft_id=draft_id)
    connection.execute(
        statement.on_conflict_do_update(
            index_elements=[draft_opens.c.user_id, draft_opens.c.project_id],
            set_={"draft_id": draft_id, "opened_at": func.now()},
        )
    )


def open_draft_id(connection: Connection, user_id: uuid.UUID, project_id: uuid.UUID) -> uuid.UUID:
    """The draft the story opens in: the last one opened, else the one changed last outside the trash."""
    opened = connection.execute(
        select(drafts.c.id)
        .join(draft_opens, draft_opens.c.draft_id == drafts.c.id)
        .where(
            draft_opens.c.user_id == user_id,
            draft_opens.c.project_id == project_id,
            drafts.c.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if opened is not None:
        return opened
    return connection.execute(
        select(drafts.c.id)
        .where(drafts.c.project_id == project_id, drafts.c.deleted_at.is_(None))
        .order_by(drafts.c.updated_at.desc(), drafts.c.created_at.desc())
        .limit(1)
    ).scalar_one()

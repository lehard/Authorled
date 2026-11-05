"""History of a document and points of a draft (openspec/specs/api/stories: «История документа», «Откат документа»,
«Точка драфта», «Откат к точке»).

A rollback never loses the present state: a document keeps it as a snapshot, a draft as an automatic point. Old
texts can hold marks whose review is gone; restoring drops those marks, the threads and suggestions stay.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, func, insert, select, update

from core.documents import (
    Document,
    draft_row,
    ensure_draft_open,
    ensure_writable,
    fields_state,
    list_documents,
    restore_fields,
    touch_draft,
)
from core.errors import Invalid, NotFound
from core.tables import (
    VERSION_PARTS,
    comment_threads,
    document_versions,
    documents,
    draft_points,
    suggestions,
    users,
)
from core.texts import Doc, filter_marks, put_text, text_row, write_text


@dataclass(frozen=True)
class Version:
    id: uuid.UUID
    document_id: uuid.UUID
    part: str
    reason: str
    saved_by: uuid.UUID
    saved_by_name: str
    saved_at: datetime
    content: dict[str, Any]


@dataclass(frozen=True)
class Point:
    id: uuid.UUID
    draft_id: uuid.UUID
    name: str
    kind: str
    created_by: uuid.UUID
    created_by_name: str
    created_at: datetime


def _version_query() -> Any:
    return select(document_versions, users.c.display_name).join(users, users.c.id == document_versions.c.saved_by)


def _version(row: Any) -> Version:
    return Version(
        row.id, row.document_id, row.part, row.reason, row.saved_by, row.display_name, row.saved_at, row.content
    )


def list_versions(connection: Connection, document_id: uuid.UUID, part: object) -> list[Version]:
    if part not in VERSION_PARTS:
        raise Invalid(f"Параметр «part» должен быть одним из: {', '.join(VERSION_PARTS)}.", "part")
    rows = connection.execute(
        _version_query()
        .where(document_versions.c.document_id == document_id, document_versions.c.part == part)
        .order_by(document_versions.c.created_at.desc(), document_versions.c.saved_at.desc())
    ).all()
    return [_version(row) for row in rows]


def get_version(connection: Connection, version_id: uuid.UUID) -> Version:
    row = connection.execute(_version_query().where(document_versions.c.id == version_id)).one_or_none()
    if row is None:
        raise NotFound(f"Снимка {version_id} нет.")
    return _version(row)


def document_of_version(connection: Connection, version_id: uuid.UUID) -> uuid.UUID:
    return get_version(connection, version_id).document_id


def _live_marks(connection: Connection, document_id: uuid.UUID, doc: Doc) -> Doc:
    """The text without comment marks of deleted threads and suggestion marks of decided suggestions."""
    threads = {
        str(thread)
        for thread in connection.execute(
            select(comment_threads.c.id).where(comment_threads.c.document_id == document_id)
        ).scalars()
    }
    open_suggestions = {
        str(suggestion)
        for suggestion in connection.execute(
            select(suggestions.c.id).where(suggestions.c.document_id == document_id, suggestions.c.status == "open")
        ).scalars()
    }

    def keep(mark: dict[str, Any]) -> bool:
        if mark["type"] == "comment":
            return mark["attrs"]["id"] in threads
        if mark["type"] == "suggestion":
            return mark["attrs"]["id"] in open_suggestions
        return True

    return filter_marks(doc, keep)


def restore_version(connection: Connection, version_id: uuid.UUID, expected_revision: int, user_id: uuid.UUID) -> int:
    """Return one part of a document to a snapshot if its revision is still `expected_revision`; the new revision."""
    version = get_version(connection, version_id)
    if version.part == "text":
        content = _live_marks(connection, version.document_id, version.content)
        return put_text(connection, version.document_id, expected_revision, content, user_id, "restore").revision
    return restore_fields(connection, version.document_id, expected_revision, version.content, user_id).revision


def _point_query() -> Any:
    return select(
        draft_points.c.id,
        draft_points.c.draft_id,
        draft_points.c.name,
        draft_points.c.kind,
        draft_points.c.created_by,
        users.c.display_name,
        draft_points.c.created_at,
    ).join(users, users.c.id == draft_points.c.created_by)


def _point(row: Any) -> Point:
    return Point(row.id, row.draft_id, row.name, row.kind, row.created_by, row.display_name, row.created_at)


def list_points(connection: Connection, draft_id: uuid.UUID) -> list[Point]:
    rows = connection.execute(
        _point_query()
        .where(draft_points.c.draft_id == draft_id)
        .order_by(draft_points.c.created_at.desc(), draft_points.c.id)
    ).all()
    return [_point(row) for row in rows]


def _document_state(connection: Connection, document: Document) -> dict[str, Any]:
    state = {
        "id": str(document.id),
        "kind": document.kind,
        "position": document.position,
        **fields_state(document),
    }
    if document.kind == "script":
        state["text"] = text_row(connection, document.id).content
    return state


def _save_point(connection: Connection, draft_id: uuid.UUID, name: str, kind: str, user_id: uuid.UUID) -> Point:
    content = {
        "documents": [
            _document_state(connection, document)
            for document in list_documents(connection, draft_id)
            if document.deleted_at is None
        ]
    }
    point_id = connection.execute(
        insert(draft_points)
        .values(
            created_at=func.clock_timestamp(),
            draft_id=draft_id,
            name=name,
            kind=kind,
            content=content,
            created_by=user_id,
        )
        .returning(draft_points.c.id)
    ).scalar_one()
    return _point(connection.execute(_point_query().where(draft_points.c.id == point_id)).one())


def create_point(connection: Connection, draft_id: uuid.UUID, name: object, user_id: uuid.UUID) -> Point:
    if not isinstance(name, str) or not name.strip():
        raise Invalid("Название точки не может быть пустым.", "name")
    ensure_draft_open(connection, draft_row(connection, draft_id))
    return _save_point(connection, draft_id, name.strip(), "manual", user_id)


def draft_of_point(connection: Connection, point_id: uuid.UUID) -> uuid.UUID:
    draft_id = connection.execute(
        select(draft_points.c.draft_id).where(draft_points.c.id == point_id)
    ).scalar_one_or_none()
    if draft_id is None:
        raise NotFound(f"Точки {point_id} нет.")
    return draft_id


def _restore_document(
    connection: Connection, project_id: uuid.UUID, draft_id: uuid.UUID, state: dict[str, Any], user_id: uuid.UUID
) -> None:
    document_id = uuid.UUID(state["id"])
    values = {key: state[key] for key in ("name", "role", "summary", "position", "fields")}
    row = connection.execute(select(documents).where(documents.c.id == document_id).with_for_update()).one_or_none()
    if row is None:
        connection.execute(
            insert(documents).values(
                id=document_id,
                project_id=project_id,
                draft_id=draft_id,
                kind=state["kind"],
                updated_by=user_id,
                **values,
            )
        )
    elif row.deleted_at is not None or any(getattr(row, key) != value for key, value in values.items()):
        connection.execute(
            update(documents)
            .where(documents.c.id == document_id)
            .values(
                **values,
                deleted_at=None,
                revision=documents.c.revision + 1,
                updated_by=user_id,
                updated_at=func.now(),
            )
        )
    if "text" in state:
        current = text_row(connection, document_id, for_update=True)
        content = _live_marks(connection, document_id, state["text"])
        if current.content != content:
            write_text(connection, document_id, content, user_id)


def restore_point(connection: Connection, point_id: uuid.UUID, user_id: uuid.UUID) -> Point:
    """Return a whole draft to a point; the present state becomes an automatic point, which undoes the rollback.

    Documents of the point come back even if they were deleted; documents made after the point go to the trash.
    """
    row = connection.execute(
        select(draft_points.c.draft_id, draft_points.c.name, draft_points.c.content).where(
            draft_points.c.id == point_id
        )
    ).one_or_none()
    if row is None:
        raise NotFound(f"Точки {point_id} нет.")
    draft = draft_row(connection, row.draft_id, for_update=True)
    ensure_writable(connection, draft)
    saved = _save_point(connection, draft.id, f"Перед откатом к «{row.name}»", "auto", user_id)
    states = row.content["documents"]
    for state in states:
        _restore_document(connection, draft.project_id, draft.id, state, user_id)
    kept = [uuid.UUID(state["id"]) for state in states]
    connection.execute(
        update(documents)
        .where(documents.c.draft_id == draft.id, documents.c.deleted_at.is_(None), documents.c.id.not_in(kept))
        .values(deleted_at=func.now())
    )
    touch_draft(connection, draft.id)
    return saved

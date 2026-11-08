"""Documents of a draft: characters, locations, worlds and the screenplay (openspec/specs/api/stories).

Positions inside a group (draft and kind, outside the trash) stay 0…N−1; a document leaving the trash goes to
the end of its group. Changes of a document carry the revision they were based on. This module also holds the
draft record and its guards, which every write goes through.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, case, delete, func, insert, select, update

from core import snapshots
from core.errors import Conflict, Invalid, Locked, NotFound
from core.fields import KINDS_WITH_ROLE, SCRIPT_NAME, merge_fields, validate_fields
from core.tables import ROLES, documents, drafts, projects

# Kinds the author adds in the navigator; the screenplay comes with the draft.
CREATABLE_KINDS = ("character", "location", "world")
_KIND_ORDER = case({"script": 0, "character": 1, "location": 2, "world": 3}, value=documents.c.kind)


@dataclass(frozen=True)
class Draft:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    locked: bool
    forked_from_id: uuid.UUID | None
    forked_from_name: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


def draft_of(row: Any) -> Draft:
    return Draft(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        locked=row.locked,
        forked_from_id=row.forked_from_id,
        forked_from_name=row.forked_from_name,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def draft_row(connection: Connection, draft_id: uuid.UUID, for_update: bool = False) -> Draft:
    query = select(drafts).where(drafts.c.id == draft_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Драфта {draft_id} нет.")
    return draft_of(row)


def touch_draft(connection: Connection, draft_id: uuid.UUID) -> None:
    connection.execute(update(drafts).where(drafts.c.id == draft_id).values(updated_at=func.now()))


@dataclass(frozen=True)
class Document:
    id: uuid.UUID
    project_id: uuid.UUID
    draft_id: uuid.UUID
    kind: str
    name: str
    role: str | None
    summary: str
    position: int
    revision: int
    fields: dict[str, Any]
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


def _document(row: Any) -> Document:
    return Document(
        id=row.id,
        project_id=row.project_id,
        draft_id=row.draft_id,
        kind=row.kind,
        name=row.name,
        role=row.role,
        summary=row.summary,
        position=row.position,
        revision=row.revision,
        fields=row.fields,
        updated_by=row.updated_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def document_row(connection: Connection, document_id: uuid.UUID, for_update: bool = False) -> Document:
    query = select(documents).where(documents.c.id == document_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Документа {document_id} нет.")
    return _document(row)


def project_of_document(connection: Connection, document_id: uuid.UUID) -> uuid.UUID:
    return document_row(connection, document_id).project_id


def ensure_project_open(connection: Connection, project_id: uuid.UUID) -> None:
    deleted_at = connection.execute(select(projects.c.deleted_at).where(projects.c.id == project_id)).one_or_none()
    if deleted_at is None:
        raise NotFound(f"Истории {project_id} нет.")
    if deleted_at[0] is not None:
        raise Conflict("История в корзине: сначала восстановите её.")


def ensure_draft_open(connection: Connection, draft: Draft) -> None:
    """Neither the draft nor its story is in the trash."""
    ensure_project_open(connection, draft.project_id)
    if draft.deleted_at is not None:
        raise Conflict("Драфт в корзине: сначала восстановите его.")


def ensure_writable(connection: Connection, draft: Draft) -> None:
    """The contents of the draft may change: it is open and not locked."""
    ensure_draft_open(connection, draft)
    if draft.locked:
        raise Locked("Правка драфта запрещена: сначала разрешите её.")


def ensure_open(connection: Connection, document: Document) -> None:
    """The document can change: neither it nor its draft and story are in the trash, the draft is not locked."""
    ensure_writable(connection, draft_row(connection, document.draft_id))
    if document.deleted_at is not None:
        raise Conflict("Документ в корзине: сначала восстановите его.")


def next_position(connection: Connection, draft_id: uuid.UUID, kind: str) -> int:
    return connection.execute(
        select(func.count()).where(
            documents.c.draft_id == draft_id, documents.c.kind == kind, documents.c.deleted_at.is_(None)
        )
    ).scalar_one()


def _compact(connection: Connection, draft_id: uuid.UUID, kind: str, order: list[uuid.UUID] | None = None) -> None:
    """Renumber the group 0…N−1, in `order` when given, else by the current position."""
    if order is None:
        order = list(
            connection.execute(
                select(documents.c.id)
                .where(documents.c.draft_id == draft_id, documents.c.kind == kind, documents.c.deleted_at.is_(None))
                .order_by(documents.c.position, documents.c.created_at)
            ).scalars()
        )
    for position, document_id in enumerate(order):
        connection.execute(update(documents).where(documents.c.id == document_id).values(position=position))


def _name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Имя не может быть пустым.", "name")
    return value.strip()


def _role(kind: str, value: Any) -> str | None:
    if kind in KINDS_WITH_ROLE:
        if value not in ROLES:
            raise Invalid(f"Поле «role» должно быть одним из: {', '.join(ROLES)}.", "role")
        return str(value)
    if value is not None:
        raise Invalid("Поля «role» нет у документа этого вида.", "role")
    return None


def _summary(value: Any) -> str:
    if not isinstance(value, str):
        raise Invalid("Поле «summary» должно быть строкой.", "summary")
    return value


def list_documents(connection: Connection, draft_id: uuid.UUID) -> list[Document]:
    rows = connection.execute(
        select(documents)
        .where(documents.c.draft_id == draft_id)
        .order_by(_KIND_ORDER, documents.c.deleted_at.is_not(None), documents.c.position, documents.c.created_at)
    ).all()
    return [_document(row) for row in rows]


def create_documents(
    connection: Connection, draft_id: uuid.UUID, items: list[Any], user_id: uuid.UUID
) -> list[Document]:
    """Create characters, locations and worlds at the end of their groups: all of them or none."""
    draft = draft_row(connection, draft_id)
    ensure_writable(connection, draft)
    if not items:
        raise Invalid("Передайте хотя бы один документ.")
    prepared = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise Invalid(f"Документ {index + 1} должен быть объектом.")
        unknown = set(item) - {"kind", "name", "role", "summary", "fields"}
        if unknown:
            name = sorted(unknown)[0]
            raise Invalid(f"Поле «{name}» нельзя задать при создании.", name)
        kind = item.get("kind")
        if kind not in CREATABLE_KINDS:
            raise Invalid(f"Поле «kind» должно быть одним из: {', '.join(CREATABLE_KINDS)}.", "kind")
        prepared.append(
            {
                "kind": kind,
                "name": _name(item.get("name")),
                "role": _role(kind, item.get("role")),
                "summary": _summary(item.get("summary", "")),
                "fields": validate_fields(kind, item.get("fields", {})),
            }
        )
    created = []
    for values in prepared:
        position = next_position(connection, draft_id, values["kind"])
        row = connection.execute(
            insert(documents)
            .values(project_id=draft.project_id, draft_id=draft_id, position=position, updated_by=user_id, **values)
            .returning(documents)
        ).one()
        created.append(_document(row))
    touch_draft(connection, draft_id)
    return created


def fields_state(document: Any) -> dict[str, Any]:
    """The part `fields` of a document, as a snapshot keeps it."""
    return {"name": document.name, "role": document.role, "summary": document.summary, "fields": document.fields}


def update_document(
    connection: Connection,
    document_id: uuid.UUID,
    expected_revision: int,
    changes: dict[str, Any],
    user_id: uuid.UUID,
    snapshot_reason: str | None = None,
) -> Document:
    """Change name, role, summary, fields or position if the revision is still `expected_revision`.

    Without `snapshot_reason` the state before the change is kept only when the last snapshot is old enough;
    with it, always.
    """
    document = document_row(connection, document_id, for_update=True)
    ensure_open(connection, document)
    if document.revision != expected_revision:
        raise Conflict(f"Документ изменился: ревизия {document.revision}, а не {expected_revision}.")
    unknown = set(changes) - {"name", "role", "summary", "fields", "position"}
    if unknown:
        name = sorted(unknown)[0]
        raise Invalid(f"Поле «{name}» нельзя менять здесь.", name)
    if not changes:
        raise Invalid("Передайте хотя бы одно поле.")
    values: dict[str, Any] = {}
    if "name" in changes:
        if document.kind == "script":
            raise Invalid(f"Сценарий всегда называется «{SCRIPT_NAME}».", "name")
        values["name"] = _name(changes["name"])
    if "role" in changes:
        values["role"] = _role(document.kind, changes["role"])
    if "summary" in changes:
        values["summary"] = _summary(changes["summary"])
    if "fields" in changes:
        values["fields"] = merge_fields(document.kind, document.fields, changes["fields"])
    if "position" in changes:
        position = changes["position"]
        group = [
            other
            for other in connection.execute(
                select(documents.c.id)
                .where(
                    documents.c.draft_id == document.draft_id,
                    documents.c.kind == document.kind,
                    documents.c.deleted_at.is_(None),
                )
                .order_by(documents.c.position, documents.c.created_at)
            ).scalars()
            if other != document_id
        ]
        if not isinstance(position, int) or isinstance(position, bool) or not 0 <= position <= len(group):
            raise Invalid(f"Поле «position» должно быть целым от 0 до {len(group)}.", "position")
        group.insert(position, document_id)
        _compact(connection, document.draft_id, document.kind, group)
    if values:
        snapshots.keep(
            connection,
            document_id,
            "fields",
            fields_state(document),
            document.updated_by,
            document.updated_at,
            snapshot_reason,
        )
    row = connection.execute(
        update(documents)
        .where(documents.c.id == document_id)
        .values(**values, revision=documents.c.revision + 1, updated_by=user_id, updated_at=func.now())
        .returning(documents)
    ).one()
    touch_draft(connection, document.draft_id)
    return _document(row)


def update_document_by_coauthor(
    connection: Connection, document_id: uuid.UUID, changes: dict[str, Any], user_id: uuid.UUID
) -> Document:
    """A change of the co-author: on the current revision, never the position, always after a snapshot `coauthor`."""
    if "position" in changes:
        raise Invalid("Порядок документов меняет только автор.", "position")
    document = document_row(connection, document_id, for_update=True)
    return update_document(connection, document_id, document.revision, changes, user_id, "coauthor")


def restore_fields(
    connection: Connection, document_id: uuid.UUID, expected_revision: int, state: dict[str, Any], user_id: uuid.UUID
) -> Document:
    """Return the part `fields` to a snapshot; the state it replaces becomes a snapshot itself."""
    document = document_row(connection, document_id, for_update=True)
    ensure_open(connection, document)
    if document.revision != expected_revision:
        raise Conflict(f"Документ изменился: ревизия {document.revision}, а не {expected_revision}.")
    snapshots.keep(
        connection, document_id, "fields", fields_state(document), document.updated_by, document.updated_at, "restore"
    )
    row = connection.execute(
        update(documents)
        .where(documents.c.id == document_id)
        .values(**state, revision=documents.c.revision + 1, updated_by=user_id, updated_at=func.now())
        .returning(documents)
    ).one()
    touch_draft(connection, document.draft_id)
    return _document(row)


def trash_document(connection: Connection, document_id: uuid.UUID) -> Document:
    document = document_row(connection, document_id, for_update=True)
    if document.kind == "script":
        raise Conflict("Сценарий истории не удаляется.")
    ensure_open(connection, document)
    row = connection.execute(
        update(documents).where(documents.c.id == document_id).values(deleted_at=func.now()).returning(documents)
    ).one()
    _compact(connection, document.draft_id, document.kind)
    return _document(row)


def restore_document(connection: Connection, document_id: uuid.UUID) -> Document:
    document = document_row(connection, document_id, for_update=True)
    ensure_writable(connection, draft_row(connection, document.draft_id))
    if document.deleted_at is None:
        raise Conflict("Документ не в корзине.")
    row = connection.execute(
        update(documents)
        .where(documents.c.id == document_id)
        .values(deleted_at=None, position=next_position(connection, document.draft_id, document.kind))
        .returning(documents)
    ).one()
    return _document(row)


def delete_document(connection: Connection, document_id: uuid.UUID) -> None:
    """Delete for good a document from the story trash, with its text, comments and suggestions."""
    document = document_row(connection, document_id, for_update=True)
    if document.deleted_at is None:
        raise Conflict("Удалить навсегда можно только документ из корзины.")
    ensure_writable(connection, draft_row(connection, document.draft_id))
    connection.execute(delete(documents).where(documents.c.id == document_id))

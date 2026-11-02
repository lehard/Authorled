"""Documents of a story: characters, locations, worlds, the screenplay and drafts (openspec/specs/api/stories).

Positions inside a group (story and kind, outside the trash) stay 0…N−1; a document leaving the trash goes to
the end of its group. Changes of a document carry the revision they were based on.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, case, delete, func, insert, select, update

from core.errors import Conflict, Invalid, NotFound
from core.fields import KINDS_WITH_ROLE, merge_fields, validate_fields
from core.tables import ROLES, documents, projects

# Kinds the author adds in the navigator; the screenplay comes with the story, drafts have their own route.
CREATABLE_KINDS = ("character", "location", "world")
_KIND_ORDER = case({"script": 0, "character": 1, "location": 2, "world": 3, "draft": 4}, value=documents.c.kind)


@dataclass(frozen=True)
class Document:
    id: uuid.UUID
    project_id: uuid.UUID
    kind: str
    name: str
    role: str | None
    summary: str
    position: int
    revision: int
    fields: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


def _document(row: Any) -> Document:
    return Document(
        id=row.id,
        project_id=row.project_id,
        kind=row.kind,
        name=row.name,
        role=row.role,
        summary=row.summary,
        position=row.position,
        revision=row.revision,
        fields=row.fields,
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


def ensure_open(connection: Connection, document: Document) -> None:
    """Neither the document nor its story is in the trash."""
    ensure_project_open(connection, document.project_id)
    if document.deleted_at is not None:
        raise Conflict("Документ в корзине: сначала восстановите его.")


def next_position(connection: Connection, project_id: uuid.UUID, kind: str) -> int:
    return connection.execute(
        select(func.count()).where(
            documents.c.project_id == project_id, documents.c.kind == kind, documents.c.deleted_at.is_(None)
        )
    ).scalar_one()


def _compact(connection: Connection, project_id: uuid.UUID, kind: str, order: list[uuid.UUID] | None = None) -> None:
    """Renumber the group 0…N−1, in `order` when given, else by the current position."""
    if order is None:
        order = list(
            connection.execute(
                select(documents.c.id)
                .where(documents.c.project_id == project_id, documents.c.kind == kind, documents.c.deleted_at.is_(None))
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


def list_documents(connection: Connection, project_id: uuid.UUID) -> list[Document]:
    rows = connection.execute(
        select(documents)
        .where(documents.c.project_id == project_id)
        .order_by(_KIND_ORDER, documents.c.deleted_at.is_not(None), documents.c.position, documents.c.created_at)
    ).all()
    return [_document(row) for row in rows]


def create_documents(connection: Connection, project_id: uuid.UUID, items: list[Any]) -> list[Document]:
    """Create characters, locations and worlds at the end of their groups: all of them or none."""
    ensure_project_open(connection, project_id)
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
        position = next_position(connection, project_id, values["kind"])
        row = connection.execute(
            insert(documents).values(project_id=project_id, position=position, **values).returning(documents)
        ).one()
        created.append(_document(row))
    return created


def update_document(
    connection: Connection, document_id: uuid.UUID, expected_revision: int, changes: dict[str, Any]
) -> Document:
    """Change name, role, summary, fields or position if the revision is still `expected_revision`."""
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
                    documents.c.project_id == document.project_id,
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
        _compact(connection, document.project_id, document.kind, group)
    row = connection.execute(
        update(documents)
        .where(documents.c.id == document_id)
        .values(**values, revision=documents.c.revision + 1, updated_at=func.now())
        .returning(documents)
    ).one()
    return _document(row)


def trash_document(connection: Connection, document_id: uuid.UUID) -> Document:
    document = document_row(connection, document_id, for_update=True)
    if document.kind == "script":
        raise Conflict("Сценарий истории не удаляется.")
    ensure_open(connection, document)
    row = connection.execute(
        update(documents).where(documents.c.id == document_id).values(deleted_at=func.now()).returning(documents)
    ).one()
    _compact(connection, document.project_id, document.kind)
    return _document(row)


def restore_document(connection: Connection, document_id: uuid.UUID) -> Document:
    document = document_row(connection, document_id, for_update=True)
    ensure_project_open(connection, document.project_id)
    if document.deleted_at is None:
        raise Conflict("Документ не в корзине.")
    row = connection.execute(
        update(documents)
        .where(documents.c.id == document_id)
        .values(deleted_at=None, position=next_position(connection, document.project_id, document.kind))
        .returning(documents)
    ).one()
    return _document(row)


def delete_document(connection: Connection, document_id: uuid.UUID) -> None:
    """Delete for good a document from the story trash, with its text, comments and suggestions."""
    document = document_row(connection, document_id, for_update=True)
    if document.deleted_at is None:
        raise Conflict("Удалить навсегда можно только документ из корзины.")
    connection.execute(delete(documents).where(documents.c.id == document_id))


def empty_trash(connection: Connection, project_id: uuid.UUID) -> int:
    ensure_project_open(connection, project_id)
    result = connection.execute(
        delete(documents).where(documents.c.project_id == project_id, documents.c.deleted_at.is_not(None))
    )
    return result.rowcount

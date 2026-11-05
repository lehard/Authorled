"""Stories of the authors and who may open them (openspec/specs/api/stories).

MVP: a story has one owner, the user who created it; nobody else sees it. The trash keeps a story until its
author deletes it for good; there is no expiry.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from sqlalchemy import Connection, delete, func, insert, select, update

from core import drafts
from core.engine import get_engine
from core.errors import Conflict, Invalid, NotFound
from core.tables import documents, projects, users
from core.texts import add_text, new_screenplay
from core.users import AccountDeleted, AccountNotFound


@dataclass(frozen=True)
class Project:
    id: uuid.UUID
    title: str
    description: str
    format: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


@dataclass(frozen=True)
class ListedProject(Project):
    """A story on the shelf of its owner."""

    drafts_count: int
    open_draft_id: uuid.UUID


def _project(row: Any) -> Project:
    return Project(row.id, row.title, row.description, row.format, row.created_at, row.updated_at, row.deleted_at)


def user_id_of(connection: Connection, subject: str) -> uuid.UUID:
    """The product user of a token subject; GET /api/v1/me creates it."""
    row = connection.execute(
        select(users.c.id, users.c.deleted_at).where(users.c.auth_subject == subject)
    ).one_or_none()
    if row is None:
        raise AccountNotFound(f"No account for subject {subject!r}")
    if row.deleted_at is not None:
        raise AccountDeleted(f"Account {row.id} is deleted")
    return row.id


def owns_project(connection: Connection, subject: str, project_id: uuid.UUID) -> bool:
    return (
        connection.execute(
            select(projects.c.id)
            .join(users, users.c.id == projects.c.owner_id)
            .where(projects.c.id == project_id, users.c.auth_subject == subject, users.c.deleted_at.is_(None))
        ).one_or_none()
        is not None
    )


class _Caller(Protocol):
    @property
    def user_id(self) -> str: ...


class ProjectAccess:
    """Source of project access for the auth module (can_access_project): only the owner, the trash included."""

    def can_access(self, principal: _Caller, project_id: str) -> bool:
        try:
            project_uuid = uuid.UUID(project_id)
        except ValueError:
            return False
        with get_engine().connect() as connection:
            return owns_project(connection, principal.user_id, project_uuid)


def _title(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Название не может быть пустым.", "title")
    return value.strip()


def _description(value: Any) -> str:
    if not isinstance(value, str):
        raise Invalid("Поле «description» должно быть строкой.", "description")
    return value


def project_row(connection: Connection, project_id: uuid.UUID, for_update: bool = False) -> Project:
    query = select(projects).where(projects.c.id == project_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Истории {project_id} нет.")
    return _project(row)


def list_projects(connection: Connection, owner_id: uuid.UUID, trash: bool) -> list[ListedProject]:
    deleted = projects.c.deleted_at.is_not(None) if trash else projects.c.deleted_at.is_(None)
    rows = connection.execute(
        select(projects).where(projects.c.owner_id == owner_id, deleted).order_by(projects.c.updated_at.desc())
    ).all()
    return [
        ListedProject(
            row.id,
            row.title,
            row.description,
            row.format,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            drafts.count_drafts(connection, row.id),
            drafts.open_draft_id(connection, owner_id, row.id),
        )
        for row in rows
    ]


def create_project(
    connection: Connection, owner_id: uuid.UUID, title: Any, description: Any = "", text: dict[str, Any] | None = None
) -> tuple[Project, uuid.UUID, uuid.UUID]:
    """A new feature film with «Драфт 1» and its screenplay; the text is one empty scene heading unless given.

    Returns the story, the draft and the screenplay.
    """
    row = connection.execute(
        insert(projects)
        .values(owner_id=owner_id, title=_title(title), description=_description(description), format="feature")
        .returning(projects)
    ).one()
    draft_id = drafts.add_first_draft(connection, row.id)
    script_id = connection.execute(
        insert(documents)
        .values(
            project_id=row.id,
            draft_id=draft_id,
            kind="script",
            name=row.title,
            position=0,
            fields={},
            updated_by=owner_id,
        )
        .returning(documents.c.id)
    ).scalar_one()
    add_text(connection, script_id, text if text is not None else new_screenplay(), owner_id)
    return _project(row), draft_id, script_id


def update_project(connection: Connection, project_id: uuid.UUID, changes: dict[str, Any]) -> Project:
    project = project_row(connection, project_id, for_update=True)
    if project.deleted_at is not None:
        raise Conflict("История в корзине: сначала восстановите её.")
    unknown = set(changes) - {"title", "description"}
    if unknown:
        name = sorted(unknown)[0]
        raise Invalid(f"Поле «{name}» нельзя менять здесь.", name)
    if not changes:
        raise Invalid("Передайте title или description.")
    values: dict[str, Any] = {}
    if "title" in changes:
        values["title"] = _title(changes["title"])
    if "description" in changes:
        values["description"] = _description(changes["description"])
    row = connection.execute(
        update(projects).where(projects.c.id == project_id).values(**values, updated_at=func.now()).returning(projects)
    ).one()
    return _project(row)


def trash_project(connection: Connection, project_id: uuid.UUID) -> Project:
    project = project_row(connection, project_id, for_update=True)
    if project.deleted_at is not None:
        raise Conflict("История уже в корзине.")
    row = connection.execute(
        update(projects).where(projects.c.id == project_id).values(deleted_at=func.now()).returning(projects)
    ).one()
    return _project(row)


def restore_project(connection: Connection, project_id: uuid.UUID) -> Project:
    project = project_row(connection, project_id, for_update=True)
    if project.deleted_at is None:
        raise Conflict("История не в корзине.")
    row = connection.execute(
        update(projects).where(projects.c.id == project_id).values(deleted_at=None).returning(projects)
    ).one()
    return _project(row)


def delete_project(connection: Connection, project_id: uuid.UUID) -> None:
    """Delete for good a story from the trash; the database removes everything in it (cascades)."""
    project = project_row(connection, project_id, for_update=True)
    if project.deleted_at is None:
        raise Conflict("Удалить навсегда можно только историю из корзины.")
    connection.execute(delete(projects).where(projects.c.id == project_id))

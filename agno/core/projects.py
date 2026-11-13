"""Stories of the authors and who may open them (openspec/specs/api/stories).

A story has one owner, the user who created it, and may have participants with roles (core/members.py,
openspec/specs/api/story-sharing). The trash keeps a story until its owner deletes it for good; there is no expiry.
"""

import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Protocol

from sqlalchemy import Connection, delete, func, insert, select, update

from core import drafts, members
from core.engine import get_engine
from core.errors import Conflict, Invalid, NotFound
from core.fields import SCRIPT_NAME
from core.tables import COVER_COLORS, documents, project_members, projects, users
from core.texts import add_text, new_screenplay
from core.users import AccountDeleted, AccountNotFound
from core.writing import GOAL_RULE, is_goal


@dataclass(frozen=True)
class Project:
    id: uuid.UUID
    title: str
    description: str
    format: str
    # The goal of the story in words and its deadline (openspec/specs/api/writing); the deadline needs a goal.
    word_goal: int | None
    goal_deadline: date | None
    cover_color: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


@dataclass(frozen=True)
class ListedProject(Project):
    """A story on the shelf of the caller: their own or one they take part in."""

    drafts_count: int
    open_draft_id: uuid.UUID
    role: members.Role
    owner_name: str


def _project(row: Any) -> Project:
    return Project(
        row.id,
        row.title,
        row.description,
        row.format,
        row.word_goal,
        row.goal_deadline,
        row.cover_color,
        row.created_at,
        row.updated_at,
        row.deleted_at,
    )


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


class _Caller(Protocol):
    @property
    def user_id(self) -> str: ...


class ProjectAccess:
    """Source of project access for the auth module (can_access_project): any role in the story.

    What each role may do the routes check with `members.role_of_subject`; a story in the trash is its owner's only.
    """

    def can_access(self, principal: _Caller, project_id: str) -> bool:
        try:
            project_uuid = uuid.UUID(project_id)
        except ValueError:
            return False
        with get_engine().connect() as connection:
            return members.role_of_subject(connection, principal.user_id, project_uuid) is not None


def _title(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Название не может быть пустым.", "title")
    return value.strip()


def _description(value: Any) -> str:
    if not isinstance(value, str):
        raise Invalid("Поле «description» должно быть строкой.", "description")
    return value


def _word_goal(value: Any) -> int | None:
    if not is_goal(value):
        raise Invalid(f"Поле «word_goal» должно быть {GOAL_RULE}.", "word_goal")
    goal: int | None = value
    return goal


def _goal_deadline(value: Any) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise Invalid("Поле «goal_deadline» должно быть датой ГГГГ-ММ-ДД или null.", "goal_deadline")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise Invalid(f"Поле «goal_deadline»: такой даты нет ({value}).", "goal_deadline") from error


def _cover_color(value: Any) -> str:
    if value not in COVER_COLORS:
        raise Invalid(f"Поле «cover_color» должно быть одним из: {', '.join(COVER_COLORS)}.", "cover_color")
    return str(value)


def next_cover_color(connection: Connection, owner_id: uuid.UUID) -> str:
    """The colour after that of the author's last created story, the trash included; blue for the first one."""
    last = connection.execute(
        select(projects.c.cover_color)
        .where(projects.c.owner_id == owner_id)
        .order_by(projects.c.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if last is None:
        return COVER_COLORS[0]
    return COVER_COLORS[(COVER_COLORS.index(last) + 1) % len(COVER_COLORS)]


def project_row(connection: Connection, project_id: uuid.UUID, for_update: bool = False) -> Project:
    query = select(projects).where(projects.c.id == project_id)
    if for_update:
        query = query.with_for_update()
    row = connection.execute(query).one_or_none()
    if row is None:
        raise NotFound(f"Истории {project_id} нет.")
    return _project(row)


def list_projects(connection: Connection, user_id: uuid.UUID, trash: bool) -> list[ListedProject]:
    """The caller's stories and, outside the trash, the stories they take part in, newest change first."""
    role = (
        select(project_members.c.role)
        .where(project_members.c.project_id == projects.c.id, project_members.c.user_id == user_id)
        .scalar_subquery()
    )
    if trash:
        visible = (projects.c.owner_id == user_id) & projects.c.deleted_at.is_not(None)
    else:
        visible = projects.c.deleted_at.is_(None) & ((projects.c.owner_id == user_id) | role.is_not(None))
    rows = connection.execute(
        select(projects, role.label("member_role"), users.c.display_name.label("owner_name"))
        .join(users, users.c.id == projects.c.owner_id)
        .where(visible)
        .order_by(projects.c.updated_at.desc())
    ).all()
    return [
        ListedProject(
            row.id,
            row.title,
            row.description,
            row.format,
            row.word_goal,
            row.goal_deadline,
            row.cover_color,
            row.created_at,
            row.updated_at,
            row.deleted_at,
            drafts.count_drafts(connection, row.id),
            drafts.open_draft_id(connection, user_id, row.id),
            "owner" if row.owner_id == user_id else row.member_role,
            row.owner_name,
        )
        for row in rows
    ]


# A story created without a colour takes the next one of the palette (`next_cover_color`); null is not a colour.
NEXT_COLOR: Any = object()


def create_project(
    connection: Connection,
    owner_id: uuid.UUID,
    title: Any,
    description: Any = "",
    text: dict[str, Any] | None = None,
    cover_color: Any = NEXT_COLOR,
) -> tuple[Project, uuid.UUID, uuid.UUID]:
    """A new feature film with «Драфт 1» and its screenplay; the text is one empty scene heading unless given.

    The cover takes the colour the author chose, or without one the next colour of the palette. The time of
    creation is that of the insert, not of the transaction, so stories created in one transaction keep their
    order. Returns the story, the draft and the screenplay.
    """
    row = connection.execute(
        insert(projects)
        .values(
            owner_id=owner_id,
            title=_title(title),
            description=_description(description),
            format="feature",
            cover_color=next_cover_color(connection, owner_id)
            if cover_color is NEXT_COLOR
            else _cover_color(cover_color),
            created_at=func.clock_timestamp(),
        )
        .returning(projects)
    ).one()
    draft_id = drafts.add_first_draft(connection, row.id)
    script_id = connection.execute(
        insert(documents)
        .values(
            project_id=row.id,
            draft_id=draft_id,
            kind="script",
            name=SCRIPT_NAME,
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
    unknown = set(changes) - {"title", "description", "word_goal", "goal_deadline", "cover_color"}
    if unknown:
        name = sorted(unknown)[0]
        raise Invalid(f"Поле «{name}» нельзя менять здесь.", name)
    if not changes:
        raise Invalid("Передайте title, description, word_goal, goal_deadline или cover_color.")
    values: dict[str, Any] = {}
    if "title" in changes:
        values["title"] = _title(changes["title"])
    if "description" in changes:
        values["description"] = _description(changes["description"])
    if "word_goal" in changes:
        values["word_goal"] = _word_goal(changes["word_goal"])
    if "goal_deadline" in changes:
        values["goal_deadline"] = _goal_deadline(changes["goal_deadline"])
    if "cover_color" in changes:
        values["cover_color"] = _cover_color(changes["cover_color"])
    # The deadline goes only with a goal, judged by the story as it will be after the change.
    goal = values.get("word_goal", project.word_goal)
    if values.get("goal_deadline", project.goal_deadline) is not None and goal is None:
        raise Invalid("Поле «goal_deadline»: срок задаётся только вместе с целью word_goal.", "goal_deadline")
    # The colour is how the story looks, not a change of it: the shelf keeps its place.
    if set(values) != {"cover_color"}:
        values["updated_at"] = func.now()
    row = connection.execute(
        update(projects).where(projects.c.id == project_id).values(**values).returning(projects)
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

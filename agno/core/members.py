"""Participants of a story and their roles, invitations by e-mail (openspec/specs/api/story-sharing).

The owner of a story is `projects.owner_id`; other participants are rows of `project_members`. A role covers the
whole story. A story in the trash belongs to its owner only. Invitations send no letter: the one who signs in with
the invited e-mail becomes a participant (`accept_invitations`, called by GET /api/v1/me).
"""

import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import Connection, delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.errors import Conflict, Forbidden, Invalid, NotFound
from core.tables import MEMBER_ROLES, project_invitations, project_members, projects, users

Role = Literal["owner", "coauthor", "reviewer", "reader"]
# What a route or tool needs; roles are nested (openspec/specs/api/story-sharing, «Права ролей»).
Need = Literal["read", "review", "edit", "owner"]

_RANK: dict[str, int] = {"reader": 0, "reviewer": 1, "coauthor": 2, "owner": 3}
_NEED_RANK: dict[str, int] = {"read": 0, "review": 1, "edit": 2, "owner": 3}
ROLE_NAMES: dict[str, str] = {"owner": "владелец", "coauthor": "соавтор", "reviewer": "рецензент", "reader": "читатель"}
_ACTIONS: dict[str, str] = {
    "read": "читать историю",
    "review": "комментировать и предлагать правки",
    "edit": "менять историю",
    "owner": "это действие владельца истории",
}
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def role_of(connection: Connection, user_id: uuid.UUID, project_id: uuid.UUID) -> Role | None:
    """The role of the user in the story; none outside it. A story in the trash: its owner only."""
    story = connection.execute(
        select(projects.c.owner_id, projects.c.deleted_at).where(projects.c.id == project_id)
    ).one_or_none()
    if story is None:
        return None
    if story.owner_id == user_id:
        return "owner"
    if story.deleted_at is not None:
        return None
    role = connection.execute(
        select(project_members.c.role).where(
            project_members.c.project_id == project_id, project_members.c.user_id == user_id
        )
    ).scalar_one_or_none()
    return role  # type: ignore[no-any-return]


def role_of_subject(connection: Connection, subject: str, project_id: uuid.UUID) -> Role | None:
    """The role of the active user of a token subject; none without an account."""
    user_id = connection.execute(
        select(users.c.id).where(users.c.auth_subject == subject, users.c.deleted_at.is_(None))
    ).scalar_one_or_none()
    if user_id is None:
        return None
    return role_of(connection, user_id, project_id)


def allows(role: Role, need: Need) -> bool:
    return _RANK[role] >= _NEED_RANK[need]


def refusal(role: Role, need: Need) -> str:
    """Why the role may not do what needs `need`, in Russian, naming the role."""
    return f"У роли «{ROLE_NAMES[role]}» нет права: {_ACTIONS[need]}."


def require(role: Role, need: Need) -> None:
    if not allows(role, need):
        raise Forbidden(refusal(role, need))


# --- participants


@dataclass(frozen=True)
class Member:
    user_id: uuid.UUID
    name: str
    email: str
    role: Role
    added_at: datetime


@dataclass(frozen=True)
class Invitation:
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime


def _member_role(value: Any) -> str:
    if value not in MEMBER_ROLES:
        raise Invalid(f"Поле «role» должно быть одним из: {', '.join(MEMBER_ROLES)}.", "role")
    return str(value)


def _email(value: Any) -> str:
    if not isinstance(value, str) or not _EMAIL.fullmatch(value.strip()):
        raise Invalid("Поле «email»: нужна почта вида name@example.ru.", "email")
    return value.strip().lower()


def members(connection: Connection, project_id: uuid.UUID) -> list[Member]:
    """The owner first, then the participants by the time they were added."""
    owner = connection.execute(
        select(users.c.id, users.c.display_name, users.c.email, projects.c.created_at)
        .join(projects, projects.c.owner_id == users.c.id)
        .where(projects.c.id == project_id)
    ).one_or_none()
    if owner is None:
        raise NotFound(f"Истории {project_id} нет.")
    rows = connection.execute(
        select(users.c.id, users.c.display_name, users.c.email, project_members.c.role, project_members.c.added_at)
        .join(project_members, project_members.c.user_id == users.c.id)
        .where(project_members.c.project_id == project_id)
        .order_by(project_members.c.added_at, users.c.email)
    ).all()
    return [Member(owner.id, owner.display_name, owner.email, "owner", owner.created_at)] + [
        Member(row.id, row.display_name, row.email, row.role, row.added_at) for row in rows
    ]


def invitations(connection: Connection, project_id: uuid.UUID) -> list[Invitation]:
    rows = connection.execute(
        select(project_invitations)
        .where(project_invitations.c.project_id == project_id)
        .order_by(project_invitations.c.created_at)
    ).all()
    return [Invitation(row.id, row.email, row.role, row.created_at) for row in rows]


def invite(connection: Connection, project_id: uuid.UUID, invited_by: uuid.UUID, email: Any, role: Any) -> Invitation:
    """An invitation of an e-mail with a role; the owner's own e-mail, a participant's or a repeat are refused."""
    address = _email(email)
    member_role = _member_role(role)
    story = connection.execute(
        select(projects.c.deleted_at, users.c.email)
        .join(users, users.c.id == projects.c.owner_id)
        .where(projects.c.id == project_id)
        .with_for_update(of=projects)
    ).one_or_none()
    if story is None:
        raise NotFound(f"Истории {project_id} нет.")
    if story.deleted_at is not None:
        raise Conflict("История в корзине: сначала восстановите её.")
    if story.email.lower() == address:
        raise Invalid("Это почта владельца истории.", "email")
    participant = connection.execute(
        select(project_members.c.user_id)
        .join(users, users.c.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id, func.lower(users.c.email) == address)
    ).first()
    if participant is not None:
        raise Conflict(f"{address} уже участник истории.")
    row = connection.execute(
        pg_insert(project_invitations)
        .values(project_id=project_id, email=address, role=member_role, invited_by=invited_by)
        .on_conflict_do_nothing(index_elements=["project_id", "email"])
        .returning(project_invitations)
    ).one_or_none()
    if row is None:
        raise Conflict(f"{address} уже приглашена в историю.")
    return Invitation(row.id, row.email, row.role, row.created_at)


def project_of_invitation(connection: Connection, invitation_id: uuid.UUID) -> uuid.UUID:
    project_id = connection.execute(
        select(project_invitations.c.project_id).where(project_invitations.c.id == invitation_id)
    ).scalar_one_or_none()
    if project_id is None:
        raise NotFound(f"Приглашения {invitation_id} нет.")
    return project_id  # type: ignore[no-any-return]


def revoke(connection: Connection, invitation_id: uuid.UUID) -> None:
    if connection.execute(delete(project_invitations).where(project_invitations.c.id == invitation_id)).rowcount == 0:
        raise NotFound(f"Приглашения {invitation_id} нет.")


def owner_of(connection: Connection, project_id: uuid.UUID) -> uuid.UUID:
    owner = connection.execute(select(projects.c.owner_id).where(projects.c.id == project_id)).scalar_one_or_none()
    if owner is None:
        raise NotFound(f"Истории {project_id} нет.")
    return owner  # type: ignore[no-any-return]


def change_role(connection: Connection, project_id: uuid.UUID, user_id: uuid.UUID, role: Any) -> Member:
    member_role = _member_role(role)
    if owner_of(connection, project_id) == user_id:
        raise Conflict("Владельцу истории роль не меняется.")
    if (
        connection.execute(
            update(project_members)
            .where(project_members.c.project_id == project_id, project_members.c.user_id == user_id)
            .values(role=member_role)
        ).rowcount
        == 0
    ):
        raise NotFound(f"Участника {user_id} в истории нет.")
    return next(m for m in members(connection, project_id) if m.user_id == user_id)


def remove(connection: Connection, project_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Remove a participant, or let one leave; the owner stays."""
    if owner_of(connection, project_id) == user_id:
        raise Conflict("Владельца нельзя убрать из истории.")
    if (
        connection.execute(
            delete(project_members).where(
                project_members.c.project_id == project_id, project_members.c.user_id == user_id
            )
        ).rowcount
        == 0
    ):
        raise NotFound(f"Участника {user_id} в истории нет.")


def accept_invitations(connection: Connection, user_id: uuid.UUID) -> int:
    """Turn the invitations to the user's e-mail into participation; stories in the trash keep theirs waiting."""
    email = connection.execute(select(users.c.email).where(users.c.id == user_id)).scalar_one()
    rows = connection.execute(
        select(project_invitations, projects.c.owner_id)
        .join(projects, projects.c.id == project_invitations.c.project_id)
        .where(project_invitations.c.email == email.lower(), projects.c.deleted_at.is_(None))
        .with_for_update(of=project_invitations)
    ).all()
    accepted = 0
    for row in rows:
        connection.execute(delete(project_invitations).where(project_invitations.c.id == row.id))
        if row.owner_id == user_id:
            continue
        connection.execute(
            pg_insert(project_members)
            .values(project_id=row.project_id, user_id=user_id, role=row.role, added_by=row.invited_by)
            .on_conflict_do_nothing(index_elements=["project_id", "user_id"])
        )
        accepted += 1
    return accepted


def add_member(
    connection: Connection, project_id: uuid.UUID, user_id: uuid.UUID, role: Any, added_by: uuid.UUID
) -> None:
    """A participant added directly, for the demo content and tests."""
    connection.execute(
        insert(project_members).values(
            project_id=project_id, user_id=user_id, role=_member_role(role), added_by=added_by
        )
    )

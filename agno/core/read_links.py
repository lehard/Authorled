"""The link «почитать» of a draft: its key opens the screenplay of the draft without signing in
(openspec/specs/api/story-sharing, «Ссылка «почитать»», «Чтение по ссылке»).

A draft has at most one link; turning it off deletes it, so a new link gets a new key. Reading by the key gives the
titles of the story and the draft and the text without the marks of comments and suggestions — nothing else.
"""

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.errors import NotFound
from core.tables import documents, draft_read_links, drafts, projects, screenplay_texts

# Marks of the review: their threads and suggestions are the participants' business, not the reader's.
_REVIEW_MARKS = {"comment", "suggestion"}
# 24 random bytes: 192 bits, written as 32 URL-safe characters.
_KEY_BYTES = 24


@dataclass(frozen=True)
class ReadLink:
    draft_id: uuid.UUID
    key: str
    created_at: datetime


@dataclass(frozen=True)
class SharedText:
    story_title: str
    draft_name: str
    content: dict[str, Any]


def get_link(connection: Connection, draft_id: uuid.UUID) -> ReadLink:
    row = connection.execute(select(draft_read_links).where(draft_read_links.c.draft_id == draft_id)).one_or_none()
    if row is None:
        raise NotFound("У драфта нет ссылки «почитать».")
    return ReadLink(row.draft_id, row.key, row.created_at)


def ensure_link(connection: Connection, draft_id: uuid.UUID, user_id: uuid.UUID) -> ReadLink:
    """The link of the draft, created with a new key when there is none."""
    connection.execute(
        pg_insert(draft_read_links)
        .values(draft_id=draft_id, key=secrets.token_urlsafe(_KEY_BYTES), created_by=user_id)
        .on_conflict_do_nothing(index_elements=["draft_id"])
    )
    return get_link(connection, draft_id)


def remove_link(connection: Connection, draft_id: uuid.UUID) -> None:
    if connection.execute(delete(draft_read_links).where(draft_read_links.c.draft_id == draft_id)).rowcount == 0:
        raise NotFound("У драфта нет ссылки «почитать».")


def _without_review(node: Any) -> Any:
    if isinstance(node, list):
        return [_without_review(item) for item in node]
    if not isinstance(node, dict):
        return node
    copy = {key: _without_review(value) for key, value in node.items() if key != "marks"}
    if "marks" in node:
        kept = [mark for mark in node["marks"] if mark.get("type") not in _REVIEW_MARKS]
        if kept:
            copy["marks"] = kept
    return copy


def open_link(connection: Connection, key: object) -> SharedText:
    """The text of the draft of a key; an unknown key, a draft or a story in the trash are not found alike."""
    if not isinstance(key, str) or not key:
        raise NotFound("Ссылка не работает.")
    row = connection.execute(
        select(projects.c.title, drafts.c.name, screenplay_texts.c.content)
        .select_from(draft_read_links)
        .join(drafts, drafts.c.id == draft_read_links.c.draft_id)
        .join(projects, projects.c.id == drafts.c.project_id)
        .join(documents, (documents.c.draft_id == drafts.c.id) & (documents.c.kind == "script"))
        .join(screenplay_texts, screenplay_texts.c.document_id == documents.c.id)
        .where(
            draft_read_links.c.key == key,
            drafts.c.deleted_at.is_(None),
            projects.c.deleted_at.is_(None),
        )
    ).one_or_none()
    if row is None:
        raise NotFound("Ссылка не работает.")
    return SharedText(row.title, row.name, _without_review(row.content))

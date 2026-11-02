"""Review of the screenplay text: comment threads and co-author suggestions (openspec/specs/api/review).

The place of a thread or a suggestion is a mark in the text; the threads, messages and suggestions live here,
apart from the text. The co-author creates suggestions (its tool), the author decides on them.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, Row, delete, func, insert, select, update

from core.documents import Document, document_row, ensure_open
from core.errors import Conflict, Forbidden, Invalid, NotFound
from core.tables import SUGGESTION_STATUSES, comment_messages, comment_threads, suggestions, users
from core.texts import block_text, get_text, scenes


@dataclass(frozen=True)
class Message:
    id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    author_role: str
    body: str
    created_at: datetime
    edited_at: datetime | None


@dataclass(frozen=True)
class Thread:
    id: uuid.UUID
    document_id: uuid.UUID
    quote: str
    resolved_at: datetime | None
    created_at: datetime
    messages: list[Message]


@dataclass(frozen=True)
class Suggestion:
    id: uuid.UUID
    document_id: uuid.UUID
    scene_uid: str
    quote: str
    text: str
    why: str
    status: str
    session_id: str
    created_at: datetime
    decided_at: datetime | None


def _body(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Комментарий не может быть пустым.", "body")
    return value.strip()


def _screenplay(connection: Connection, document_id: uuid.UUID) -> Document:
    """The current screenplay text of a story: drafts take no review, other documents have no text."""
    document = document_row(connection, document_id)
    if document.kind == "draft":
        raise Conflict("Драфт не принимает комментарии и предложения.")
    if document.kind != "script":
        raise NotFound(f"У документа {document_id} нет текста.")
    return document


def _thread_row(connection: Connection, thread_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    row = connection.execute(
        select(comment_threads.c.id, comment_threads.c.document_id).where(comment_threads.c.id == thread_id)
    ).one_or_none()
    if row is None:
        raise NotFound(f"Ветки {thread_id} нет.")
    return row.id, row.document_id


def document_of_thread(connection: Connection, thread_id: uuid.UUID) -> uuid.UUID:
    return _thread_row(connection, thread_id)[1]


def document_of_suggestion(connection: Connection, suggestion_id: uuid.UUID) -> uuid.UUID:
    document_id = connection.execute(
        select(suggestions.c.document_id).where(suggestions.c.id == suggestion_id)
    ).scalar_one_or_none()
    if document_id is None:
        raise NotFound(f"Предложения {suggestion_id} нет.")
    return document_id


def _messages(connection: Connection, thread_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Message]]:
    rows = connection.execute(
        select(comment_messages, users.c.display_name)
        .join(users, users.c.id == comment_messages.c.author_id)
        .where(comment_messages.c.thread_id.in_(thread_ids))
        .order_by(comment_messages.c.created_at, comment_messages.c.id)
    ).all()
    found: dict[uuid.UUID, list[Message]] = {thread_id: [] for thread_id in thread_ids}
    for row in rows:
        found[row.thread_id].append(
            Message(row.id, row.author_id, row.display_name, row.author_role, row.body, row.created_at, row.edited_at)
        )
    return found


def list_threads(connection: Connection, document_id: uuid.UUID) -> list[Thread]:
    _screenplay(connection, document_id)
    rows = connection.execute(
        select(comment_threads)
        .where(comment_threads.c.document_id == document_id)
        .order_by(comment_threads.c.created_at, comment_threads.c.id)
    ).all()
    messages = _messages(connection, [row.id for row in rows])
    return [
        Thread(row.id, row.document_id, row.quote, row.resolved_at, row.created_at, messages[row.id]) for row in rows
    ]


def get_thread(connection: Connection, thread_id: uuid.UUID) -> Thread:
    _, document_id = _thread_row(connection, thread_id)
    return next(thread for thread in list_threads(connection, document_id) if thread.id == thread_id)


def create_thread(
    connection: Connection,
    document_id: uuid.UUID,
    thread_id: uuid.UUID,
    quote: object,
    body: object,
    author_id: uuid.UUID,
    author_role: str,
) -> Thread:
    """A thread on a fragment; its id is the id of the comment mark the client puts in the text."""
    ensure_open(connection, _screenplay(connection, document_id))
    if not isinstance(quote, str) or not quote:
        raise Invalid("Цитата фрагмента не может быть пустой.", "quote")
    text = _body(body)
    if connection.execute(select(comment_threads.c.id).where(comment_threads.c.id == thread_id)).one_or_none():
        raise Conflict(f"Ветка {thread_id} уже есть.")
    connection.execute(insert(comment_threads).values(id=thread_id, document_id=document_id, quote=quote))
    connection.execute(
        insert(comment_messages).values(
            created_at=func.clock_timestamp(),
            thread_id=thread_id,
            author_id=author_id,
            author_role=author_role,
            body=text,
        )
    )
    return get_thread(connection, thread_id)


def add_reply(
    connection: Connection, thread_id: uuid.UUID, body: object, author_id: uuid.UUID, author_role: str
) -> Thread:
    _, document_id = _thread_row(connection, thread_id)
    ensure_open(connection, document_row(connection, document_id))
    connection.execute(
        insert(comment_messages).values(
            created_at=func.clock_timestamp(),
            thread_id=thread_id,
            author_id=author_id,
            author_role=author_role,
            body=_body(body),
        )
    )
    return get_thread(connection, thread_id)


def _own_message(connection: Connection, thread_id: uuid.UUID, message_id: uuid.UUID, author_id: uuid.UUID) -> None:
    _, document_id = _thread_row(connection, thread_id)
    ensure_open(connection, document_row(connection, document_id))
    owner = connection.execute(
        select(comment_messages.c.author_id).where(
            comment_messages.c.id == message_id, comment_messages.c.thread_id == thread_id
        )
    ).scalar_one_or_none()
    if owner is None:
        raise NotFound(f"Сообщения {message_id} нет.")
    if owner != author_id:
        raise Forbidden("Менять и удалять можно только свои сообщения.")


def edit_message(
    connection: Connection, thread_id: uuid.UUID, message_id: uuid.UUID, body: object, author_id: uuid.UUID
) -> Thread:
    _own_message(connection, thread_id, message_id, author_id)
    connection.execute(
        update(comment_messages)
        .where(comment_messages.c.id == message_id)
        .values(body=_body(body), edited_at=func.now())
    )
    return get_thread(connection, thread_id)


def delete_message(connection: Connection, thread_id: uuid.UUID, message_id: uuid.UUID, author_id: uuid.UUID) -> bool:
    """Delete an own message; deleting the first message deletes the whole thread. True when the thread is gone."""
    _own_message(connection, thread_id, message_id, author_id)
    first = connection.execute(
        select(comment_messages.c.id)
        .where(comment_messages.c.thread_id == thread_id)
        .order_by(comment_messages.c.created_at, comment_messages.c.id)
        .limit(1)
    ).scalar_one()
    if first == message_id:
        connection.execute(delete(comment_threads).where(comment_threads.c.id == thread_id))
        return True
    connection.execute(delete(comment_messages).where(comment_messages.c.id == message_id))
    return False


def set_resolved(connection: Connection, thread_id: uuid.UUID, resolved: object, user_id: uuid.UUID) -> Thread:
    if not isinstance(resolved, bool):
        raise Invalid("Поле «resolved» должно быть true или false.", "resolved")
    _, document_id = _thread_row(connection, thread_id)
    ensure_open(connection, document_row(connection, document_id))
    values = (
        {"resolved_at": func.now(), "resolved_by": user_id} if resolved else {"resolved_at": None, "resolved_by": None}
    )
    connection.execute(update(comment_threads).where(comment_threads.c.id == thread_id).values(**values))
    return get_thread(connection, thread_id)


def _suggestion(row: Row[Any]) -> Suggestion:
    return Suggestion(**row._mapping)


def create_suggestion(
    connection: Connection,
    document_id: uuid.UUID,
    scene_uid: str,
    quote: str,
    text: str,
    why: str,
    session_id: str,
) -> Suggestion:
    """A co-author suggestion anchored by a scene and an exact quote inside one of its paragraphs.

    The saved text does not change: the browser places the suggestion mark when it gets the suggestion.
    """
    ensure_open(connection, _screenplay(connection, document_id))
    if not quote:
        raise Invalid("Цитата не может быть пустой.", "quote")
    scene = next((s for s in scenes(get_text(connection, document_id).content) if s.uid == scene_uid), None)
    if scene is None:
        raise NotFound(f"Сцены {scene_uid} нет в тексте сценария.")
    if not any(quote in block_text(block) for block in scene.blocks):
        raise Invalid(f"Цитата не найдена в сцене {scene.number}.", "quote")
    row = connection.execute(
        insert(suggestions)
        .values(
            document_id=document_id,
            scene_uid=scene_uid,
            quote=quote,
            text=text,
            why=why,
            session_id=session_id,
        )
        .returning(suggestions)
    ).one()
    return _suggestion(row)


def list_suggestions(connection: Connection, document_id: uuid.UUID, status: str | None) -> list[Suggestion]:
    _screenplay(connection, document_id)
    query = select(suggestions).where(suggestions.c.document_id == document_id)
    if status is not None:
        if status not in SUGGESTION_STATUSES:
            raise Invalid(f"Статус должен быть одним из: {', '.join(SUGGESTION_STATUSES)}.", "status")
        query = query.where(suggestions.c.status == status)
    rows = connection.execute(query.order_by(suggestions.c.created_at, suggestions.c.id)).all()
    return [_suggestion(row) for row in rows]


def decide(connection: Connection, suggestion_id: uuid.UUID, status: object) -> Suggestion:
    """The author's decision, once; the accepted text is saved by the client through the text route."""
    if status not in ("accepted", "rejected"):
        raise Invalid("Поле «status» должно быть accepted или rejected.", "status")
    current = connection.execute(
        select(suggestions.c.status).where(suggestions.c.id == suggestion_id).with_for_update()
    ).scalar_one_or_none()
    if current is None:
        raise NotFound(f"Предложения {suggestion_id} нет.")
    if current != "open":
        raise Conflict("По предложению уже есть решение.")
    row = connection.execute(
        update(suggestions)
        .where(suggestions.c.id == suggestion_id)
        .values(status=status, decided_at=func.now())
        .returning(suggestions)
    ).one()
    return _suggestion(row)

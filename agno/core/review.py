"""Review of the screenplay text of a draft: comment threads and co-author suggestions (openspec/specs/api/review).

The place of a thread or a suggestion is a mark in the text; the threads, messages and suggestions live here,
apart from the text. The co-author creates suggestions and comment threads (its tools) anchored by a scene and
a quote; the browser places their marks. A participant without the right to edit the text (a reviewer) anchors
threads and suggestions the same way. The owner or a co-author of the story decides on suggestions and resolves
threads (openspec/specs/api/story-sharing, «Права ролей»).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, Row, delete, func, insert, select, update
from sqlalchemy.orm import aliased

from core.documents import Document, document_row, ensure_open
from core.errors import Conflict, Forbidden, Invalid, NotFound
from core.tables import SUGGESTION_STATUSES, comment_messages, comment_threads, suggestions, users
from core.texts import block_text, get_text, keep_text, scenes

# The name the co-author signs its messages with; it is no user and has no display name.
COAUTHOR_NAME = "Соавтор"


@dataclass(frozen=True)
class Message:
    id: uuid.UUID
    author_kind: str
    author_id: uuid.UUID | None
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
    scene_uid: str | None
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
    # The conversation of a suggestion of the co-author; none for a participant's one.
    session_id: str | None
    created_at: datetime
    decided_at: datetime | None
    author_kind: str
    author_id: uuid.UUID | None
    author_name: str
    decided_by: uuid.UUID | None
    decided_by_name: str | None


def _body(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Invalid("Комментарий не может быть пустым.", "body")
    return value.strip()


def _screenplay(connection: Connection, document_id: uuid.UUID) -> Document:
    """The screenplay of a draft: other documents have no text."""
    document = document_row(connection, document_id)
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
        .outerjoin(users, users.c.id == comment_messages.c.author_id)
        .where(comment_messages.c.thread_id.in_(thread_ids))
        .order_by(comment_messages.c.created_at, comment_messages.c.id)
    ).all()
    found: dict[uuid.UUID, list[Message]] = {thread_id: [] for thread_id in thread_ids}
    for row in rows:
        name = COAUTHOR_NAME if row.author_kind == "coauthor" else row.display_name
        found[row.thread_id].append(
            Message(
                row.id,
                row.author_kind,
                row.author_id,
                name,
                row.author_role,
                row.body,
                row.created_at,
                row.edited_at,
            )
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
        Thread(row.id, row.document_id, row.quote, row.scene_uid, row.resolved_at, row.created_at, messages[row.id])
        for row in rows
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
    scene_uid: object = None,
) -> Thread:
    """A thread on a fragment; its id is the id of the comment mark in the text.

    Without `scene_uid` the client puts the mark in the text itself; with it the thread is anchored by the scene and
    the quote, and the screen of a participant who may edit the text places the mark, as for the co-author.
    """
    ensure_open(connection, _screenplay(connection, document_id))
    if not isinstance(quote, str) or not quote:
        raise Invalid("Цитата фрагмента не может быть пустой.", "quote")
    if scene_uid is not None:
        if not isinstance(scene_uid, str) or not scene_uid:
            raise Invalid("Поле «scene_uid»: нужен uid сцены цитаты.", "scene_uid")
        _scene_of_quote(connection, document_id, scene_uid, quote)
    text = _body(body)
    if connection.execute(select(comment_threads.c.id).where(comment_threads.c.id == thread_id)).one_or_none():
        raise Conflict(f"Ветка {thread_id} уже есть.")
    connection.execute(
        insert(comment_threads).values(id=thread_id, document_id=document_id, quote=quote, scene_uid=scene_uid)
    )
    connection.execute(
        insert(comment_messages).values(
            created_at=func.clock_timestamp(),
            thread_id=thread_id,
            author_kind="user",
            author_id=author_id,
            author_role=author_role,
            body=text,
        )
    )
    return get_thread(connection, thread_id)


def _scene_of_quote(connection: Connection, document_id: uuid.UUID, scene_uid: str, quote: str) -> None:
    """The scene is in the text of the screenplay, and the quote is inside one of its paragraphs."""
    if not quote:
        raise Invalid("Цитата не может быть пустой.", "quote")
    scene = next((s for s in scenes(get_text(connection, document_id).content) if s.uid == scene_uid), None)
    if scene is None:
        raise NotFound(f"Сцены {scene_uid} нет в тексте сценария.")
    if not any(quote in block_text(block) for block in scene.blocks):
        raise Invalid(f"Цитата не найдена в сцене {scene.number}.", "quote")


def create_coauthor_thread(
    connection: Connection, document_id: uuid.UUID, scene_uid: str, quote: str, body: object
) -> Thread:
    """A thread of the co-author anchored by a scene and an exact quote; the browser places its mark later."""
    ensure_open(connection, _screenplay(connection, document_id))
    _scene_of_quote(connection, document_id, scene_uid, quote)
    text = _body(body)
    thread_id = uuid.uuid4()
    connection.execute(
        insert(comment_threads).values(id=thread_id, document_id=document_id, quote=quote, scene_uid=scene_uid)
    )
    connection.execute(
        insert(comment_messages).values(
            created_at=func.clock_timestamp(),
            thread_id=thread_id,
            author_kind="coauthor",
            author_role="",
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
            author_kind="user",
            author_id=author_id,
            author_role=author_role,
            body=_body(body),
        )
    )
    return get_thread(connection, thread_id)


def _message_author(
    connection: Connection, thread_id: uuid.UUID, message_id: uuid.UUID
) -> tuple[str, uuid.UUID | None]:
    _, document_id = _thread_row(connection, thread_id)
    ensure_open(connection, document_row(connection, document_id))
    row = connection.execute(
        select(comment_messages.c.author_kind, comment_messages.c.author_id).where(
            comment_messages.c.id == message_id, comment_messages.c.thread_id == thread_id
        )
    ).one_or_none()
    if row is None:
        raise NotFound(f"Сообщения {message_id} нет.")
    return row.author_kind, row.author_id


def _own_message(connection: Connection, thread_id: uuid.UUID, message_id: uuid.UUID, author_id: uuid.UUID) -> None:
    kind, owner = _message_author(connection, thread_id, message_id)
    if kind == "coauthor":
        raise Forbidden("Сообщение соавтора не меняется.")
    if owner != author_id:
        raise Forbidden("Менять и удалять можно только свои сообщения.")


def _removable_message(
    connection: Connection,
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    author_id: uuid.UUID,
    may_remove_coauthor: bool,
) -> None:
    """An own message, or one of the co-author when the caller may edit the story: the co-author works for its owner
    and co-authors, who remove its thread like their own."""
    kind, owner = _message_author(connection, thread_id, message_id)
    if kind == "coauthor":
        if not may_remove_coauthor:
            raise Forbidden("Сообщение соавтора удаляют владелец и соавторы истории.")
        return
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


def delete_message(
    connection: Connection,
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    author_id: uuid.UUID,
    *,
    may_remove_coauthor: bool,
) -> bool:
    """Delete an own message or one of the co-author; deleting the first message deletes the whole thread.

    True when the thread is gone.
    """
    _removable_message(connection, thread_id, message_id, author_id, may_remove_coauthor)
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


_author = aliased(users)
_decider = aliased(users)


def _suggestions() -> Any:
    """Suggestions with the names of their author and of who decided."""
    return (
        select(
            suggestions,
            _author.c.display_name.label("author_display_name"),
            _decider.c.display_name.label("decided_by_name"),
        )
        .outerjoin(_author, _author.c.id == suggestions.c.author_id)
        .outerjoin(_decider, _decider.c.id == suggestions.c.decided_by)
    )


def _suggestion(row: Row[Any]) -> Suggestion:
    return Suggestion(
        id=row.id,
        document_id=row.document_id,
        scene_uid=row.scene_uid,
        quote=row.quote,
        text=row.text,
        why=row.why,
        status=row.status,
        session_id=row.session_id,
        created_at=row.created_at,
        decided_at=row.decided_at,
        author_kind=row.author_kind,
        author_id=row.author_id,
        author_name=COAUTHOR_NAME if row.author_kind == "coauthor" else row.author_display_name,
        decided_by=row.decided_by,
        decided_by_name=row.decided_by_name,
    )


def _suggestion_by_id(connection: Connection, suggestion_id: uuid.UUID) -> Suggestion:
    return _suggestion(connection.execute(_suggestions().where(suggestions.c.id == suggestion_id)).one())


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
    _scene_of_quote(connection, document_id, scene_uid, quote)
    suggestion_id = connection.execute(
        insert(suggestions)
        .values(
            document_id=document_id,
            scene_uid=scene_uid,
            quote=quote,
            text=text,
            why=why,
            session_id=session_id,
            author_kind="coauthor",
        )
        .returning(suggestions.c.id)
    ).scalar_one()
    return _suggestion_by_id(connection, suggestion_id)


def create_user_suggestion(
    connection: Connection,
    document_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    scene_uid: object,
    quote: object,
    text: object,
    why: object,
    author_id: uuid.UUID,
) -> Suggestion:
    """A participant's suggestion (openspec/specs/api/review, «Предложение правки от участника»): anchored like the
    co-author's, its id is the id of the future mark; the saved text does not change."""
    ensure_open(connection, _screenplay(connection, document_id))
    if not isinstance(scene_uid, str) or not scene_uid:
        raise Invalid("Поле «scene_uid»: нужен uid сцены цитаты.", "scene_uid")
    if not isinstance(quote, str) or not quote:
        raise Invalid("Цитата не может быть пустой.", "quote")
    if not isinstance(text, str) or not text.strip():
        raise Invalid("Предлагаемый текст не может быть пустым.", "text")
    if not isinstance(why, str):
        raise Invalid("Поле «why» должно быть строкой.", "why")
    try:
        _scene_of_quote(connection, document_id, scene_uid, quote)
    except NotFound as error:
        raise Invalid(str(error), "scene_uid") from error
    if connection.execute(select(suggestions.c.id).where(suggestions.c.id == suggestion_id)).one_or_none():
        raise Conflict(f"Предложение {suggestion_id} уже есть.")
    connection.execute(
        insert(suggestions).values(
            id=suggestion_id,
            document_id=document_id,
            scene_uid=scene_uid,
            quote=quote,
            text=text,
            why=why.strip(),
            author_kind="user",
            author_id=author_id,
        )
    )
    return _suggestion_by_id(connection, suggestion_id)


def list_suggestions(connection: Connection, document_id: uuid.UUID, status: str | None) -> list[Suggestion]:
    _screenplay(connection, document_id)
    query = _suggestions().where(suggestions.c.document_id == document_id)
    if status is not None:
        if status not in SUGGESTION_STATUSES:
            raise Invalid(f"Статус должен быть одним из: {', '.join(SUGGESTION_STATUSES)}.", "status")
        query = query.where(suggestions.c.status == status)
    rows = connection.execute(query.order_by(suggestions.c.created_at, suggestions.c.id)).all()
    return [_suggestion(row) for row in rows]


def decide(connection: Connection, suggestion_id: uuid.UUID, status: object, user_id: uuid.UUID) -> Suggestion:
    """The decision of the owner or a co-author, once; the accepted text is saved by the client through the text
    route.

    The text as it stands before an accepted edit becomes a snapshot.
    """
    if status not in ("accepted", "rejected"):
        raise Invalid("Поле «status» должно быть accepted или rejected.", "status")
    current = connection.execute(
        select(suggestions.c.status, suggestions.c.document_id)
        .where(suggestions.c.id == suggestion_id)
        .with_for_update()
    ).one_or_none()
    if current is None:
        raise NotFound(f"Предложения {suggestion_id} нет.")
    if current.status != "open":
        raise Conflict("По предложению уже есть решение.")
    ensure_open(connection, document_row(connection, current.document_id))
    if status == "accepted":
        keep_text(connection, current.document_id, "suggestion")
    connection.execute(
        update(suggestions)
        .where(suggestions.c.id == suggestion_id)
        .values(status=status, decided_at=func.now(), decided_by=user_id)
    )
    return _suggestion_by_id(connection, suggestion_id)

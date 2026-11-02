"""Comments on fragments and co-author suggestions: /api/v1 (openspec/specs/api/review).

Suggestions are created only by the co-author's tool; the author lists them and decides.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.body import caller_id, caller_role, parse_id, read_object, require_project
from app.api.problems import Problem
from app.api.schemas import MessageOut, SuggestionOut, ThreadOut
from app.auth import Principal, current_principal
from core import review
from core.documents import project_of_document
from core.engine import get_engine

router = APIRouter(prefix="/api/v1", tags=["Review"])


def _thread_out(thread: review.Thread, viewer: uuid.UUID) -> ThreadOut:
    return ThreadOut(
        id=thread.id,
        document_id=thread.document_id,
        quote=thread.quote,
        resolved_at=thread.resolved_at,
        created_at=thread.created_at,
        messages=[
            MessageOut(
                id=m.id,
                author_id=m.author_id,
                author_name=m.author_name,
                author_role=m.author_role,
                body=m.body,
                created_at=m.created_at,
                edited_at=m.edited_at,
                own=m.author_id == viewer,
            )
            for m in thread.messages
        ],
    )


def _document(principal: Principal, raw: str) -> uuid.UUID:
    document_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, project_of_document(connection, document_id))
    return document_id


def _thread(principal: Principal, raw: str) -> uuid.UUID:
    thread_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, project_of_document(connection, review.document_of_thread(connection, thread_id)))
    return thread_id


def _suggestion(principal: Principal, raw: str) -> uuid.UUID:
    suggestion_id = parse_id(raw)
    with get_engine().connect() as connection:
        document_id = review.document_of_suggestion(connection, suggestion_id)
        require_project(principal, project_of_document(connection, document_id))
    return suggestion_id


def _only(body: dict[str, Any], allowed: set[str]) -> None:
    unknown = set(body) - allowed
    if unknown:
        raise Problem(422, "Unprocessable Content", f"Поле «{sorted(unknown)[0]}» здесь не принимается.")


@router.get("/documents/{document_id}/comments", response_model=list[ThreadOut], summary="Comment threads of a text")
def list_comments(document_id: str, principal: Principal = Depends(current_principal)) -> list[ThreadOut]:
    found = _document(principal, document_id)
    with get_engine().connect() as connection:
        viewer = caller_id(connection, principal)
        return [_thread_out(t, viewer) for t in review.list_threads(connection, found)]


def _create_thread(principal: Principal, document_id: uuid.UUID, body: dict[str, Any]) -> ThreadOut:
    _only(body, {"id", "quote", "body"})
    thread_id = parse_id(str(body.get("id"))) if body.get("id") is not None else None
    if thread_id is None:
        raise Problem(422, "Unprocessable Content", "Поле «id»: нужен id метки комментария в тексте (UUID).")
    with get_engine().begin() as connection:
        author = caller_id(connection, principal)
        thread = review.create_thread(
            connection, document_id, thread_id, body.get("quote"), body.get("body"), author, caller_role(principal)
        )
        return _thread_out(thread, author)


@router.post(
    "/documents/{document_id}/comments",
    status_code=201,
    response_model=ThreadOut,
    summary="Open a comment thread on a fragment",
)
async def create_comment(
    document_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> ThreadOut:
    body = await read_object(request)
    found = await run_in_threadpool(_document, principal, document_id)
    return await run_in_threadpool(_create_thread, principal, found, body)


def _reply(principal: Principal, thread_id: uuid.UUID, body: dict[str, Any]) -> ThreadOut:
    _only(body, {"body"})
    with get_engine().begin() as connection:
        author = caller_id(connection, principal)
        thread = review.add_reply(connection, thread_id, body.get("body"), author, caller_role(principal))
        return _thread_out(thread, author)


@router.post("/comments/{thread_id}/replies", status_code=201, response_model=ThreadOut, summary="Reply in a thread")
async def reply(thread_id: str, request: Request, principal: Principal = Depends(current_principal)) -> ThreadOut:
    body = await read_object(request)
    found = await run_in_threadpool(_thread, principal, thread_id)
    return await run_in_threadpool(_reply, principal, found, body)


def _resolve(principal: Principal, thread_id: uuid.UUID, body: dict[str, Any]) -> ThreadOut:
    _only(body, {"resolved"})
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return _thread_out(review.set_resolved(connection, thread_id, body.get("resolved"), user), user)


@router.patch("/comments/{thread_id}", response_model=ThreadOut, summary="Mark a thread resolved or open again")
async def resolve(thread_id: str, request: Request, principal: Principal = Depends(current_principal)) -> ThreadOut:
    body = await read_object(request)
    found = await run_in_threadpool(_thread, principal, thread_id)
    return await run_in_threadpool(_resolve, principal, found, body)


def _edit(principal: Principal, thread_id: uuid.UUID, message_id: uuid.UUID, body: dict[str, Any]) -> ThreadOut:
    _only(body, {"body"})
    with get_engine().begin() as connection:
        author = caller_id(connection, principal)
        return _thread_out(review.edit_message(connection, thread_id, message_id, body.get("body"), author), author)


@router.patch("/comments/{thread_id}/messages/{message_id}", response_model=ThreadOut, summary="Edit an own message")
async def edit_message(
    thread_id: str, message_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> ThreadOut:
    body = await read_object(request)
    found = await run_in_threadpool(_thread, principal, thread_id)
    return await run_in_threadpool(_edit, principal, found, parse_id(message_id), body)


@router.delete(
    "/comments/{thread_id}/messages/{message_id}",
    status_code=204,
    summary="Delete an own message; the first message deletes the thread",
)
def delete_message(thread_id: str, message_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _thread(principal, thread_id)
    with get_engine().begin() as connection:
        review.delete_message(connection, found, parse_id(message_id), caller_id(connection, principal))
    return Response(status_code=204)


@router.get(
    "/documents/{document_id}/suggestions",
    response_model=list[SuggestionOut],
    summary="Co-author suggestions of a text, optionally by status",
)
def list_suggestions(
    document_id: str, status: str | None = None, principal: Principal = Depends(current_principal)
) -> list[SuggestionOut]:
    found = _document(principal, document_id)
    with get_engine().connect() as connection:
        return [SuggestionOut.model_validate(s) for s in review.list_suggestions(connection, found, status)]


def _decide(suggestion_id: uuid.UUID, body: dict[str, Any]) -> SuggestionOut:
    _only(body, {"status"})
    with get_engine().begin() as connection:
        return SuggestionOut.model_validate(review.decide(connection, suggestion_id, body.get("status")))


@router.patch(
    "/suggestions/{suggestion_id}", response_model=SuggestionOut, summary="Accept or reject a suggestion, once"
)
async def decide(
    suggestion_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> SuggestionOut:
    body = await read_object(request)
    found = await run_in_threadpool(_suggestion, principal, suggestion_id)
    return await run_in_threadpool(_decide, found, body)

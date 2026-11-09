"""Notes of a story: /api/v1 (openspec/specs/api/stories, «Заметки истории» … «Место для оригиналов заметок»).

Like the other story routes, every route first finds the story and checks the caller's access to it; a missing and
someone else's note both answer 404. A note from a file takes its place from the plan of the caller (billing).
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

import billing
from app.api.body import caller_id, if_match, parse_id, read_object, read_upload, require_project
from app.api.problems import Problem
from app.api.schemas import NoteOut
from app.auth import Principal, current_principal
from core import files, notes
from core.engine import get_engine

router = APIRouter(prefix="/api/v1", tags=["Notes"])


def _project_id(principal: Principal, raw: str) -> uuid.UUID:
    project_id = parse_id(raw)
    require_project(principal, project_id)
    return project_id


def _note_id(principal: Principal, raw: str) -> uuid.UUID:
    note_id = parse_id(raw)
    with get_engine().connect() as connection:
        project_id = notes.project_of_note(connection, note_id)
    require_project(principal, project_id)
    return note_id


@router.get(
    "/projects/{project_id}/notes",
    response_model=list[NoteOut],
    summary="The notes of a story with their texts, the trash included",
)
def list_notes(project_id: str, principal: Principal = Depends(current_principal)) -> list[NoteOut]:
    found = _project_id(principal, project_id)
    with get_engine().connect() as connection:
        return [NoteOut.model_validate(n) for n in notes.list_notes(connection, found)]


def storage_place(user_id: uuid.UUID) -> int:
    """Bytes for the originals of notes by the caller's plan; an ended subscription gives none."""
    try:
        return billing.storage_limit(user_id, datetime.now(UTC))
    except billing.SubscriptionEnded as error:
        raise Problem(403, "Forbidden", "Подписка закончилась: файлы в заметки не загружаются.") from error


def _note_from_upload(principal: Principal, project_id: uuid.UUID, name: str, data: bytes) -> NoteOut:
    checked = files.check_upload(name, "note", data)
    with get_engine().connect() as connection:
        user = caller_id(connection, principal)
    place = storage_place(user)
    with get_engine().begin() as connection:
        return NoteOut.model_validate(notes.create_note_from_file(connection, project_id, user, checked, place))


@router.post(
    "/projects/{project_id}/notes/files",
    status_code=201,
    response_model=NoteOut,
    summary="A note from a file: the file is checked like a file of a conversation and kept as the original",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def note_from_upload(
    project_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> NoteOut:
    found = await run_in_threadpool(_project_id, principal, project_id)
    _, name, data = await read_upload(request, set())
    return await run_in_threadpool(_note_from_upload, principal, found, name, data)


def _create_note(principal: Principal, project_id: uuid.UUID, body: dict[str, Any]) -> NoteOut:
    unknown = set(body) - {"title", "body"}
    if unknown:
        name = sorted(unknown)[0]
        raise Problem(422, "Unprocessable Content", f"Поле «{name}» нельзя задать при создании.")
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return NoteOut.model_validate(
            notes.create_note(connection, project_id, body.get("title"), body.get("body", ""), user)
        )


@router.post(
    "/projects/{project_id}/notes", status_code=201, response_model=NoteOut, summary="Create a note of a story"
)
async def create_note(project_id: str, request: Request, principal: Principal = Depends(current_principal)) -> NoteOut:
    body = await read_object(request)
    found = await run_in_threadpool(_project_id, principal, project_id)
    return await run_in_threadpool(_create_note, principal, found, body)


def _update_note(principal: Principal, note_id: uuid.UUID, revision: int, body: dict[str, Any]) -> NoteOut:
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return NoteOut.model_validate(notes.update_note(connection, note_id, revision, body, user))


@router.patch("/notes/{note_id}", response_model=NoteOut, summary="Change a note based on its revision (If-Match)")
async def update_note(
    note_id: str, request: Request, response: Response, principal: Principal = Depends(current_principal)
) -> NoteOut:
    body = await read_object(request)
    found = await run_in_threadpool(_note_id, principal, note_id)
    note = await run_in_threadpool(_update_note, principal, found, if_match(request), body)
    response.headers["ETag"] = f'"{note.revision}"'
    return note


@router.post("/notes/{note_id}/trash", response_model=NoteOut, summary="Move a note to the trash")
def trash_note(note_id: str, principal: Principal = Depends(current_principal)) -> NoteOut:
    found = _note_id(principal, note_id)
    with get_engine().begin() as connection:
        return NoteOut.model_validate(notes.trash_note(connection, found))


@router.post("/notes/{note_id}/restore", response_model=NoteOut, summary="Restore a note from the trash")
def restore_note(note_id: str, principal: Principal = Depends(current_principal)) -> NoteOut:
    found = _note_id(principal, note_id)
    with get_engine().begin() as connection:
        return NoteOut.model_validate(notes.restore_note(connection, found))


@router.delete("/notes/{note_id}", status_code=204, summary="Delete a note from the trash for good")
def delete_note(note_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _note_id(principal, note_id)
    with get_engine().begin() as connection:
        notes.delete_note(connection, found)
    return Response(status_code=204)

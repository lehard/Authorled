"""History of a document and points of a draft: /api/v1 (openspec/specs/api/stories).

Every route first finds the story of the record and checks the caller's access to it through the auth module.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from app.api.body import caller_id, if_match, parse_id, read_object, require_project
from app.api.problems import Problem
from app.api.schemas import PointOut, RestoredOut, VersionContentOut, VersionOut
from app.auth import Principal, current_principal
from core import saves
from core.documents import project_of_document
from core.drafts import project_of_draft
from core.engine import get_engine
from core.members import Need

router = APIRouter(prefix="/api/v1", tags=["Saves"])


def _document_id(principal: Principal, raw: str, need: Need) -> uuid.UUID:
    document_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, project_of_document(connection, document_id), need)
    return document_id


def _version_id(principal: Principal, raw: str, need: Need) -> uuid.UUID:
    version_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(
            principal, project_of_document(connection, saves.document_of_version(connection, version_id)), need
        )
    return version_id


def _draft_id(principal: Principal, raw: str, need: Need) -> uuid.UUID:
    draft_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, project_of_draft(connection, draft_id), need)
    return draft_id


def _point_id(principal: Principal, raw: str, need: Need) -> uuid.UUID:
    point_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, project_of_draft(connection, saves.draft_of_point(connection, point_id)), need)
    return point_id


@router.get(
    "/documents/{document_id}/versions",
    response_model=list[VersionOut],
    summary="Snapshots of the text or the fields of a document, newest first",
)
def list_versions(document_id: str, part: str, principal: Principal = Depends(current_principal)) -> list[VersionOut]:
    found = _document_id(principal, document_id, "read")
    with get_engine().connect() as connection:
        return [VersionOut.model_validate(v) for v in saves.list_versions(connection, found, part)]


@router.get("/versions/{version_id}", response_model=VersionContentOut, summary="A snapshot with its content")
def get_version(version_id: str, principal: Principal = Depends(current_principal)) -> VersionContentOut:
    found = _version_id(principal, version_id, "read")
    with get_engine().connect() as connection:
        return VersionContentOut.model_validate(saves.get_version(connection, found))


def _restore_version(principal: Principal, version_id: uuid.UUID, revision: int) -> RestoredOut:
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return RestoredOut(revision=saves.restore_version(connection, version_id, revision, user))


@router.post(
    "/versions/{version_id}/restore",
    response_model=RestoredOut,
    summary="Return a part of a document to a snapshot, based on its revision (If-Match)",
)
async def restore_version(
    version_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> RestoredOut:
    found = await run_in_threadpool(_version_id, principal, version_id, "edit")
    return await run_in_threadpool(_restore_version, principal, found, if_match(request))


@router.get("/drafts/{draft_id}/points", response_model=list[PointOut], summary="Points of a draft, newest first")
def list_points(draft_id: str, principal: Principal = Depends(current_principal)) -> list[PointOut]:
    found = _draft_id(principal, draft_id, "read")
    with get_engine().connect() as connection:
        return [PointOut.model_validate(p) for p in saves.list_points(connection, found)]


def _create_point(principal: Principal, draft_id: uuid.UUID, body: dict[str, Any]) -> PointOut:
    unknown = set(body) - {"name"}
    if unknown:
        raise Problem(422, "Unprocessable Content", f"Поле «{sorted(unknown)[0]}» здесь не принимается.")
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return PointOut.model_validate(saves.create_point(connection, draft_id, body.get("name"), user))


@router.post(
    "/drafts/{draft_id}/points",
    status_code=201,
    response_model=PointOut,
    summary="Save a named point of the whole draft",
)
async def create_point(draft_id: str, request: Request, principal: Principal = Depends(current_principal)) -> PointOut:
    body = await read_object(request)
    found = await run_in_threadpool(_draft_id, principal, draft_id, "edit")
    return await run_in_threadpool(_create_point, principal, found, body)


@router.post(
    "/points/{point_id}/restore",
    response_model=PointOut,
    summary="Return a whole draft to a point; the answer is the automatic point of the state before",
)
def restore_point(point_id: str, principal: Principal = Depends(current_principal)) -> PointOut:
    found = _point_id(principal, point_id, "edit")
    with get_engine().begin() as connection:
        return PointOut.model_validate(saves.restore_point(connection, found, caller_id(connection, principal)))

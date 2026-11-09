"""Marks of answers of the co-author: /api/v1/coauthor-feedback (openspec/specs/api/coauthor-feedback).

A caller marks only a run of the co-author that the usage journal records on them, in a conversation of a story they
can reach; anything else answers the same 404, so the route does not tell whether a run exists. No model is called,
and only identifiers and the value reach the logs.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Connection
from starlette.concurrency import run_in_threadpool

from app.api.body import caller_id, read_object, require_project
from app.api.problems import Problem
from app.auth import Principal, can_access_project, current_principal
from core import feedback
from core.engine import get_engine
from core.errors import Invalid, NotFound
from core.tables import COAUTHOR_FEEDBACK_VALUES

router = APIRouter(prefix="/api/v1", tags=["Coauthor feedback"])
log = logging.getLogger(__name__)


class FeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: Literal["useful", "not_useful"]


class FeedbackOut(BaseModel):
    run_id: str
    session_id: str
    value: Literal["useful", "not_useful"]
    updated_at: datetime


class SessionFeedbackOut(BaseModel):
    run_id: str
    value: Literal["useful", "not_useful"]
    updated_at: datetime


def _value(body: dict[str, Any]) -> str:
    unknown = sorted(set(body) - {"value"})
    if unknown:
        raise Problem(422, "Unprocessable Content", f"Поле «{unknown[0]}» не принимается.")
    if "value" not in body:
        raise Problem(422, "Unprocessable Content", "Поле «value» обязательно.")
    value = body["value"]
    if not isinstance(value, str) or value not in COAUTHOR_FEEDBACK_VALUES:
        raise Problem(422, "Unprocessable Content", f"Поле «value»: одно из {', '.join(COAUTHOR_FEEDBACK_VALUES)}.")
    return value


def _reachable_run(connection: Connection, principal: Principal, run_id: str) -> uuid.UUID:
    """The caller's account id of a run of the co-author in a story the caller can reach."""
    user = caller_id(connection, principal)
    session_id = feedback.run_session(connection, user, run_id)
    try:
        project_id = feedback.session_project(session_id)
    except Invalid as error:
        raise NotFound(feedback.RUN_NOT_FOUND) from error
    if not can_access_project(principal, str(project_id)):
        raise NotFound(feedback.RUN_NOT_FOUND)
    return user


def _set(principal: Principal, run_id: str, value: str) -> FeedbackOut:
    with get_engine().begin() as connection:
        user = _reachable_run(connection, principal, run_id)
        stored = feedback.set_feedback(connection, user, run_id, value)
    log.info("coauthor feedback %s: run %s, conversation %s", value, run_id, stored.session_id)
    return FeedbackOut.model_validate(stored, from_attributes=True)


# The body is read and checked here, not by FastAPI (see app/api/body.py); the schema is still published in OpenAPI.
@router.put(
    "/coauthor-feedback/{run_id}",
    response_model=FeedbackOut,
    summary="Mark an answer of the co-author: useful or not useful",
    openapi_extra={
        "requestBody": {"required": True, "content": {"application/json": {"schema": FeedbackIn.model_json_schema()}}}
    },
)
async def put_feedback(run_id: str, request: Request, principal: Principal = Depends(current_principal)) -> FeedbackOut:
    value = _value(await read_object(request))
    return await run_in_threadpool(_set, principal, run_id, value)


def _clear(principal: Principal, run_id: str) -> None:
    with get_engine().begin() as connection:
        user = _reachable_run(connection, principal, run_id)
        feedback.clear_feedback(connection, user, run_id)
    log.info("coauthor feedback cleared: run %s", run_id)


@router.delete(
    "/coauthor-feedback/{run_id}", status_code=204, summary="Take back the mark of an answer of the co-author"
)
async def delete_feedback(run_id: str, principal: Principal = Depends(current_principal)) -> Response:
    await run_in_threadpool(_clear, principal, run_id)
    return Response(status_code=204)


def _of_session(principal: Principal, session_id: str) -> list[SessionFeedbackOut]:
    project_id = feedback.session_project(session_id)
    require_project(principal, project_id)
    with get_engine().connect() as connection:
        user = caller_id(connection, principal)
        marks = feedback.session_feedback(connection, user, session_id)
    return [SessionFeedbackOut.model_validate(mark, from_attributes=True) for mark in marks]


@router.get(
    "/coauthor-feedback",
    response_model=list[SessionFeedbackOut],
    summary="The caller's marks of the answers of the co-author in a conversation",
)
async def list_feedback(
    request: Request, principal: Principal = Depends(current_principal)
) -> list[SessionFeedbackOut]:
    # Read here, not as a FastAPI parameter: its validation error would not answer problem+json.
    session_id = request.query_params.get("session_id")
    if session_id is None:
        raise Problem(422, "Unprocessable Content", "Нужен параметр session_id — идентификатор беседы.")
    return await run_in_threadpool(_of_session, principal, session_id)

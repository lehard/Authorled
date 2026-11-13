"""Writing of the author: GET /api/v1/drafts/{id}/writing (openspec/specs/api/writing)."""

from fastapi import APIRouter, Depends

from app.api.body import caller_id, parse_id, require_project
from app.api.schemas import WritingOut
from app.auth import Principal, current_principal
from core import drafts, writing
from core.engine import get_engine

router = APIRouter(prefix="/api/v1", tags=["Writing"])


# `tz` is checked by the core, not by FastAPI: a missing query parameter would go through Agno's app-wide handler,
# which does not answer problem+json.
@router.get(
    "/drafts/{draft_id}/writing",
    response_model=WritingOut,
    summary="Words of the caller by day in a time zone, the daily goal and the goal of the story of the draft",
)
def get_writing(draft_id: str, tz: str | None = None, principal: Principal = Depends(current_principal)) -> WritingOut:
    found = parse_id(draft_id)
    with get_engine().connect() as connection:
        require_project(principal, drafts.project_of_draft(connection, found), "read")
        user = caller_id(connection, principal)
        return WritingOut.model_validate(writing.statistics(connection, user, found, tz))

"""Search of a draft and its story: /api/v1 (openspec/specs/api/stories, «Поиск по драфту истории» … «Отказы поиска»).

Like the other story routes, the route first finds the story of the draft and checks the caller's access to it; a
missing and someone else's draft both answer 404. The query is read from the request, not as a FastAPI parameter:
a missing parameter would be refused by Agno's handler, not with problem+json (app/api/body.py).
"""

from fastapi import APIRouter, Depends, Request

from app.api.body import parse_id, require_project
from app.api.schemas import SearchOut
from app.auth import Principal, current_principal
from core import drafts, search
from core.engine import get_engine
from core.errors import Invalid

router = APIRouter(prefix="/api/v1", tags=["Search"])


@router.get(
    "/drafts/{draft_id}/search",
    response_model=SearchOut,
    summary="Matches of `q` in the draft and the notes of its story, grouped as scenes, documents and notes",
)
def search_draft(draft_id: str, request: Request, principal: Principal = Depends(current_principal)) -> SearchOut:
    found = parse_id(draft_id)
    with get_engine().connect() as connection:
        require_project(principal, drafts.project_of_draft(connection, found), "read")
        query = request.query_params.get("q")
        if query is None:
            raise Invalid("Нет параметра q: введите, что искать.", "q")
        return SearchOut.model_validate(search.search_draft(connection, found, query))

"""Participants of a story, invitations, the link «почитать» and presence: /api/v1
(openspec/specs/api/story-sharing).

Every route but reading by a link checks the caller's role in the story first. Reading by a link takes no token: its
path is one of the exact public routes of the auth module, and the key comes in the body, not in the address.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.body import caller_id, parse_id, read_object, read_small_object, require_project
from app.api.problems import Problem
from app.api.schemas import InvitationOut, MemberOut, MembersOut, PresenceOut, ReadLinkOut, SharedTextOut
from app.auth import Principal, current_principal
from core import drafts, members, presence, read_links
from core.engine import get_engine
from core.members import Need, Role

router = APIRouter(prefix="/api/v1", tags=["Sharing"])
public_router = APIRouter(prefix="/api/v1", tags=["Sharing"])

# The body of reading by a link holds only the key.
_OPEN_BODY_BYTES = 1024


def _only(body: dict[str, Any], allowed: set[str]) -> None:
    unknown = set(body) - allowed
    if unknown:
        raise Problem(422, "Unprocessable Content", f"Поле «{sorted(unknown)[0]}» здесь не принимается.")


def _project(principal: Principal, raw: str, need: Need) -> tuple[uuid.UUID, Role]:
    project_id = parse_id(raw)
    return project_id, require_project(principal, project_id, need)


def _draft(principal: Principal, raw: str, need: Need) -> uuid.UUID:
    draft_id = parse_id(raw)
    with get_engine().connect() as connection:
        project_id = drafts.project_of_draft(connection, draft_id)
    require_project(principal, project_id, need)
    return draft_id


# --- participants and invitations


@router.get(
    "/projects/{project_id}/members",
    response_model=MembersOut,
    summary="Participants of a story; the owner also gets the invitations waiting",
)
def list_members(project_id: str, principal: Principal = Depends(current_principal)) -> MembersOut:
    found, role = _project(principal, project_id, "read")
    with get_engine().connect() as connection:
        people = members.members(connection, found)
        waiting = members.invitations(connection, found) if role == "owner" else []
    return MembersOut(
        members=[MemberOut.model_validate(m) for m in people],
        invitations=[InvitationOut.model_validate(i) for i in waiting],
    )


def _invite(principal: Principal, project_id: uuid.UUID, body: dict[str, Any]) -> InvitationOut:
    _only(body, {"email", "role"})
    with get_engine().begin() as connection:
        owner = caller_id(connection, principal)
        return InvitationOut.model_validate(
            members.invite(connection, project_id, owner, body.get("email"), body.get("role"))
        )


@router.post(
    "/projects/{project_id}/invitations",
    status_code=201,
    response_model=InvitationOut,
    summary="Invite an e-mail into a story with a role; no letter is sent",
)
async def invite(project_id: str, request: Request, principal: Principal = Depends(current_principal)) -> InvitationOut:
    body = await read_object(request)
    found, _ = await run_in_threadpool(_project, principal, project_id, "owner")
    return await run_in_threadpool(_invite, principal, found, body)


@router.delete("/invitations/{invitation_id}", status_code=204, summary="Take back an invitation")
def revoke_invitation(invitation_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = parse_id(invitation_id)
    with get_engine().connect() as connection:
        project_id = members.project_of_invitation(connection, found)
    require_project(principal, project_id, "owner")
    with get_engine().begin() as connection:
        members.revoke(connection, found)
    return Response(status_code=204)


def _change_role(project_id: uuid.UUID, user_id: uuid.UUID, body: dict[str, Any]) -> MemberOut:
    _only(body, {"role"})
    with get_engine().begin() as connection:
        return MemberOut.model_validate(members.change_role(connection, project_id, user_id, body.get("role")))


@router.patch(
    "/projects/{project_id}/members/{user_id}", response_model=MemberOut, summary="Change the role of a participant"
)
async def change_role(
    project_id: str, user_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> MemberOut:
    body = await read_object(request)
    found, _ = await run_in_threadpool(_project, principal, project_id, "owner")
    return await run_in_threadpool(_change_role, found, parse_id(user_id), body)


@router.delete(
    "/projects/{project_id}/members/{user_id}",
    status_code=204,
    summary="Remove a participant; a participant may remove themself (leave the story)",
)
def remove_member(project_id: str, user_id: str, principal: Principal = Depends(current_principal)) -> Response:
    target = parse_id(user_id)
    found, role = _project(principal, project_id, "read")
    with get_engine().begin() as connection:
        if target != caller_id(connection, principal):
            members.require(role, "owner")
        members.remove(connection, found, target)
    return Response(status_code=204)


# --- the link «почитать»


@router.get("/drafts/{draft_id}/read-link", response_model=ReadLinkOut, summary="The link «почитать» of a draft")
def get_read_link(draft_id: str, principal: Principal = Depends(current_principal)) -> ReadLinkOut:
    found = _draft(principal, draft_id, "edit")
    with get_engine().connect() as connection:
        return ReadLinkOut.model_validate(read_links.get_link(connection, found))


@router.put(
    "/drafts/{draft_id}/read-link",
    response_model=ReadLinkOut,
    summary="Create the link «почитать» of a draft, or give the one it has",
)
def put_read_link(draft_id: str, principal: Principal = Depends(current_principal)) -> ReadLinkOut:
    found = _draft(principal, draft_id, "edit")
    with get_engine().begin() as connection:
        return ReadLinkOut.model_validate(read_links.ensure_link(connection, found, caller_id(connection, principal)))


@router.delete("/drafts/{draft_id}/read-link", status_code=204, summary="Turn the link «почитать» of a draft off")
def delete_read_link(draft_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _draft(principal, draft_id, "edit")
    with get_engine().begin() as connection:
        read_links.remove_link(connection, found)
    return Response(status_code=204)


def _open(key: object) -> SharedTextOut:
    with get_engine().connect() as connection:
        return SharedTextOut.model_validate(read_links.open_link(connection, key))


@public_router.post(
    "/read-links/open",
    response_model=SharedTextOut,
    summary="Read the screenplay of a draft by the key of its link «почитать» (no token)",
)
async def open_read_link(request: Request, response: Response) -> SharedTextOut:
    body = await read_small_object(request, _OPEN_BODY_BYTES)
    _only(body, {"key"})
    response.headers["Cache-Control"] = "no-store"
    return await run_in_threadpool(_open, body.get("key"))


# --- presence


@router.put(
    "/drafts/{draft_id}/presence",
    response_model=PresenceOut,
    summary="Mark that the caller edits the screenplay of the draft; names the others editing it now",
)
def put_presence(draft_id: str, principal: Principal = Depends(current_principal)) -> PresenceOut:
    found = _draft(principal, draft_id, "edit")
    with get_engine().begin() as connection:
        return PresenceOut(editing=presence.mark(connection, found, caller_id(connection, principal)))

"""Who is calling: `Principal`, and the access check other modules call for a project."""

from dataclasses import dataclass
from typing import Protocol

from fastapi import HTTPException, Request

from app.auth.authorization import GROUP_SCOPES


@dataclass(frozen=True)
class Principal:
    """The authenticated caller, built from the claims of a verified token."""

    user_id: str
    groups: tuple[str, ...]
    scopes: frozenset[str]


class ProjectAccessNotConfigured(RuntimeError):
    """Raised when project access is checked before the core registered its source."""


class ProjectAccessSource(Protocol):
    """Provided by the product core: who may open which project."""

    def can_access(self, principal: Principal, project_id: str) -> bool: ...


_project_access: ProjectAccessSource | None = None


def set_project_access_source(source: ProjectAccessSource) -> None:
    """Register the source of project roles; allowed once."""
    global _project_access
    if _project_access is not None:
        raise RuntimeError("Project access source is already registered")
    _project_access = source


def can_access_project(principal: Principal, project_id: str) -> bool:
    """Whether the principal may access the project; never answers yes without a registered source."""
    if _project_access is None:
        raise ProjectAccessNotConfigured("Project access source is not configured; the product core must register it")
    return _project_access.can_access(principal, project_id)


def current_principal(request: Request) -> Principal:
    """FastAPI dependency: the caller verified by the AgentOS authorization middleware."""
    state = request.state
    user_id = getattr(state, "user_id", None)
    claims = getattr(state, "claims", None)
    if not getattr(state, "authenticated", False) or not user_id or not isinstance(claims, dict):
        raise HTTPException(status_code=401, detail="Authentication required")
    groups = claims.get("groups")
    if not isinstance(groups, list) or not all(isinstance(group, str) for group in groups):
        raise HTTPException(status_code=401, detail="Token has no valid groups claim")
    scopes = {scope for group in groups for scope in GROUP_SCOPES.get(group, ())}
    return Principal(user_id=str(user_id), groups=tuple(groups), scopes=frozenset(scopes))

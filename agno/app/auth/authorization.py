"""Agno authorization for Authentik tokens: signature, issuer, audience and group roles."""

from os import environ
from pathlib import Path

from agno.db.base import BaseDb
from agno.os.authz import Authorization

# Authentik groups (auth/blueprints/10-groups.yaml) and the Agno scopes each one gets.
# The group names are part of the token contract (openspec/specs/auth, "Контракт токена");
# scripts/check_auth_boundary.sh fails when they differ from the blueprints.
# Authors get no run scopes yet: the only agents registered today are platform tools (OS Manager,
# Company Manager, claude-engineer with shell and file access). Product agents get per-agent
# scopes together with the product core.
_USER_SCOPES = (
    "config:read",
    "sessions:read",
    "sessions:write",
    "sessions:delete",
    "memories:read",
    "memories:write",
    "memories:delete",
)
# Authors run only product agents, one scope per agent; never agents:run or agents:*:run, which
# would open the platform agents (OS Manager, claude-engineer) that run commands on the server.
_AUTHOR_SCOPES = (*_USER_SCOPES, "agents:coauthor:run")

GROUP_SCOPES: dict[str, tuple[str, ...]] = {
    "admins": ("agent_os:admin",),
    "editors": _AUTHOR_SCOPES,
    "screenwriters": _AUTHOR_SCOPES,
    "plugins": ("config:read", "sessions:read"),
}


# Paths Agno 3.1.10 leaves without a token check by default (JWTMiddleware._get_default_excluded_routes).
# Passing excluded paths replaces that list, so it is repeated here; a test compares it with the pinned Agno.
AGNO_DEFAULT_EXCLUDED_ROUTES = ("/", "/health", "/info", "/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect")
# Product routes without a token, each exactly, never a pattern (openspec/specs/auth, «Маршруты без токена»).
PUBLIC_ROUTES = ("/api/v1/beta-requests",)
EXCLUDED_ROUTES = (*AGNO_DEFAULT_EXCLUDED_ROUTES, *PUBLIC_ROUTES)


def _required_env(name: str) -> str:
    value = environ.get(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set")
    return value


def build_authorization(db: BaseDb) -> Authorization:
    """Return the AgentOS authorization for tokens issued by Authentik.

    Needs JWT_JWKS_FILE (public keys exported from Authentik), AUTH_ISSUER (issuer URL of the
    Authentik provider, exactly as it appears in tokens) and AUTH_AUDIENCE (client ID of the
    Authentik application). Any of them missing or unusable stops startup.
    """
    jwks_file = _required_env("JWT_JWKS_FILE")
    if not Path(jwks_file).is_file():
        raise RuntimeError(f"JWT_JWKS_FILE {jwks_file} does not exist; export the keys from Authentik first")
    authorization = Authorization(
        db=db,
        jwks_file=jwks_file,
        algorithm="RS256",
        issuer=_required_env("AUTH_ISSUER"),
        audience=_required_env("AUTH_FRONTEND_CLIENT_ID"),
        verify_audience=True,
        roles_claim="groups",
        excluded_route_paths=list(EXCLUDED_ROUTES),
    )
    # The code owns role scopes: a change here replaces what is stored on the next start.
    for group, scopes in GROUP_SCOPES.items():
        scope_list: list[str | tuple[str, str] | dict[str, str]] = list(scopes)
        authorization.set_role_scopes(group, scope_list, name=group)
    return authorization

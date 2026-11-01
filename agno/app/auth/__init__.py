"""
Module auth
===========

Application side of the auth module (deployment side: `auth/`). Authentik
issues the tokens; Agno verifies them. Everything that reads token claims lives here:
other modules see only `Principal`, `Identity` and `can_access_project`.
"""

from app.auth.authorization import build_authorization
from app.auth.principal import (
    Identity,
    MissingIdentityClaim,
    Principal,
    ProjectAccessNotConfigured,
    ProjectAccessSource,
    can_access_project,
    current_identity,
    current_principal,
    set_project_access_source,
)

__all__ = [
    "Identity",
    "MissingIdentityClaim",
    "Principal",
    "ProjectAccessNotConfigured",
    "ProjectAccessSource",
    "build_authorization",
    "can_access_project",
    "current_identity",
    "current_principal",
    "set_project_access_source",
]

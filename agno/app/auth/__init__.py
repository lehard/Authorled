"""
Module auth
===========

Application side of the auth module (deployment side: `auth/`). Authentik
issues the tokens; Agno verifies them. Everything that reads token claims lives here:
other modules see only `Principal` (`current_principal`, `run_principal`), `Identity`,
`can_access_project` and, for code that runs agents in process on the local stand, `DevCaller`
(`dev_writer_caller`).
"""

from app.auth.authorization import build_authorization
from app.auth.dev_caller import DevCaller, DevCallerError, dev_writer_caller, verified_caller
from app.auth.principal import (
    Identity,
    MissingIdentityClaim,
    Principal,
    ProjectAccessNotConfigured,
    ProjectAccessSource,
    can_access_project,
    current_identity,
    current_principal,
    run_principal,
    set_project_access_source,
)

__all__ = [
    "DevCaller",
    "DevCallerError",
    "Identity",
    "MissingIdentityClaim",
    "Principal",
    "ProjectAccessNotConfigured",
    "ProjectAccessSource",
    "build_authorization",
    "can_access_project",
    "current_identity",
    "current_principal",
    "dev_writer_caller",
    "run_principal",
    "set_project_access_source",
    "verified_caller",
]

"""The scopes of the group routines (openspec/specs/auth, «Права по группам»): the Routine of Company Manager
runs that one agent and only proposes work, never with admin scopes, other agents or deletes."""

from app.auth.authorization import GROUP_SCOPES

ROUTINES = set(GROUP_SCOPES["routines"])


def test_routines_run_company_manager() -> None:
    assert "agents:company-manager-internal:run" in ROUTINES


def test_routines_have_no_admin_or_wide_run() -> None:
    assert not ROUTINES & {"agent_os:admin", "agents:run", "agents:*:run", "teams:run", "workflows:run"}


def test_routines_run_no_other_agent() -> None:
    runs = {scope for scope in ROUTINES if scope.endswith(":run")}
    assert runs == {"agents:company-manager-internal:run"}


def test_routines_delete_nothing() -> None:
    assert not {scope for scope in ROUTINES if scope.endswith(":delete")}

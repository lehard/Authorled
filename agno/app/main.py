"""
AgentOS Entrypoint
==================
"""

from os import environ

from agno.job_queue import QueueConfig
from agno.os import AgentOS, CompanyConfig, OSManager
from agno.os.interfaces.agui import AGUI

from agents.coauthor import COAUTHOR_ID, coauthor
from agents.engineers import engineers
from app.api import attach_api
from app.auth import build_authorization, set_project_access_source
from app.company import products
from app.interfaces import attach_interfaces, mcp_auth
from app.paths import REPO_ROOT
from app.registry import registry, shared_knowledge, shared_learning
from app.settings import manager_model
from core.clamav import scanner_address
from core.projects import ProjectAccess
from db import get_postgres_db


def _required_env(name: str) -> str:
    value = environ.get(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set")
    return value


runtime_env = _required_env("RUNTIME_ENV")
if runtime_env not in ("dev", "prd"):
    raise RuntimeError(f"RUNTIME_ENV must be exactly 'dev' or 'prd', got {runtime_env!r}")
agentos_url = _required_env("AGENTOS_URL")
# Agno's own managers report every run unless AGNO_TELEMETRY says otherwise; our agents also set
# telemetry=False in code (openspec/specs/runtime, «Телеметрия Agno выключена»).
if environ.get("AGNO_TELEMETRY") != "false":
    raise RuntimeError(f"AGNO_TELEMETRY must be exactly 'false', got {environ.get('AGNO_TELEMETRY')!r}")
db = get_postgres_db()

agent_os = AgentOS(
    db=db,
    mcp=True,
    tracing=True,
    telemetry=False,
    scheduler=True,
    user_isolation=True,
    user_directory=True,
    scheduler_base_url=agentos_url,
    mcp_auth=mcp_auth(agentos_url),
    authorization=build_authorization(db),
    manager=OSManager(
        root=REPO_ROOT,
        model=manager_model(),
        learning=shared_learning,
    ),
    company=CompanyConfig(products=products, model=manager_model()),
    queue=QueueConfig(durable=True, db=db),
    knowledge=[shared_knowledge],
    agents=[*engineers, coauthor],
    # Chat of the web frontend (CopilotKit). Under /agents/<id>/ so the per-agent scope
    # agents:coauthor:run is enough to run it (openspec/specs/api/agents, «AG-UI соавтора»).
    interfaces=[AGUI(agent=coauthor, prefix=f"/agents/{COAUTHOR_ID}")],
    registry=registry,
    config=str(REPO_ROOT / "agno" / "app" / "config.yaml"),
)
attach_interfaces(agent_os)
# Every uploaded file goes through the antivirus: no address, no API (openspec/specs/runtime).
scanner_address()
# Who may open a story: the product core answers for the auth module (only the owner).
set_project_access_source(ProjectAccess())
app = agent_os.get_app()
# Product routes go into the app AgentOS returns, not through base_app: with base_app Agno 3.1.10
# drops its error handlers for its own routes (ADR-002).
attach_api(app)

if __name__ == "__main__":
    agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)

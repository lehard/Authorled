"""
AgentOS Entrypoint
==================
"""

from os import environ
from pathlib import Path

from agno.job_queue import QueueConfig
from agno.os import AgentOS, CompanyConfig, OSManager

from agents.engineers import engineers
from app.company import products
from app.interfaces import attach_interfaces, mcp_auth
from app.registry import registry, shared_knowledge, shared_learning
from app.settings import manager_model
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
agentos_root = Path(__file__).resolve().parent.parent
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
    authorization=runtime_env != "dev",
    manager=OSManager(
        root=agentos_root,
        model=manager_model(),
        learning=shared_learning,
    ),
    company=CompanyConfig(products=products, model=manager_model()),
    queue=QueueConfig(durable=True, db=db),
    knowledge=[shared_knowledge],
    agents=[*engineers],
    registry=registry,
    config=str(agentos_root / "app" / "config.yaml"),
)
attach_interfaces(agent_os)
app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)

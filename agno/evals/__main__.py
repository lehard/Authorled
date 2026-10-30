"""python -m evals [--name CASE] [--tag smoke] [--json-output FILE]."""

import sys

from dotenv import load_dotenv

from app.paths import REPO_ROOT


def main() -> int:
    load_dotenv(REPO_ROOT / ".env")

    from agno.eval import cli
    from agno.os.utils import collect_mcp_tools_from_team

    from app.settings import default_model
    from evals.cases import CASES, agent_os

    assert agent_os.db is not None and agent_os.manager is not None
    mcp_tools: list = []
    collect_mcp_tools_from_team(agent_os.manager, mcp_tools)
    return cli(CASES, db=agent_os.db, judge_model=default_model(), default_timeout=180, mcp_tools=mcp_tools)


if __name__ == "__main__":
    sys.exit(main())

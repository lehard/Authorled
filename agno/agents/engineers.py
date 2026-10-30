"""Claude Code agent for engineering tasks, served by DeepSeek through LiteLLM."""

from agno.agents.base import BaseExternalAgent
from agno.agents.claude import ClaudeAgent
from claude_agent_sdk import ClaudeAgentOptions

from app.paths import REPO_ROOT
from app.sandbox import REPOSITORY, sandbox_provider
from app.settings import DEEPSEEK_FAST, DEEPSEEK_THINKING, litellm_key, litellm_url
from db import get_postgres_db

db = get_postgres_db()
sandbox = sandbox_provider()
if sandbox is not None and REPOSITORY is None:
    raise ValueError("Set REPOSITORY in app/sandbox.py before enabling a sandbox.")
repository = None if sandbox is None else REPOSITORY
cwd = str(REPO_ROOT) if sandbox is None else None

# Claude Code speaks the Anthropic Messages API; the LiteLLM proxy serves it at
# /v1/messages and routes the aliases to DeepSeek. These values override any
# inherited ANTHROPIC_* variables so no call reaches Anthropic.
claude_code_env = {
    "ANTHROPIC_BASE_URL": litellm_url(),
    "ANTHROPIC_API_KEY": litellm_key(),
    "ANTHROPIC_DEFAULT_OPUS_MODEL": DEEPSEEK_THINKING,
    "ANTHROPIC_DEFAULT_SONNET_MODEL": DEEPSEEK_THINKING,
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": DEEPSEEK_FAST,
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
}

claude_engineer = ClaudeAgent(
    id="claude-engineer",
    name="Claude Engineer",
    model=DEEPSEEK_THINKING,
    db=db,
    cwd=cwd,
    sandbox=sandbox,
    repository=repository,
    system_prompt={"type": "preset", "preset": "claude_code"},
    permission_mode="acceptEdits",
    options=ClaudeAgentOptions(env=claude_code_env),
)
engineers: list[BaseExternalAgent] = [claude_engineer]

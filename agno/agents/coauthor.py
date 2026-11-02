"""Co-author of the writer's workspace: the product agent behind the chat (AG-UI).

It talks about the writer's story using what the frontend sends in the AG-UI context (the story,
the open document, the selected fragment), the conversation history and the story it reads with the
tools of the core (agents/coauthor_tools.py); its only change is a suggestion the author decides on.
No user memory: the work itself belongs to the core, not to Agno (openspec/specs/api/agents,
«Соавтор»). The prompt is agno/skills/coauthor/SKILL.md.
"""

from agno.agent import Agent

from agents.coauthor_tools import COAUTHOR_TOOLS
from agents.prompts import agent_prompt
from app.settings import default_model
from db import get_postgres_db

COAUTHOR_ID = "coauthor"

coauthor = Agent(
    id=COAUTHOR_ID,
    name="Соавтор",
    model=default_model(),
    db=get_postgres_db(),
    instructions=agent_prompt(COAUTHOR_ID),
    tools=COAUTHOR_TOOLS,
    markdown=True,
    add_history_to_context=True,
    num_history_runs=10,
    add_datetime_to_context=True,
)

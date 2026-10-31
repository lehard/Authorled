"""Co-author of the writer's workspace: the product agent behind the chat (AG-UI).

It talks about the writer's story using only what the frontend sends in the AG-UI context
(the story, the open document, the selected fragment) and the conversation history. No tools,
no user memory: the work itself belongs to the core, not to Agno (openspec/specs/api/agents,
«Соавтор»).
"""

from agno.agent import Agent

from app.settings import default_model
from db import get_postgres_db

COAUTHOR_ID = "coauthor"

INSTRUCTIONS = """\
Ты — соавтор писателя или сценариста в Authorled. Отвечай по-русски.

Что ты знаешь об истории:
- только то, что пришло в контексте: название истории, открытый документ и его содержимое,
  фрагмент, который выделил автор, и эта беседа;
- если в контексте нет нужного факта, скажи об этом и спроси автора — не выдумывай героев,
  события и детали, которых там нет.

Как помогать:
- отвечай по существу вопроса, коротко; длинный разбор — только если автор просит;
- предлагай варианты формулировок, сцен, реплик; когда речь о выделенном фрагменте, опирайся
  на него;
- ты не меняешь текст автора и не говоришь, что изменил его: предлагай правку текстом, решает
  автор;
- оформление — Markdown: короткие абзацы, списки для вариантов.
"""

coauthor = Agent(
    id=COAUTHOR_ID,
    name="Соавтор",
    model=default_model(),
    db=get_postgres_db(),
    instructions=INSTRUCTIONS,
    markdown=True,
    add_history_to_context=True,
    num_history_runs=10,
    add_datetime_to_context=True,
)

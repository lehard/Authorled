"""Components of the routing exam: domain stubs, the orchestrator team and the agent with domain skills.

Built per run on the model of the run, never registered in AgentOS and without a database, so nothing is stored
(openspec/specs/orchestrator, «Экзаменационные компоненты вне AgentOS»). Every variant reads the domains of the chosen
set from the same skills agno/skills/<id>/SKILL.md: the description is what the chooser sees, the body is the stub's
prompt. The set `base` has four domains without tools; `wide` has twelve, each but domain-none with stub tools
(tools.py): a team member gets only its domain's tools, the skills agent gets all of them.
"""

import uuid
from collections.abc import Callable, Sequence

from agno.agent import Agent
from agno.db.in_memory import InMemoryDb
from agno.models.base import Model
from agno.models.message import Message
from agno.run.agent import RunOutput
from agno.run.base import RunStatus
from agno.run.team import TeamRunOutput
from agno.session.agent import AgentSession
from agno.session.team import TeamSession
from agno.skills import LocalSkills, Skills
from agno.team import Team, TeamMode

from agents.prompts import agent_prompt, agent_skill, skill_dir
from app.settings import (
    CLAUDE_OPUS,
    CLAUDE_SONNET,
    DEEPSEEK_FAST,
    claude_opus_model,
    claude_sonnet_model,
    default_model,
)
from evals.routing.tools import WIDE_TOOLS, check_tools, tool_domains

DOMAIN_SETS: dict[str, tuple[str, ...]] = {
    "base": ("domain-documents", "domain-structure", "domain-craft", "domain-none"),
    "wide": (
        "wide-characters",
        "wide-world",
        "wide-notes",
        "wide-text",
        "wide-review",
        "wide-structure",
        "wide-scenes",
        "wide-dialogue",
        "wide-craft",
        "wide-help",
        "wide-research",
        "domain-none",
    ),
}
# Stub tools by domain for each set; a domain without an entry has none.
SET_TOOLS: dict[str, dict[str, tuple[Callable[..., str], ...]]] = {"base": {}, "wide": WIDE_TOOLS}
ORCHESTRATOR_ID = "orchestrator"
SKILLS_AGENT_ID = "orchestrator-skills"
VARIANTS = ("team", "team-route", "skills")
MODELS: dict[str, Callable[[], Model]] = {
    DEEPSEEK_FAST: default_model,
    CLAUDE_SONNET: claude_sonnet_model,
    CLAUDE_OPUS: claude_opus_model,
}

DELEGATE_TOOL = "delegate_task_to_member"
SKILL_TOOL = "get_skill_instructions"


def domain_set(name: str) -> tuple[str, ...]:
    if name not in DOMAIN_SETS:
        raise ValueError(f"Domain set {name!r} is unknown; use one of: {', '.join(DOMAIN_SETS)}")
    return DOMAIN_SETS[name]


def tools_of(set_name: str) -> dict[str, str]:
    """Stub tool name -> its domain in the set; empty for a set without tools."""
    domain_set(set_name)
    return tool_domains(SET_TOOLS[set_name]) if SET_TOOLS[set_name] else {}


def check_skills(set_name: str) -> None:
    """Load every skill and tool of the set before the first model call; a broken one stops the exam."""
    domains = domain_set(set_name)
    tools = SET_TOOLS[set_name]
    outside = sorted(set(tools) - set(domains))
    if outside:
        raise RuntimeError(f"Tools of set {set_name!r} name domains outside it: {', '.join(outside)}")
    if tools:
        # Every content domain of a set with tools has them; domain-none never does (spec «Заглушки инструментов»).
        without = [d for d in domains if d != "domain-none" and d not in tools]
        if without or "domain-none" in tools:
            raise RuntimeError(f"Set {set_name!r}: domains without tools {without}; domain-none must have none")
        check_tools(tools)
    for domain in domains:
        skill = agent_skill(domain)
        # The skills agent gets Agno's get_skill_script, which can run a skill's scripts: a domain has none.
        if skill.scripts or skill.references:
            raise RuntimeError(
                f"Skill {domain!r} must have no scripts or references, found {skill.scripts + skill.references}"
            )
    agent_skill(ORCHESTRATOR_ID)
    agent_skill(SKILLS_AGENT_ID)


def model_factory(alias: str) -> Callable[[], Model]:
    if alias not in MODELS:
        raise ValueError(f"Model {alias!r} is not an exam model; use one of: {', '.join(MODELS)}")
    return MODELS[alias]


def _stub(domain: str, model: Callable[[], Model], tools: tuple[Callable[..., str], ...]) -> Agent:
    skill = agent_skill(domain)
    return Agent(
        id=domain,
        name=domain,
        role=skill.description,
        model=model(),
        instructions=skill.instructions,
        tools=list(tools),
        telemetry=False,
    )


def build(variant: str, model_alias: str, set_name: str, db: InMemoryDb | None = None) -> Agent | Team:
    """A fresh orchestrator of the variant on the model over the domain set; every component uses that model.

    With `db` (an in-memory session made by `history_session`) the orchestrator reads the earlier turns as
    history of its session, the way the product reads a conversation; nothing reaches PostgreSQL.
    """
    model = model_factory(model_alias)
    domains = domain_set(set_name)
    tools = SET_TOOLS[set_name]
    with_history = db is not None
    if variant in ("team", "team-route"):
        return Team(
            id=ORCHESTRATOR_ID,
            name="Оркестратор",
            mode=TeamMode.coordinate if variant == "team" else TeamMode.route,
            model=model(),
            members=[_stub(domain, model, tools.get(domain, ())) for domain in domains],
            instructions=agent_prompt(ORCHESTRATOR_ID),
            telemetry=False,
            db=db,
            add_history_to_context=with_history,
            num_history_runs=10,
        )
    if variant == "skills":
        return Agent(
            id=SKILLS_AGENT_ID,
            name="Соавтор с навыками",
            model=model(),
            instructions=agent_prompt(SKILLS_AGENT_ID),
            skills=Skills(loaders=[LocalSkills(str(skill_dir(domain)), validate=True) for domain in domains]),
            tools=[function for domain in domains for function in tools.get(domain, ())],
            telemetry=False,
            db=db,
            add_history_to_context=with_history,
            num_history_runs=10,
        )
    raise ValueError(f"Variant {variant!r} is unknown; use one of: {', '.join(VARIANTS)}")


def history_session(variant: str, turns: Sequence[tuple[str, str]]) -> tuple[InMemoryDb, str]:
    """An in-memory session whose runs are the earlier (author, co-author) turns of a case.

    Agno's Team flattens a list of input messages into one user message (team/_messages.py,
    _get_user_message), so the history goes in as earlier runs of the session, read by add_history_to_context.
    """
    db, session_id = InMemoryDb(), str(uuid.uuid4())
    team = variant in ("team", "team-route")
    session: TeamSession | AgentSession = (
        TeamSession(session_id=session_id, team_id=ORCHESTRATOR_ID)
        if team
        else AgentSession(session_id=session_id, agent_id=SKILLS_AGENT_ID)
    )
    db.upsert_session(session)
    for author, coauthor in turns:
        messages = [Message(role="user", content=author), Message(role="assistant", content=coauthor)]
        run: RunOutput | TeamRunOutput = (
            TeamRunOutput(
                run_id=str(uuid.uuid4()),
                team_id=ORCHESTRATOR_ID,
                session_id=session_id,
                status=RunStatus.completed,
                messages=messages,
            )
            if team
            else RunOutput(
                run_id=str(uuid.uuid4()),
                agent_id=SKILLS_AGENT_ID,
                session_id=session_id,
                status=RunStatus.completed,
                messages=messages,
            )
        )
        db.upsert_run(run, session_id=session_id)
    return db, session_id


def chosen_domains(output: RunOutput | TeamRunOutput) -> list[str]:
    """Domains the orchestrator chose: members it delegated to, or domain skills it loaded, in call order."""
    if isinstance(output, TeamRunOutput):
        tool, argument = DELEGATE_TOOL, "member_id"
    else:
        tool, argument = SKILL_TOOL, "skill_name"
    chosen: list[str] = []
    for call in output.tools or []:
        if call.tool_name != tool:
            continue
        if call.tool_call_error:
            # Agno refused the call (for example arguments that fail validation): nothing was delegated or loaded,
            # the model saw the error and could call again. Not a choice of a domain.
            continue
        value = (call.tool_args or {}).get(argument)
        if not isinstance(value, str) or not value:
            raise ValueError(f"Call {call.tool_name} of run {output.run_id} has no {argument}")
        if value not in chosen:
            chosen.append(value)
    return chosen


def stub_tool_calls(output: RunOutput | TeamRunOutput, tool_names: dict[str, str]) -> list[str]:
    """Stub tools that ran in the run and its member runs, in call order; a refused call did not run."""
    called: list[str] = []
    seen: set[str] = set()
    for run in model_runs(output):
        for call in run.tools or []:
            if call.tool_name not in tool_names or call.tool_call_error:
                continue
            if call.tool_call_id is None:
                raise ValueError(f"Call {call.tool_name} of run {run.run_id} has no tool_call_id")
            # A team run may also carry its members' calls; one call is counted once.
            if call.tool_call_id in seen:
                continue
            seen.add(call.tool_call_id)
            called.append(call.tool_name)
    return called


def model_runs(output: RunOutput | TeamRunOutput) -> list[RunOutput | TeamRunOutput]:
    """The run and every member run under it: a team's metrics do not include its members (agno team/_session.py)."""
    runs: list[RunOutput | TeamRunOutput] = [output]
    if isinstance(output, TeamRunOutput):
        for member in output.member_responses:
            runs.extend(model_runs(member))
    return runs

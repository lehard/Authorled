"""One case through the real co-author, the way the chat runs it (design, decisions 2–4).

A copy of the registered agent `coauthor` — the same prompt, tools, model and usage hooks — with its sessions in
memory, so nothing reaches the AgentOS sessions. The run belongs to the user of the measurement: the conversation id
names the open draft of its demo story, the caller is bound the way a request binds it, and the message carries the
chat's context block. A changing tool pauses the run; the measurement records the proposed action and answers
the pause as an author who rejects it, so the story does not change and the co-author finishes its answer to the
other requests of the message (owner, 2026-11-08).
"""

import time
import uuid

from agno.db.in_memory import InMemoryDb
from agno.models.message import Message
from agno.os.authz.provider import AuthorizationContext
from agno.os.authz.scope_provider import ScopeAuthorizationProvider
from agno.run.agent import RunOutput
from agno.run.authorization import RunAuthorization, authorization_scope
from agno.run.base import RunStatus
from agno.session.agent import AgentSession

from agents.coauthor import COAUTHOR_ID, coauthor
from app.auth.authorization import GROUP_SCOPES
from core.plans import ModelPrice

# Re-exported: the chat's context is built in context.py, without the agent, so tests can import it.
from evals.coauthor.context import CONTEXT_DESCRIPTION as CONTEXT_DESCRIPTION
from evals.coauthor.context import chat_context as chat_context
from evals.coauthor.records import Call, CaseRun, Usage
from evals.coauthor.user import QUALITY, Place
from evals.routing.cases import Case

# The group of screenwriters (openspec/specs/auth, GROUP_SCOPES): the scopes a writer's token gives.
AUTHOR_GROUP = "screenwriters"
REJECTION = "Автор отклонил это действие."
# A run that keeps pausing after this many rejections is a failed case, not an endless loop.
MAX_PAUSES = 4
# Whole results for the judge: the demo screenplays are about 2,300 characters; a cut one made later scenes look
# invented to the judge (rerun 2026-11-08).
RESULT_CHARS = 12000


def caller(subject: str) -> RunAuthorization:
    scopes = list(GROUP_SCOPES[AUTHOR_GROUP])
    context = AuthorizationContext(
        principal_id=subject, scopes=scopes, claims={"sub": subject, "groups": [AUTHOR_GROUP], "scopes": scopes}
    )
    # A request binds its caller the same way: identity for the tools, no extra tool checks (agno os/authz).
    return RunAuthorization(ScopeAuthorizationProvider(), context, enforce_tools=False)


def session_db(session_id: str, subject: str, case: Case | None) -> InMemoryDb:
    """Sessions of one run in memory, so nothing reaches the AgentOS sessions; `case` gives the earlier turns."""
    db = InMemoryDb()
    db.upsert_session(AgentSession(session_id=session_id, agent_id=COAUTHOR_ID, user_id=subject))
    if case is None:
        return db
    turns = case.history
    for author, answer in zip(turns[::2], turns[1::2], strict=True):
        db.upsert_run(
            RunOutput(
                run_id=str(uuid.uuid4()),
                agent_id=COAUTHOR_ID,
                session_id=session_id,
                user_id=subject,
                status=RunStatus.completed,
                messages=[Message(role="user", content=author.text), Message(role="assistant", content=answer.text)],
            ),
            session_id=session_id,
        )
    return db


def calls_of(output: RunOutput, proposed: set[str]) -> tuple[Call, ...]:
    calls: list[Call] = []
    for execution in output.tools or []:
        if execution.tool_name is None:
            raise ValueError(f"A tool call of run {output.run_id} has no name")
        paused = execution.tool_call_id in proposed
        result = "" if paused or execution.result is None else str(execution.result)[:RESULT_CHARS]
        calls.append(Call(execution.tool_name, dict(execution.tool_args or {}), paused, result))
    return tuple(calls)


def usage_of(output: RunOutput, model: str, price: ModelPrice) -> Usage:
    calls = sum(1 for m in output.messages or [] if m.role == "assistant" and m.metrics.output_tokens)
    input_tokens = cache_read = output_tokens = 0
    for entries in ((output.metrics.details if output.metrics else None) or {}).values():
        for entry in entries:
            if entry.id != model:
                raise RuntimeError(f"Run {output.run_id} used model {entry.id!r}, not {model!r}")
            input_tokens += entry.input_tokens
            cache_read += entry.cache_read_tokens
            output_tokens += entry.output_tokens
    return Usage(
        calls, input_tokens, cache_read, output_tokens, price.cost_rub(input_tokens, cache_read, output_tokens)
    )


async def run_case(case: Case, place: Place, context: dict[str, str], model: str, price: ModelPrice) -> CaseRun:
    session_id = f"{place.project_id}:{place.draft_id}:{uuid.uuid4()}"
    agent = coauthor.deep_copy(update={"db": session_db(session_id, QUALITY.subject, case)})
    proposed: set[str] = set()
    started = time.monotonic()
    try:
        with authorization_scope(lambda: caller(QUALITY.subject)):
            output = await agent.arun(
                input=case.message,
                session_id=session_id,
                user_id=QUALITY.subject,
                dependencies=context,
                add_dependencies_to_context=True,
                stream=False,
            )
            pauses = 0
            while output.status == RunStatus.paused:
                pauses += 1
                if pauses > MAX_PAUSES:
                    raise RuntimeError(f"The run paused more than {MAX_PAUSES} times")
                requirements = output.active_requirements
                for requirement in requirements:
                    if not requirement.needs_confirmation or requirement.tool_execution is None:
                        raise RuntimeError(
                            f"The run paused on a requirement the measurement cannot answer: {requirement}"
                        )
                    if requirement.tool_execution.tool_call_id is None:
                        raise RuntimeError("A paused tool call has no tool_call_id")
                    proposed.add(requirement.tool_execution.tool_call_id)
                    requirement.reject(REJECTION)
                output = await agent.acontinue_run(
                    run_response=output,
                    requirements=requirements,
                    session_id=session_id,
                    user_id=QUALITY.subject,
                    dependencies=context,
                    stream=False,
                )
    except Exception as error:
        # Recorded, not swallowed: the case is reported as a failed run with this text (spec «Отчёт замера»).
        return CaseRun(case.id, "error", "", time.monotonic() - started, error=f"{type(error).__name__}: {error}")
    seconds = time.monotonic() - started
    if output.status != RunStatus.completed:
        return CaseRun(case.id, "error", "", seconds, error=f"Run status {output.status}: {output.content}")
    answer = output.content if isinstance(output.content, str) else ""
    outcome = "paused" if proposed else "answered"
    return CaseRun(case.id, outcome, answer, seconds, calls_of(output, proposed), usage_of(output, model, price))

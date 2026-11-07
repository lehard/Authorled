"""Hooks of the co-author: the limit check before a run and the usage journal after it
(openspec/specs/core/subscriptions, «Проверка лимита до запуска», «Журнал расхода соавтора»).

They read Agno's run objects and call the core with plain data, like the tools of the co-author.
Agno 3.1.10 logs and swallows any exception of a hook except InputCheckError and OutputCheckError
(agno/agent/_hooks.py), so every failure here becomes one of those two: a failed check stops the run instead of
letting it go without a limit, and a failed record ends the run with an error instead of a line in the log.
Agno does not call post-hooks of failed or cancelled runs; the pre-hook writes such runs of the conversation
when the author writes into it again.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal

from agno.exceptions import CheckTrigger, InputCheckError, OutputCheckError
from agno.run import RunContext
from agno.run.agent import RunOutput
from agno.run.base import RunStatus
from agno.session import AgentSession
from agno.utils.log import log_exception

from app.auth import run_principal
from core.engine import get_engine
from core.usage import LimitReached, ModelUsage, NoTokens, RunUsage, check_limit, record_run, recorded_run_ids

LIMIT_REACHED = "usage_limit_reached"
CHECK_FAILED = "usage_check_failed"
RECORD_FAILED = "usage_record_failed"

# Moscow keeps UTC+3 all year: the date the author sees in the message.
MOSCOW = timezone(timedelta(hours=3), "MSK")
_MONTHS = (
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)
# Statuses of finished runs that may have spent tokens. A regenerated run was completed before it was replaced.
_FINISHED = {
    RunStatus.completed: "completed",
    RunStatus.regenerated: "completed",
    RunStatus.error: "error",
    RunStatus.cancelled: "cancelled",
}


def limit_message(renews_at: datetime) -> str:
    day = renews_at.astimezone(MOSCOW)
    return f"Лимит соавтора на этот период исчерпан. Он обновится {day.day} {_MONTHS[day.month - 1]}."


@dataclass
class _Totals:
    input_tokens: int = 0
    cache_read_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal | None = None


def run_usage(run: RunOutput, status: str) -> RunUsage | None:
    """The token counts of the run by model, or None when no model reported any."""
    details = run.metrics.details if run.metrics is not None else None
    by_model: dict[str, _Totals] = {}
    for entries in (details or {}).values():
        for entry in entries:
            if not entry.id:
                raise NoTokens(f"Run {run.run_id} has model metrics without a model id")
            totals = by_model.setdefault(entry.id, _Totals())
            totals.input_tokens += entry.input_tokens
            totals.cache_read_tokens += entry.cache_read_tokens
            totals.output_tokens += entry.output_tokens
            if entry.cost is not None:
                totals.cost_usd = (totals.cost_usd or Decimal(0)) + Decimal(str(entry.cost))
    if not by_model:
        return None
    if not run.run_id or not run.session_id or not run.agent_id:
        raise ValueError("The run has no run, session or agent id")
    return RunUsage(
        run_id=run.run_id,
        session_id=run.session_id,
        agent_id=run.agent_id,
        status=status,
        occurred_at=datetime.fromtimestamp(run.created_at, UTC),
        models=tuple(
            ModelUsage(
                model=model,
                input_tokens=t.input_tokens,
                cache_read_tokens=t.cache_read_tokens,
                output_tokens=t.output_tokens,
                provider_cost_usd=t.cost_usd,
            )
            for model, t in by_model.items()
        ),
    )


def _earlier_runs(session: AgentSession, subject: str, run_id: str | None) -> list[RunUsage]:
    found = []
    for run in session.runs or []:
        if not isinstance(run, RunOutput) or run.run_id == run_id or run.user_id != subject:
            continue
        status = _FINISHED.get(run.status)
        usage = None if status is None else run_usage(run, status)
        if usage is not None:
            found.append(usage)
    return found


def check_usage_limit(run_context: RunContext, session: AgentSession) -> None:
    """Pre-hook: write the unrecorded finished runs of this conversation, then refuse the run over the limit."""
    reached: LimitReached | None = None
    try:
        subject = run_principal(run_context).user_id
        now = datetime.now(UTC)
        with get_engine().begin() as connection:
            earlier = _earlier_runs(session, subject, run_context.run_id)
            known = recorded_run_ids(connection, [usage.run_id for usage in earlier])
            for usage in earlier:
                if usage.run_id not in known:
                    record_run(connection, subject, usage, now)
            try:
                check_limit(connection, subject, now)
            except LimitReached as error:
                # Leave the transaction normally: the runs written above and a renewed period stay.
                reached = error
    except Exception as error:
        log_exception(f"Usage check of run {run_context.run_id} failed: {type(error).__name__}: {error}")
        raise InputCheckError(
            "Не удалось проверить лимит соавтора. Напишите в поддержку.",
            check_trigger=CheckTrigger.INPUT_NOT_ALLOWED,
            additional_data={"reason": CHECK_FAILED},
        ) from error
    if reached is not None:
        raise InputCheckError(
            limit_message(reached.renews_at),
            check_trigger=CheckTrigger.INPUT_NOT_ALLOWED,
            additional_data={"reason": LIMIT_REACHED, "renews_at": reached.renews_at.isoformat()},
        ) from reached


def record_usage(run_output: RunOutput, run_context: RunContext) -> None:
    """Post-hook: write the finished run to the journal."""
    try:
        usage = run_usage(run_output, "completed")
        if usage is None:
            raise NoTokens(f"Run {run_output.run_id} finished without token counts")
        with get_engine().begin() as connection:
            record_run(connection, run_principal(run_context).user_id, usage, datetime.now(UTC))
    except Exception as error:
        log_exception(f"Usage record of run {run_output.run_id} failed: {type(error).__name__}: {error}")
        raise OutputCheckError(
            "Не удалось записать расход соавтора. Напишите в поддержку.",
            check_trigger=CheckTrigger.OUTPUT_NOT_ALLOWED,
            additional_data={"reason": RECORD_FAILED},
        ) from error

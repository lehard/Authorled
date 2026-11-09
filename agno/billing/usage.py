"""Usage journal of agent runs, the limit check and the administrator's report (openspec/specs/billing/subscriptions).

Billing knows nothing of Agno or of the core: the hooks of the co-author (agents/coauthor_usage.py) turn a run into
`RunUsage` and find the user of the core; here a user is only its identifier.
Spending of a period is the sum of `cost_rub` of the subscription's rows that started inside the period.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Connection, distinct, func, select
from sqlalchemy.dialects.postgresql import insert

from billing.plans import Plan, plans, prices
from billing.subscriptions import Subscription, current_subscription
from billing.tables import USAGE_RUN_STATUSES, usage_records


class NoTokens(Exception):
    """A run to record carries no token counts of any model."""


class RunNotFound(Exception):
    """The journal has no run with this identifier of this user and agent."""


class LimitReached(Exception):
    """The spending of the current period reached the limit of the plan."""

    def __init__(self, renews_at: datetime, spent: Decimal, limit: Decimal) -> None:
        super().__init__(f"Spent {spent} of {limit} RUB; the limit renews at {renews_at.isoformat()}")
        self.renews_at = renews_at
        self.spent = spent
        self.limit = limit


@dataclass(frozen=True)
class ModelUsage:
    model: str
    input_tokens: int
    cache_read_tokens: int
    output_tokens: int
    provider_cost_usd: Decimal | None


@dataclass(frozen=True)
class RunUsage:
    run_id: str
    session_id: str
    agent_id: str
    status: str
    occurred_at: datetime
    models: tuple[ModelUsage, ...]


@dataclass(frozen=True)
class Allowance:
    subscription: Subscription
    plan: Plan
    spent: Decimal


def record_run(connection: Connection, user_id: uuid.UUID, run: RunUsage, now: datetime) -> int:
    """Write the run to the journal under the user's current subscription; a repeat adds nothing.

    Returns the number of rows written.
    """
    if not run.models:
        raise NoTokens(f"Run {run.run_id} has no token counts")
    if run.status not in USAGE_RUN_STATUSES:
        raise ValueError(f"Run {run.run_id} has status {run.status!r}, not one of {USAGE_RUN_STATUSES}")
    subscription = current_subscription(connection, user_id, now)
    rows = [
        {
            "user_id": user_id,
            "subscription_id": subscription.id,
            "run_id": run.run_id,
            "session_id": run.session_id,
            "agent_id": run.agent_id,
            "model": usage.model,
            "run_status": run.status,
            "input_tokens": usage.input_tokens,
            "cache_read_tokens": usage.cache_read_tokens,
            "output_tokens": usage.output_tokens,
            "cost_rub": prices()
            .get(usage.model)
            .cost_rub(usage.input_tokens, usage.cache_read_tokens, usage.output_tokens),
            "provider_cost_usd": usage.provider_cost_usd,
            "occurred_at": run.occurred_at,
        }
        for usage in run.models
    ]
    written = connection.execute(
        insert(usage_records)
        .values(rows)
        .on_conflict_do_nothing(index_elements=[usage_records.c.run_id, usage_records.c.model])
        .returning(usage_records.c.id)
    ).all()
    return len(written)


def recorded_run_ids(connection: Connection, run_ids: list[str]) -> set[str]:
    """Which of these runs are in the journal already."""
    if not run_ids:
        return set()
    return set(
        connection.execute(
            select(usage_records.c.run_id).distinct().where(usage_records.c.run_id.in_(run_ids))
        ).scalars()
    )


def _in_period(subscription: Subscription) -> list:
    return [
        usage_records.c.subscription_id == subscription.id,
        usage_records.c.occurred_at >= subscription.period_start,
        usage_records.c.occurred_at < subscription.period_end,
    ]


def period_spend(connection: Connection, subscription: Subscription) -> Decimal:
    """Rubles spent in the current period of the subscription (0 when nothing was spent)."""
    spent = connection.execute(
        select(func.coalesce(func.sum(usage_records.c.cost_rub), 0)).where(*_in_period(subscription))
    ).scalar_one()
    return Decimal(spent)


def check_limit(connection: Connection, user_id: uuid.UUID, now: datetime) -> Allowance:
    """The user's current subscription and spending; LimitReached when the spending is at or over the limit."""
    subscription = current_subscription(connection, user_id, now)
    plan = plans().get(subscription.plan)
    spent = period_spend(connection, subscription)
    if spent >= plan.limit_rub:
        raise LimitReached(subscription.period_end, spent, plan.limit_rub)
    return Allowance(subscription=subscription, plan=plan, spent=spent)


def run_session(connection: Connection, user_id: uuid.UUID, run_id: str, agent_id: str) -> str:
    """The conversation of a run of this agent that the journal records for this user."""
    found = list(
        connection.execute(
            select(usage_records.c.session_id)
            .where(
                usage_records.c.run_id == run_id,
                usage_records.c.user_id == user_id,
                usage_records.c.agent_id == agent_id,
            )
            .distinct()
        ).scalars()
    )
    if not found:
        raise RunNotFound(f"Run {run_id} of agent {agent_id!r} is not in the journal of user {user_id}")
    if len(found) > 1:
        raise RuntimeError(f"Run {run_id} has {len(found)} conversations in the usage journal")
    return found[0]


@dataclass(frozen=True)
class ReportRow:
    user_id: uuid.UUID
    plan: str
    period_start: datetime
    period_end: datetime
    runs: int
    input_tokens: int
    cache_read_tokens: int
    output_tokens: int
    spent_rub: Decimal
    limit_rub: Decimal
    remaining_rub: Decimal
    # None when LiteLLM reported no cost for any row of the period.
    provider_cost_usd: Decimal | None


def report(connection: Connection, user_ids: list[uuid.UUID], now: datetime) -> list[ReportRow]:
    """Spending of these users in their current periods, in the given order; a user without a subscription fails.

    Reading the current subscription moves an ended granted period forward, as a run of the co-author would.
    """
    rows = []
    for user_id in user_ids:
        subscription = current_subscription(connection, user_id, now)
        plan = plans().get(subscription.plan)
        totals = connection.execute(
            select(
                func.count(distinct(usage_records.c.run_id)),
                func.coalesce(func.sum(usage_records.c.input_tokens), 0),
                func.coalesce(func.sum(usage_records.c.cache_read_tokens), 0),
                func.coalesce(func.sum(usage_records.c.output_tokens), 0),
                func.coalesce(func.sum(usage_records.c.cost_rub), 0),
                func.sum(usage_records.c.provider_cost_usd),
            ).where(*_in_period(subscription))
        ).one()
        spent = Decimal(totals[4])
        rows.append(
            ReportRow(
                user_id=user_id,
                plan=plan.code,
                period_start=subscription.period_start,
                period_end=subscription.period_end,
                runs=totals[0],
                input_tokens=int(totals[1]),
                cache_read_tokens=int(totals[2]),
                output_tokens=int(totals[3]),
                spent_rub=spent,
                limit_rub=plan.limit_rub,
                remaining_rub=plan.limit_rub - spent,
                provider_cost_usd=None if totals[5] is None else Decimal(totals[5]),
            )
        )
    return rows

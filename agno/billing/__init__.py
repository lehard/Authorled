"""The billing module: plans, subscriptions, the usage journal and the limit (openspec/specs/billing/module).

This file is its only entrance. Operations take and return plain values and frozen records, never a database
connection, and each runs in its own transaction: on an error nothing of it is kept. A user is the identifier of the
core's user; billing imports nothing of the core, the application layer, the agents or Agno.
Moved into its own service, these functions become its client and their callers stay as they are.
"""

import uuid
from collections.abc import Sequence
from datetime import datetime

from billing.engine import get_engine
from billing.plans import DataFileError, ModelPrice, Plan, Prices, UnknownModel, UnknownPlan, prices
from billing.plans import plans as _plans
from billing.subscriptions import NoSubscription, Subscription, SubscriptionEnded
from billing.subscriptions import ensure_signup_subscription as _ensure_signup_subscription
from billing.subscriptions import set_plan as _set_plan
from billing.usage import (
    Allowance,
    LimitReached,
    ModelUsage,
    NoTokens,
    ReportRow,
    RunNotFound,
    RunUsage,
)
from billing.usage import check_limit as _check_limit
from billing.usage import record_run as _record_run
from billing.usage import recorded_run_ids as _recorded_run_ids
from billing.usage import report as _report
from billing.usage import run_session as _run_session

__all__ = [
    "Allowance",
    "DataFileError",
    "LimitReached",
    "ModelPrice",
    "ModelUsage",
    "NoSubscription",
    "NoTokens",
    "Plan",
    "Prices",
    "ReportRow",
    "RunNotFound",
    "RunUsage",
    "Subscription",
    "SubscriptionEnded",
    "UnknownModel",
    "UnknownPlan",
    "check_limit",
    "check_model_price",
    "ensure_subscription",
    "prices",
    "record_runs",
    "recorded_run_ids",
    "report",
    "run_session",
    "set_plan",
    "validate_data",
]


def validate_data() -> None:
    """Read and check the plans and prices files; a broken file raises DataFileError naming the file and field."""
    _plans()
    prices()


def check_model_price(model: str) -> ModelPrice:
    """The price of the model; UnknownModel when the prices file has none."""
    return prices().get(model)


def ensure_subscription(user_id: uuid.UUID, created_at: datetime) -> Subscription | None:
    """Give a user without any subscription one to the plan of new accounts, its period from `created_at`.

    A user who has a subscription, active or ended, keeps it unchanged and gets None.
    """
    with get_engine().begin() as connection:
        return _ensure_signup_subscription(connection, user_id, created_at)


def recorded_run_ids(run_ids: Sequence[str]) -> set[str]:
    """Which of these runs are in the journal already."""
    with get_engine().begin() as connection:
        return _recorded_run_ids(connection, list(run_ids))


def record_runs(user_id: uuid.UUID, runs: Sequence[RunUsage], at: datetime) -> int:
    """Write the runs under the user's current subscription in one transaction; repeats add nothing.

    Returns the number of rows written. Any refused run keeps none of them.
    """
    with get_engine().begin() as connection:
        return sum(_record_run(connection, user_id, run, at) for run in runs)


def check_limit(user_id: uuid.UUID, at: datetime) -> Allowance:
    """The user's current subscription and spending; LimitReached at or over the limit of the plan.

    A granted subscription whose period is over moves forward first, and that is kept even when the limit is reached.
    """
    with get_engine().connect() as connection:
        try:
            allowance = _check_limit(connection, user_id, at)
        except LimitReached:
            connection.commit()
            raise
        connection.commit()
        return allowance


def run_session(user_id: uuid.UUID, run_id: str, agent_id: str) -> str:
    """The conversation of a run of this agent by this user; RunNotFound for a run of anyone else or no run."""
    with get_engine().begin() as connection:
        return _run_session(connection, user_id, run_id, agent_id)


def report(user_ids: Sequence[uuid.UUID], at: datetime) -> list[ReportRow]:
    """Spending of these users in their current periods, in the given order; no e-mail, only identifiers."""
    with get_engine().begin() as connection:
        return _report(connection, list(user_ids), at)


def set_plan(user_id: uuid.UUID, plan: str) -> Subscription:
    """Change the plan of the active subscription; the period and the spending in it stay."""
    with get_engine().begin() as connection:
        return _set_plan(connection, user_id, plan)

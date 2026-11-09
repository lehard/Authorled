"""Subscriptions of users to plans and their periods (openspec/specs/billing/subscriptions).

A user has exactly one active subscription. Periods are `[period_start, period_end)`; each ends a whole number of
months after `started_at`, the day of the month pressed to the last day of a short month. A granted subscription
moves to its next period by itself, lazily, when it is read after its end; other sources are renewed only by their
own operation (payments-tochka), so an ended period of theirs is an explicit error here.
All operations run in the caller's transaction.
"""

import calendar
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime

from sqlalchemy import Connection, Row, func, insert, select, update

from billing.plans import plans
from billing.tables import SUBSCRIPTION_SOURCES, subscriptions


class NoSubscription(Exception):
    """The user has no active subscription."""


@dataclass(frozen=True)
class Subscription:
    id: uuid.UUID
    user_id: uuid.UUID
    plan: str
    source: str
    status: str
    started_at: datetime
    period_start: datetime
    period_end: datetime


class SubscriptionEnded(Exception):
    """The period of a subscription that does not renew by itself is over; nothing was changed in the database."""

    def __init__(self, subscription: Subscription) -> None:
        super().__init__(
            f"Subscription {subscription.id} of source {subscription.source!r} on plan {subscription.plan!r} "
            f"ended at {subscription.period_end.isoformat()}"
        )
        self.subscription = subscription


def _aware(moment: datetime, name: str) -> datetime:
    if moment.tzinfo is None:
        raise ValueError(f"{name} must carry a time zone")
    return moment.astimezone(UTC)


def add_months(moment: datetime, months: int, anchor: datetime) -> datetime:
    """`moment` plus whole months, on the day and time of `anchor`; a short month takes its last day."""
    moment, anchor = _aware(moment, "moment"), _aware(anchor, "anchor")
    index = moment.month - 1 + months
    year, month = moment.year + index // 12, index % 12 + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return anchor.replace(year=year, month=month, day=day)


def _subscription(row: Row) -> Subscription:
    return Subscription(
        id=row.id,
        user_id=row.user_id,
        plan=row.plan,
        source=row.source,
        status=row.status,
        started_at=row.started_at,
        period_start=row.period_start,
        period_end=row.period_end,
    )


def _active_row(connection: Connection, user_id: uuid.UUID) -> Row:
    row = connection.execute(
        select(subscriptions)
        .where(subscriptions.c.user_id == user_id, subscriptions.c.status == "active")
        .with_for_update()
    ).one_or_none()
    if row is None:
        raise NoSubscription(f"User {user_id} has no active subscription")
    return row


def _next_end(subscription: Subscription, period_end: datetime) -> datetime:
    return add_months(period_end, plans().get(subscription.plan).period_months, subscription.started_at)


def _move_period(connection: Connection, subscription: Subscription, start: datetime, end: datetime) -> Subscription:
    connection.execute(
        update(subscriptions)
        .where(subscriptions.c.id == subscription.id)
        .values(period_start=start, period_end=end, updated_at=func.now())
    )
    return replace(subscription, period_start=start, period_end=end)


def start_subscription(
    connection: Connection, user_id: uuid.UUID, plan: str, source: str, start: datetime
) -> Subscription:
    """End the active subscription of the user, if any, and start a new one with its first period from `start`."""
    if source not in SUBSCRIPTION_SOURCES:
        raise ValueError(f"Unknown subscription source {source!r}")
    start = _aware(start, "start")
    end = add_months(start, plans().get(plan).period_months, start)
    connection.execute(
        update(subscriptions)
        .where(subscriptions.c.user_id == user_id, subscriptions.c.status == "active")
        .values(status="ended", ended_at=start, updated_at=func.now())
    )
    row = connection.execute(
        insert(subscriptions)
        .values(
            user_id=user_id,
            plan=plan,
            source=source,
            status="active",
            started_at=start,
            period_start=start,
            period_end=end,
        )
        .returning(*subscriptions.c)
    ).one()
    return _subscription(row)


def ensure_signup_subscription(connection: Connection, user_id: uuid.UUID, created_at: datetime) -> Subscription | None:
    """Start a subscription to the plan of new accounts for a user who has none, active or ended; else change nothing.

    The period runs from the creation of the account. A transaction lock on the user serializes concurrent first
    sign-ins, so they create one subscription. Returns the new subscription, or None when the user had one.
    """
    connection.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(str(user_id), 0))))
    known = connection.execute(select(subscriptions.c.id).where(subscriptions.c.user_id == user_id).limit(1)).first()
    if known is not None:
        return None
    return start_subscription(connection, user_id, plans().signup.code, "granted", created_at)


def current_subscription(connection: Connection, user_id: uuid.UUID, now: datetime) -> Subscription:
    """The active subscription with the period that contains `now`, locked for the caller's transaction.

    A granted subscription whose period is over moves forward until its period contains `now`.
    """
    now = _aware(now, "now")
    subscription = _subscription(_active_row(connection, user_id))
    plans().get(subscription.plan)
    if now < subscription.period_end:
        return subscription
    if subscription.source != "granted":
        raise SubscriptionEnded(subscription)
    start, end = subscription.period_start, subscription.period_end
    while now >= end:
        start, end = end, _next_end(subscription, end)
    return _move_period(connection, subscription, start, end)


def next_period(connection: Connection, subscription_id: uuid.UUID) -> Subscription:
    """Move the active subscription one period forward from the end of its current period."""
    row = connection.execute(
        select(subscriptions).where(subscriptions.c.id == subscription_id).with_for_update()
    ).one_or_none()
    if row is None or row.status != "active":
        raise NoSubscription(f"Subscription {subscription_id} is not active")
    subscription = _subscription(row)
    return _move_period(
        connection, subscription, subscription.period_end, _next_end(subscription, subscription.period_end)
    )


def set_plan(connection: Connection, user_id: uuid.UUID, plan: str) -> Subscription:
    """Change the plan of the active subscription; its period and the spending in it stay."""
    plans().get(plan)
    subscription = _subscription(_active_row(connection, user_id))
    connection.execute(
        update(subscriptions).where(subscriptions.c.id == subscription.id).values(plan=plan, updated_at=func.now())
    )
    return replace(subscription, plan=plan)

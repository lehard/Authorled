"""Subscriptions and their periods (openspec/specs/billing/subscriptions: «Подписка пользователя», «Продление выданной
подписки», «Смена тарифа», «Подписка при входе»; openspec/specs/billing/module, «Таблица подписок биллинга»)."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import Connection, func, insert, select, text, update
from sqlalchemy.exc import IntegrityError

from billing.plans import UnknownPlan
from billing.subscriptions import (
    NoSubscription,
    SubscriptionEnded,
    add_months,
    current_subscription,
    ensure_signup_subscription,
    next_period,
    set_plan,
    start_subscription,
)
from billing.tables import subscriptions


def _at(year: int, month: int, day: int, hour: int = 10) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _user(connection: Connection) -> uuid.UUID:
    """A user of the core is only an identifier to billing: no row of authorled.users is needed."""
    return uuid.uuid4()


def _count(connection: Connection, user_id: uuid.UUID) -> int:
    return connection.execute(
        select(func.count()).select_from(subscriptions).where(subscriptions.c.user_id == user_id)
    ).scalar_one()


def test_add_months_presses_the_day() -> None:
    start = _at(2027, 1, 31)
    ends = [start]
    for _ in range(3):
        ends.append(add_months(ends[-1], 1, start))
    assert ends[1:] == [_at(2027, 2, 28), _at(2027, 3, 31), _at(2027, 4, 30)]
    assert add_months(_at(2027, 11, 30), 3, start) == _at(2028, 2, 29)


def test_add_months_needs_a_time_zone() -> None:
    with pytest.raises(ValueError, match="time zone"):
        add_months(datetime(2027, 1, 1), 1, _at(2027, 1, 1))


def test_first_sign_in_gets_one_subscription(connection: Connection) -> None:
    user_id, created = _user(connection), _at(2027, 10, 7)
    started = ensure_signup_subscription(connection, user_id, created)
    assert ensure_signup_subscription(connection, user_id, _at(2027, 10, 8)) is None
    row = connection.execute(select(subscriptions).where(subscriptions.c.user_id == user_id)).one()
    assert started is not None and started.id == row.id
    assert (row.plan, row.source, row.status) == ("beta", "granted", "active")
    assert (row.started_at, row.period_start, row.period_end) == (created, created, _at(2027, 11, 7))


def test_sign_in_keeps_a_changed_plan(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    connection.execute(update(subscriptions).where(subscriptions.c.id == started.id).values(plan="beta-plus"))
    assert ensure_signup_subscription(connection, user_id, _at(2027, 1, 1)) is None
    row = connection.execute(select(subscriptions).where(subscriptions.c.user_id == user_id)).one()
    assert (row.plan, row.period_start, row.period_end) == ("beta-plus", _at(2027, 1, 1), _at(2027, 2, 1))


def test_sign_in_after_an_ended_subscription(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    connection.execute(
        update(subscriptions).where(subscriptions.c.id == started.id).values(status="ended", ended_at=_at(2027, 1, 5))
    )
    assert ensure_signup_subscription(connection, user_id, _at(2027, 1, 1)) is None
    assert _count(connection, user_id) == 1


def test_start_ends_the_previous(connection: Connection) -> None:
    user_id = _user(connection)
    first = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 31))
    second = start_subscription(connection, user_id, "beta", "granted", _at(2027, 2, 10))
    old = connection.execute(select(subscriptions).where(subscriptions.c.id == first.id)).one()
    assert (old.status, old.ended_at) == ("ended", _at(2027, 2, 10))
    assert (second.period_start, second.period_end) == (_at(2027, 2, 10), _at(2027, 3, 10))
    assert current_subscription(connection, user_id, _at(2027, 2, 11)).id == second.id


def test_period_inside_is_kept(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 11, 7))
    assert current_subscription(connection, user_id, _at(2027, 12, 7, 9)) == started


def test_granted_renews_at_the_end(connection: Connection) -> None:
    user_id = _user(connection)
    start_subscription(connection, user_id, "beta", "granted", _at(2027, 11, 7))
    renewed = current_subscription(connection, user_id, _at(2027, 12, 8))
    assert (renewed.period_start, renewed.period_end) == (_at(2027, 12, 7), _at(2028, 1, 7))
    stored = connection.execute(select(subscriptions).where(subscriptions.c.id == renewed.id)).one()
    assert (stored.period_start, stored.period_end) == (renewed.period_start, renewed.period_end)


def test_missed_months(connection: Connection) -> None:
    user_id = _user(connection)
    start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 31))
    now = _at(2027, 5, 2)
    renewed = current_subscription(connection, user_id, now)
    assert (renewed.period_start, renewed.period_end) == (_at(2027, 4, 30), _at(2027, 5, 31))
    assert renewed.period_start <= now < renewed.period_end
    assert _count(connection, user_id) == 1


def test_next_period(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 31))
    moved = next_period(connection, started.id)
    assert (moved.period_start, moved.period_end) == (_at(2027, 2, 28), _at(2027, 3, 31))


def test_no_subscription(connection: Connection) -> None:
    with pytest.raises(NoSubscription):
        current_subscription(connection, _user(connection), _at(2027, 1, 1))


def test_unknown_plan_of_a_subscription(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    connection.execute(update(subscriptions).where(subscriptions.c.id == started.id).values(plan="old"))
    with pytest.raises(UnknownPlan, match="'old'"):
        current_subscription(connection, user_id, _at(2027, 1, 2))


def test_set_plan_keeps_the_period(connection: Connection) -> None:
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    changed = set_plan(connection, user_id, "beta")
    assert (changed.id, changed.period_start, changed.period_end) == (
        started.id,
        started.period_start,
        started.period_end,
    )
    with pytest.raises(UnknownPlan, match="'pro'"):
        set_plan(connection, user_id, "pro")


def test_unknown_source() -> None:
    with pytest.raises(ValueError, match="'tochka'"):
        start_subscription(None, uuid.uuid4(), "beta", "tochka", _at(2027, 1, 1))  # type: ignore[arg-type]


def _row(user_id: uuid.UUID, **changes: object) -> dict[str, object]:
    return {
        "user_id": user_id,
        "plan": "beta",
        "source": "granted",
        "status": "active",
        "started_at": _at(2027, 1, 1),
        "period_start": _at(2027, 1, 1),
        "period_end": _at(2027, 2, 1),
        **changes,
    }


def test_one_active_per_user(connection: Connection) -> None:
    user_id = _user(connection)
    connection.execute(insert(subscriptions).values(_row(user_id)))
    connection.execute(insert(subscriptions).values(_row(user_id, status="ended", ended_at=_at(2027, 1, 2))))
    with pytest.raises(IntegrityError, match="ix_subscriptions_one_active"):
        connection.execute(insert(subscriptions).values(_row(user_id)))


@pytest.mark.parametrize(
    ("changes", "constraint"),
    [
        ({"period_end": _at(2026, 12, 1)}, "ck_subscriptions_period_forward"),
        ({"status": "ended"}, "ck_subscriptions_ended_at_when_ended"),
        ({"ended_at": _at(2027, 1, 2)}, "ck_subscriptions_ended_at_when_ended"),
        ({"source": "tochka"}, "ck_subscriptions_source_known"),
        ({"status": "paused"}, "ck_subscriptions_status_known"),
        ({"plan": ""}, "ck_subscriptions_plan_not_empty"),
    ],
)
def test_constraints(connection: Connection, changes: dict[str, object], constraint: str) -> None:
    with pytest.raises(IntegrityError, match=constraint):
        connection.execute(insert(subscriptions).values(_row(_user(connection), **changes)))


def test_no_key_leaves_schema_billing(connection: Connection) -> None:
    """The user of the core is kept by value (openspec/specs/billing/module, «Схема данных биллинга»)."""
    keys = connection.execute(
        text(
            "SELECT conname, confrelid::regclass::text FROM pg_constraint "
            "WHERE contype = 'f' AND connamespace = 'billing'::regnamespace"
        )
    ).all()
    assert [(name, target) for name, target in keys] == [
        ("fk_usage_records_subscription_id_subscriptions", "billing.subscriptions")
    ]


def test_other_source_does_not_renew_itself(connection: Connection) -> None:
    """A source of payments-tochka is not allowed yet; the check is lifted inside this rolled-back transaction."""
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    connection.execute(text("ALTER TABLE billing.subscriptions DROP CONSTRAINT ck_subscriptions_source_known"))
    connection.execute(update(subscriptions).where(subscriptions.c.id == started.id).values(source="tochka"))
    assert current_subscription(connection, user_id, _at(2027, 1, 15)).source == "tochka"
    with pytest.raises(SubscriptionEnded, match="'tochka'") as ended:
        current_subscription(connection, user_id, _at(2027, 2, 1))
    assert ended.value.subscription.id == started.id
    assert ended.value.subscription.period_end == _at(2027, 2, 1)
    stored = connection.execute(select(subscriptions).where(subscriptions.c.id == started.id)).one()
    assert (stored.period_start, stored.period_end, stored.status) == (_at(2027, 1, 1), _at(2027, 2, 1), "active")


def test_start_in_the_past_catches_up(connection: Connection) -> None:
    """Moving to the free plan from the end of a paid period months ago: periods follow until now, one row."""
    user_id = _user(connection)
    start_subscription(connection, user_id, "beta", "granted", _at(2027, 6, 1))
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 31))
    assert (started.period_start, started.period_end) == (_at(2027, 1, 31), _at(2027, 2, 28))
    current = current_subscription(connection, user_id, _at(2027, 6, 15))
    assert current.id == started.id
    assert (current.period_start, current.period_end) == (_at(2027, 5, 31), _at(2027, 6, 30))

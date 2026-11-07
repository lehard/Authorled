"""Subscriptions and their periods (openspec/specs/core/subscriptions: «Подписка пользователя», «Продление выданной
подписки», «Смена тарифа»; openspec/specs/core/database, «Таблица подписок»)."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import Connection, func, insert, select, text, update
from sqlalchemy.exc import IntegrityError

from core.plans import UnknownPlan
from core.subscriptions import (
    NoSubscription,
    SubscriptionEnded,
    add_months,
    current_subscription,
    next_period,
    set_plan,
    start_subscription,
)
from core.tables import subscriptions, users
from core.users import get_or_create_user


def _at(year: int, month: int, day: int, hour: int = 10) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _user(connection: Connection) -> uuid.UUID:
    subject = f"test-{uuid.uuid4()}"
    user_id: uuid.UUID = connection.execute(
        insert(users)
        .values(auth_subject=subject, email=f"{subject}@example.com", display_name="Автор")
        .returning(users.c.id)
    ).scalar_one()
    return user_id


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


def test_new_account_gets_one_subscription(connection: Connection) -> None:
    subject = f"test-{uuid.uuid4()}"
    account = get_or_create_user(connection, subject, "anna@example.com", "Анна")
    get_or_create_user(connection, subject, "anna@example.com", "Анна")
    row = connection.execute(select(subscriptions).where(subscriptions.c.user_id == account.id)).one()
    created = connection.execute(select(users.c.created_at).where(users.c.id == account.id)).scalar_one()
    assert (row.plan, row.source, row.status) == ("beta", "granted", "active")
    assert row.started_at == row.period_start == created
    assert row.period_end == add_months(created, 1, created)
    assert _count(connection, account.id) == 1


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


def test_user_with_a_subscription_cannot_be_deleted(connection: Connection) -> None:
    user_id = _user(connection)
    start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    with pytest.raises(IntegrityError, match="fk_subscriptions_user_id_users"):
        connection.execute(users.delete().where(users.c.id == user_id))


def test_other_source_does_not_renew_itself(connection: Connection) -> None:
    """A source of payments-tochka is not allowed yet; the check is lifted inside this rolled-back transaction."""
    user_id = _user(connection)
    started = start_subscription(connection, user_id, "beta", "granted", _at(2027, 1, 1))
    connection.execute(text("ALTER TABLE authorled.subscriptions DROP CONSTRAINT ck_subscriptions_source_known"))
    connection.execute(update(subscriptions).where(subscriptions.c.id == started.id).values(source="tochka"))
    assert current_subscription(connection, user_id, _at(2027, 1, 15)).source == "tochka"
    with pytest.raises(SubscriptionEnded, match="'tochka'"):
        current_subscription(connection, user_id, _at(2027, 2, 1))

"""The interface of the billing module on real transactions (openspec/specs/billing/module, «Интерфейс биллинга»;
openspec/specs/billing/subscriptions, «Подписка при входе»).

Each operation commits on its own, so these tests use fresh user identifiers instead of a rolled-back connection;
the test database is recreated by every run.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from threading import Barrier

import pytest
from sqlalchemy import Engine, Table, func, select, update

import billing
from billing.tables import subscriptions, usage_records

START = datetime(2027, 11, 7, 10, tzinfo=UTC)
NOW = START + timedelta(days=3)


def _run(
    run_id: str, model: str = "deepseek-fast", output_tokens: int = 2_000, occurred_at: datetime = NOW
) -> billing.RunUsage:
    return billing.RunUsage(
        run_id=run_id,
        session_id="p:d:c",
        agent_id="coauthor",
        status="completed",
        occurred_at=occurred_at,
        models=(billing.ModelUsage(model, 10_000, 4_000, output_tokens, None),),
    )


def _count(engine: Engine, table: Table, user_id: uuid.UUID) -> int:
    with engine.connect() as connection:
        count: int = connection.execute(
            select(func.count()).select_from(table).where(table.c.user_id == user_id)
        ).scalar_one()
        return count


def test_ensure_once(engine: Engine) -> None:
    user_id = uuid.uuid4()
    started = billing.ensure_subscription(user_id, START)
    assert started is not None
    assert (started.plan, started.period_start, started.period_end) == (
        "beta",
        START,
        datetime(2027, 12, 7, 10, tzinfo=UTC),
    )
    assert billing.ensure_subscription(user_id, START) is None
    assert _count(engine, subscriptions, user_id) == 1


def test_concurrent_first_sign_ins_give_one_subscription(engine: Engine) -> None:
    user_id = uuid.uuid4()
    barrier = Barrier(4)

    def sign_in() -> billing.Subscription | None:
        barrier.wait()
        return billing.ensure_subscription(user_id, START)

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: sign_in(), range(4)))
    assert sum(result is not None for result in results) == 1
    assert _count(engine, subscriptions, user_id) == 1


def test_record_runs_keeps_none_on_a_refused_run(engine: Engine) -> None:
    user_id = uuid.uuid4()
    billing.ensure_subscription(user_id, START)
    with pytest.raises(billing.UnknownModel, match="'gpt-4o'"):
        billing.record_runs(user_id, [_run(f"ok-{user_id}"), _run(f"bad-{user_id}", model="gpt-4o")], NOW)
    assert _count(engine, usage_records, user_id) == 0
    assert billing.record_runs(user_id, [_run(f"ok-{user_id}")], NOW) == 1
    assert billing.record_runs(user_id, [_run(f"ok-{user_id}")], NOW) == 0
    assert billing.recorded_run_ids([f"ok-{user_id}", f"bad-{user_id}"]) == {f"ok-{user_id}"}


def test_limit_reached_keeps_the_renewed_period(engine: Engine) -> None:
    user_id = uuid.uuid4()
    billing.ensure_subscription(user_id, START)
    # 4 166 667 output tokens of deepseek-fast cost 500 RUB and more: the limit of beta.
    later = START + timedelta(days=40)
    billing.record_runs(user_id, [_run(f"big-{user_id}", output_tokens=4_166_667, occurred_at=later)], later)
    with pytest.raises(billing.LimitReached) as reached:
        billing.check_limit(user_id, later)
    assert reached.value.renews_at == datetime(2028, 1, 7, 10, tzinfo=UTC)
    with engine.connect() as connection:
        stored = connection.execute(select(subscriptions.c.period_start).where(subscriptions.c.user_id == user_id))
        assert stored.scalar_one() == datetime(2027, 12, 7, 10, tzinfo=UTC)


def test_check_limit_without_subscription() -> None:
    with pytest.raises(billing.NoSubscription):
        billing.check_limit(uuid.uuid4(), NOW)


def test_storage_limit_of_beta(engine: Engine) -> None:
    user_id = uuid.uuid4()
    billing.ensure_subscription(user_id, START)
    later = START + timedelta(days=40)
    assert billing.storage_limit(user_id, later) == 524_288_000
    with engine.connect() as connection:
        stored = connection.execute(select(subscriptions.c.period_start).where(subscriptions.c.user_id == user_id))
        assert stored.scalar_one() == datetime(2027, 12, 7, 10, tzinfo=UTC)


def test_storage_limit_without_subscription() -> None:
    with pytest.raises(billing.NoSubscription):
        billing.storage_limit(uuid.uuid4(), NOW)


def test_report_names_users_by_identifier() -> None:
    user_id = uuid.uuid4()
    billing.ensure_subscription(user_id, START)
    billing.record_runs(user_id, [_run(f"rep-{user_id}")], NOW)
    (row,) = billing.report([user_id], NOW)
    assert row.user_id == user_id
    assert not hasattr(row, "email")
    assert (row.runs, row.spent_rub) == (1, Decimal("0.4224"))


def test_run_session_of_someone_else() -> None:
    owner, other = uuid.uuid4(), uuid.uuid4()
    billing.ensure_subscription(owner, START)
    billing.record_runs(owner, [_run(f"own-{owner}")], NOW)
    assert billing.run_session(owner, f"own-{owner}", "coauthor") == "p:d:c"
    with pytest.raises(billing.RunNotFound):
        billing.run_session(other, f"own-{owner}", "coauthor")


def test_set_plan(engine: Engine) -> None:
    user_id = uuid.uuid4()
    started = billing.ensure_subscription(user_id, START)
    assert started is not None
    changed = billing.set_plan(user_id, "beta")
    assert (changed.id, changed.period_end) == (started.id, started.period_end)
    with pytest.raises(billing.UnknownPlan, match="'pro'"):
        billing.set_plan(user_id, "pro")
    with engine.begin() as connection:
        connection.execute(update(subscriptions).where(subscriptions.c.user_id == user_id).values(plan="beta"))

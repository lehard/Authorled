"""The usage journal, the limit and the administrator's commands (openspec/specs/core/subscriptions: «Журнал расхода
соавтора», «Проверка лимита до запуска», «Смена тарифа», «Команды администратора»; openspec/specs/core/database,
«Таблица журнала расхода»)."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Connection, insert, select, update
from sqlalchemy.exc import IntegrityError

from admin.__main__ import main as admin_main
from core import plans as plans_module
from core.plans import UnknownModel
from core.subscriptions import NoSubscription, set_plan, start_subscription
from core.tables import subscriptions, usage_records, users
from core.usage import (
    LimitReached,
    ModelUsage,
    NoTokens,
    RunUsage,
    check_limit,
    period_spend,
    record_run,
    recorded_run_ids,
    report,
    user_id_by_email,
)
from core.users import AccountNotFound

START = datetime(2027, 11, 7, 10, tzinfo=UTC)
NOW = START + timedelta(days=3)


@pytest.fixture
def plans_with_plus(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """The plans file of the release plus beta-plus with a larger limit."""
    path = tmp_path / "plans.toml"
    path.write_text(
        plans_module.PLANS_FILE.read_text(encoding="utf-8")
        + '\n[plans.beta-plus]\nname = "Бета+"\nprice_rub = 0\nperiod_months = 1\n'
        + "limit_rub = 1500\npurchasable = false\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(plans_module, "PLANS_FILE", path)
    plans_module.plans.cache_clear()
    yield
    plans_module.plans.cache_clear()


def _author(connection: Connection, email: str | None = None) -> tuple[str, uuid.UUID]:
    subject = f"test-{uuid.uuid4()}"
    user_id: uuid.UUID = connection.execute(
        insert(users)
        .values(auth_subject=subject, email=email or f"{subject}@example.com", display_name="Автор")
        .returning(users.c.id)
    ).scalar_one()
    start_subscription(connection, user_id, "beta", "granted", START)
    return subject, user_id


def _run(
    run_id: str | None = None,
    occurred_at: datetime = NOW,
    input_tokens: int = 10_000,
    cache_read_tokens: int = 4_000,
    output_tokens: int = 2_000,
    model: str = "deepseek-fast",
) -> RunUsage:
    return RunUsage(
        run_id=run_id or str(uuid.uuid4()),
        session_id="p:d:c",
        agent_id="coauthor",
        status="completed",
        occurred_at=occurred_at,
        models=(ModelUsage(model, input_tokens, cache_read_tokens, output_tokens, Decimal("0.0045")),),
    )


def _rows(connection: Connection, user_id: uuid.UUID) -> list[Any]:
    return list(connection.execute(select(usage_records).where(usage_records.c.user_id == user_id)).all())


def test_record_once(connection: Connection) -> None:
    subject, user_id = _author(connection)
    run = _run("r-once")
    assert record_run(connection, subject, run, NOW) == 1
    assert record_run(connection, subject, run, NOW) == 0
    (row,) = _rows(connection, user_id)
    assert (row.run_id, row.model, row.run_status) == ("r-once", "deepseek-fast", "completed")
    assert (row.input_tokens, row.cache_read_tokens, row.output_tokens) == (10_000, 4_000, 2_000)
    assert row.cost_rub == Decimal("0.422400")
    assert row.provider_cost_usd == Decimal("0.004500")
    assert recorded_run_ids(connection, ["r-once", "r-other"]) == {"r-once"}


def test_run_without_tokens(connection: Connection) -> None:
    subject, _ = _author(connection)
    run = RunUsage("r1", "p:d:c", "coauthor", "completed", NOW, ())
    with pytest.raises(NoTokens):
        record_run(connection, subject, run, NOW)


def test_model_without_price(connection: Connection) -> None:
    subject, user_id = _author(connection)
    with pytest.raises(UnknownModel, match="'gpt-4o'"):
        record_run(connection, subject, _run(model="gpt-4o"), NOW)
    assert _rows(connection, user_id) == []


def test_unknown_account(connection: Connection) -> None:
    with pytest.raises(AccountNotFound):
        record_run(connection, "nobody", _run(), NOW)


def test_spend_of_the_period(connection: Connection) -> None:
    subject, user_id = _author(connection)
    record_run(connection, subject, _run(occurred_at=START - timedelta(minutes=1)), NOW)
    record_run(connection, subject, _run(occurred_at=START), NOW)
    record_run(connection, subject, _run(occurred_at=NOW), NOW)
    allowance = check_limit(connection, subject, NOW)
    assert allowance.spent == period_spend(connection, allowance.subscription) == Decimal("0.8448")
    assert allowance.plan.limit_rub == Decimal(500)


def test_limit_reached(connection: Connection) -> None:
    subject, _ = _author(connection)
    # 500 RUB of output at 120 RUB per million.
    record_run(connection, subject, _run(input_tokens=0, cache_read_tokens=0, output_tokens=4_166_667), NOW)
    with pytest.raises(LimitReached) as reached:
        check_limit(connection, subject, NOW)
    assert reached.value.renews_at == datetime(2027, 12, 7, 10, tzinfo=UTC)
    assert reached.value.spent >= reached.value.limit == Decimal(500)


def test_new_period_starts_from_zero(connection: Connection) -> None:
    subject, _ = _author(connection)
    record_run(connection, subject, _run(input_tokens=0, cache_read_tokens=0, output_tokens=4_166_667), NOW)
    later = datetime(2027, 12, 8, tzinfo=UTC)
    allowance = check_limit(connection, subject, later)
    assert allowance.spent == 0
    assert allowance.subscription.period_start == datetime(2027, 12, 7, 10, tzinfo=UTC)


def test_new_plan_limit_applies_at_once(connection: Connection, plans_with_plus: None) -> None:
    subject, user_id = _author(connection)
    record_run(connection, subject, _run(input_tokens=0, cache_read_tokens=0, output_tokens=4_166_667), NOW)
    with pytest.raises(LimitReached):
        check_limit(connection, subject, NOW)
    set_plan(connection, user_id, "beta-plus")
    allowance = check_limit(connection, subject, NOW)
    assert allowance.plan.code == "beta-plus"
    assert allowance.spent > Decimal(500)
    assert allowance.subscription.period_start == START


def test_limit_without_subscription(connection: Connection) -> None:
    subject, user_id = _author(connection)
    connection.execute(
        update(subscriptions).where(subscriptions.c.user_id == user_id).values(status="ended", ended_at=NOW)
    )
    with pytest.raises(NoSubscription):
        check_limit(connection, subject, NOW)


def test_report(connection: Connection) -> None:
    subject, _ = _author(connection, email="report@example.com")
    record_run(connection, subject, _run(), NOW)
    record_run(connection, subject, _run(), NOW)
    record_run(connection, subject, _run(occurred_at=START - timedelta(days=1)), NOW)
    (row,) = [row for row in report(connection, NOW) if row.email == "report@example.com"]
    assert (row.plan, row.runs, row.period_start) == ("beta", 2, START)
    assert (row.input_tokens, row.cache_read_tokens, row.output_tokens) == (20_000, 8_000, 4_000)
    assert row.spent_rub == Decimal("0.8448")
    assert row.remaining_rub == Decimal(500) - Decimal("0.8448")
    assert row.provider_cost_usd == Decimal("0.009")


def test_user_by_email(connection: Connection) -> None:
    _, user_id = _author(connection, email="one@example.com")
    assert user_id_by_email(connection, "one@example.com") == user_id
    with pytest.raises(LookupError, match="found 0"):
        user_id_by_email(connection, "nobody@example.com")
    _author(connection, email="one@example.com")
    with pytest.raises(LookupError, match="found 2"):
        user_id_by_email(connection, "one@example.com")


def test_set_plan_command_refuses_unknown_email(capsys: pytest.CaptureFixture[str]) -> None:
    assert admin_main(["set-plan", "nobody@example.com", "beta"]) == 1
    assert "nobody@example.com" in capsys.readouterr().err


def test_repeat_run_and_model_is_refused(connection: Connection) -> None:
    subject, user_id = _author(connection)
    record_run(connection, subject, _run("r-dup"), NOW)
    (row,) = _rows(connection, user_id)
    values = {column: getattr(row, column) for column in row._fields if column not in ("id", "created_at")}
    with pytest.raises(IntegrityError, match="uq_usage_records_run_id_model"):
        connection.execute(insert(usage_records).values(values))


def test_cache_over_input_is_refused(connection: Connection) -> None:
    subject, user_id = _author(connection)
    record_run(connection, subject, _run("r-cache"), NOW)
    with pytest.raises(IntegrityError, match="ck_usage_records_tokens_valid"):
        connection.execute(
            update(usage_records).where(usage_records.c.run_id == "r-cache").values(cache_read_tokens=10_001)
        )


def test_user_with_usage_cannot_drop_subscription(connection: Connection) -> None:
    subject, user_id = _author(connection)
    record_run(connection, subject, _run(), NOW)
    with pytest.raises(IntegrityError, match="fk_usage_records_subscription_id_subscriptions"):
        connection.execute(subscriptions.delete().where(subscriptions.c.user_id == user_id))

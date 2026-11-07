"""Paid plans through Tochka in the core (openspec/specs/api/billing; openspec/specs/core/database, «Таблица
оформлений оплаты», «Таблица платежей»).

Real PostgreSQL; Tochka is replaced (tests/billing_fake.py), plans `pro` and `max` exist only in these tests.
"""

import threading
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Connection, Engine, delete, insert, select, text, update
from sqlalchemy.exc import IntegrityError, OperationalError

from core import plans as plans_module
from core.billing import billing_state, cancel, check_payment, check_plans, checkout, confirm_operation
from core.errors import Conflict, Invalid
from core.subscriptions import start_subscription
from core.tables import billing_checkouts, payments, subscriptions, usage_records, users
from core.tochka import TochkaUnavailable
from tests.billing_fake import PRO, FakeTochka, paid_plans

__all__ = ["paid_plans"]

pytestmark = pytest.mark.usefixtures("paid_plans")

T0 = datetime(2027, 1, 1, 10, tzinfo=UTC)


def _at(month: int, day: int, hour: int = 10, year: int = 2027) -> datetime:
    return datetime(year, month, day, hour, tzinfo=UTC)


def _user(connection: Connection) -> uuid.UUID:
    subject = f"test-{uuid.uuid4()}"
    user_id: uuid.UUID = connection.execute(
        insert(users)
        .values(auth_subject=subject, email=f"{subject}@example.com", display_name="Автор")
        .returning(users.c.id)
    ).scalar_one()
    start_subscription(connection, user_id, "beta", "granted", T0)
    return user_id


def _active(connection: Connection, user_id: uuid.UUID):  # type: ignore[no-untyped-def]
    return connection.execute(
        select(subscriptions).where(subscriptions.c.user_id == user_id, subscriptions.c.status == "active")
    ).one()


def _checkout_row(connection: Connection, user_id: uuid.UUID):  # type: ignore[no-untyped-def]
    return connection.execute(
        select(billing_checkouts).where(billing_checkouts.c.user_id == user_id).order_by(billing_checkouts.c.created_at)
    ).all()[-1]


def _payments(connection: Connection, user_id: uuid.UUID) -> list[Any]:
    return list(
        connection.execute(select(payments).where(payments.c.user_id == user_id).order_by(payments.c.paid_at)).all()
    )


@pytest.fixture
def tochka() -> FakeTochka:
    return FakeTochka()


def _paid(connection: Connection, tochka: FakeTochka, at: datetime = _at(1, 5)) -> tuple[uuid.UUID, str]:
    """A user who bought `pro` at `at`; the operation id of the subscription in Tochka."""
    user_id = _user(connection)
    checkout(connection, user_id, "pro", at - timedelta(minutes=5), tochka)
    operation_id = _checkout_row(connection, user_id).operation_id
    tochka.charge(operation_id, at)
    assert confirm_operation(connection, operation_id, tochka) == 1
    return user_id, operation_id


# Plans


def test_release_plans_fit_tochka() -> None:
    check_plans()


@pytest.mark.parametrize(
    ("pro", "message"),
    [
        ("price_rub = 490\nperiod_months = 3", "period_months must be 1"),
        ("price_rub = 490.005\nperiod_months = 1", "price_rub must be above 0"),
        ("price_rub = 0\nperiod_months = 1", "price_rub must be above 0"),
    ],
)
def test_plans_for_sale_are_checked(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, pro: str, message: str) -> None:
    file = tmp_path / "wrong.toml"
    file.write_text(
        'signup_plan = "beta"\n[plans.beta]\nname = "Бета"\nprice_rub = 0\nperiod_months = 1\nlimit_rub = 500\n'
        f'purchasable = false\n[plans.pro]\nname = "Про"\n{pro}\nlimit_rub = 2000\npurchasable = true\n'
    )
    monkeypatch.setattr(plans_module, "PLANS_FILE", file)
    plans_module.plans.cache_clear()
    with pytest.raises(RuntimeError, match=message):
        check_plans()


# Checkout


def test_checkout_gives_a_link_and_keeps_the_plan(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    link = checkout(connection, user_id, "pro", _at(1, 5), tochka)
    [created] = tochka.created
    row = _checkout_row(connection, user_id)
    assert link == row.payment_link and link.startswith("https://merch.example.com/")
    assert created == {
        "payment_link_id": str(row.id),
        "purpose": "CoAuthor, тариф «Про», 1 месяц",
        "item_name": "CoAuthor, тариф «Про», 1 месяц",
        "amount": PRO,
        "email": connection.execute(select(users.c.email).where(users.c.id == user_id)).scalar_one(),
    }
    assert (row.status, row.amount_rub, row.subscription_id) == ("created", PRO, None)
    assert _active(connection, user_id).plan == "beta"
    state = billing_state(connection, user_id, _at(1, 5), tochka)
    assert (state.plan.code, state.state, state.payment_link, state.checkout_plan) == ("beta", "pending", link, "pro")
    assert state.next_charge_at is None


def test_checkout_again_reuses_the_link(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    first = checkout(connection, user_id, "pro", _at(1, 5), tochka)
    assert checkout(connection, user_id, "pro", _at(1, 6), tochka) == first
    assert len(tochka.created) == 1


def test_checkout_after_the_link_expired(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    first = checkout(connection, user_id, "pro", _at(1, 5), tochka)
    second = checkout(connection, user_id, "pro", _at(1, 13), tochka)
    assert second != first and len(tochka.created) == 2
    statuses = connection.execute(
        select(billing_checkouts.c.status).where(billing_checkouts.c.user_id == user_id)
    ).scalars()
    assert sorted(statuses) == ["created", "expired"]


def test_checkout_of_another_plan_replaces_the_open_one(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    checkout(connection, user_id, "max", _at(1, 5, 11), tochka)
    assert tochka.created[1]["amount"] == Decimal("990.50")
    assert billing_state(connection, user_id, _at(1, 5, 12), tochka).checkout_plan == "max"


@pytest.mark.parametrize("plan", ["beta", "nothing"])
def test_plan_that_cannot_be_bought(connection: Connection, tochka: FakeTochka, plan: str) -> None:
    with pytest.raises(Invalid) as refused:
        checkout(connection, _user(connection), plan, _at(1, 5), tochka)
    assert refused.value.field == "plan"
    assert tochka.created == []


def test_checkout_when_already_paid(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    with pytest.raises(Conflict):
        checkout(connection, user_id, "max", _at(1, 10), tochka)


def test_checkout_when_tochka_is_down(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    tochka.unavailable = True
    with pytest.raises(TochkaUnavailable):
        checkout(connection, user_id, "pro", _at(1, 5), tochka)
    assert connection.execute(select(billing_checkouts).where(billing_checkouts.c.user_id == user_id)).all() == []


# Confirmation


def test_first_payment(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka, _at(1, 5, 12))
    active = _active(connection, user_id)
    assert (active.plan, active.source, active.period_start, active.period_end) == (
        "pro",
        "tochka",
        _at(1, 5, 12),
        _at(2, 5, 12),
    )
    [payment] = _payments(connection, user_id)
    assert (payment.operation_id, payment.amount_rub, payment.period_start, payment.period_end) == (
        operation_id,
        PRO,
        _at(1, 5, 12),
        _at(2, 5, 12),
    )
    state = billing_state(connection, user_id, _at(1, 6), tochka)
    assert (state.plan.code, state.source, state.state, state.next_charge_at) == (
        "pro",
        "tochka",
        "active",
        _at(2, 5, 12),
    )
    assert [line.amount_rub for line in state.payments] == [PRO]
    assert state.plan.limit_rub == Decimal(2000)


def test_spending_of_the_free_period_does_not_count_against_the_paid_one(
    connection: Connection, tochka: FakeTochka
) -> None:
    user_id = _user(connection)
    beta = _active(connection, user_id)
    connection.execute(
        insert(usage_records).values(
            user_id=user_id,
            subscription_id=beta.id,
            run_id="run-1",
            session_id="s",
            agent_id="coauthor",
            model="deepseek-fast",
            run_status="completed",
            input_tokens=10,
            cache_read_tokens=0,
            output_tokens=10,
            cost_rub=Decimal(450),
            occurred_at=_at(1, 2),
        )
    )
    assert billing_state(connection, user_id, _at(1, 3), tochka).used_percent == 90
    checkout(connection, user_id, "pro", _at(1, 4), tochka)
    tochka.charge(_checkout_row(connection, user_id).operation_id, _at(1, 5))
    confirm_operation(connection, _checkout_row(connection, user_id).operation_id, tochka)
    state = billing_state(connection, user_id, _at(1, 6), tochka)
    assert (state.spent_rub, state.used_percent) == (Decimal(0), 0)


def test_repeated_confirmation_counts_once(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    assert confirm_operation(connection, operation_id, tochka) == 0
    check_payment(connection, user_id, _at(1, 6), tochka)
    assert len(_payments(connection, user_id)) == 1
    assert _active(connection, user_id).period_end == _at(2, 5)


def test_payment_table_refuses_a_repeated_charge(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    [payment] = _payments(connection, user_id)
    values = {key: value for key, value in payment._mapping.items() if key not in ("id", "created_at")}
    with pytest.raises(IntegrityError, match="uq_payments_operation_id_order_id"):
        connection.execute(insert(payments).values(values))


def test_unpaid_operation_changes_nothing(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    assert confirm_operation(connection, _checkout_row(connection, user_id).operation_id, tochka) == 0
    assert _active(connection, user_id).plan == "beta"


@pytest.mark.parametrize(
    "change",
    [
        {"customer_code": "300123123"},
        {"payment_link_id": "12345-ab-cd"},
        {"payment_link_id": None},
        {"payment_link_id": str(uuid.uuid4())},
        {"amount": Decimal(1)},
        {"orders": ()},
        {"status": "REFUNDED"},
    ],
)
def test_operation_that_does_not_pay_changes_nothing(
    connection: Connection, tochka: FakeTochka, change: dict[str, object], caplog: pytest.LogCaptureFixture
) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    operation_id = _checkout_row(connection, user_id).operation_id
    tochka.charge(operation_id, _at(1, 5, 11))
    tochka.set(operation_id, **change)
    assert confirm_operation(connection, operation_id, tochka) == 0
    assert _active(connection, user_id).plan == "beta"
    assert _payments(connection, user_id) == []
    assert operation_id in caplog.text


def test_charge_of_another_amount_changes_nothing(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    operation_id = _checkout_row(connection, user_id).operation_id
    tochka.charge(operation_id, _at(1, 5, 11), amount=Decimal(1))
    assert confirm_operation(connection, operation_id, tochka) == 0
    assert _active(connection, user_id).plan == "beta"


# Monthly charges


def test_charge_on_time_renews_from_the_end(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    tochka.charge(operation_id, _at(2, 5, 9))
    assert confirm_operation(connection, operation_id, tochka) == 1
    active = _active(connection, user_id)
    assert (active.period_start, active.period_end) == (_at(2, 5), _at(3, 5))
    assert len(_payments(connection, user_id)) == 2


def test_charge_as_a_new_operation(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    renewal = tochka.renewal_as_new_operation(operation_id, _at(2, 5, 9))
    assert confirm_operation(connection, renewal, tochka) == 1
    assert _active(connection, user_id).period_end == _at(3, 5)


def test_charge_found_at_the_end_of_the_period(connection: Connection, tochka: FakeTochka) -> None:
    """The notice was lost: the first reading after the end asks Tochka and finds the charge."""
    user_id, operation_id = _paid(connection, tochka)
    tochka.charge(operation_id, _at(2, 5, 9))
    state = billing_state(connection, user_id, _at(2, 6), tochka)
    assert (state.plan.code, state.state, state.period_end) == ("pro", "active", _at(3, 5))


def test_failed_charge(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    tochka.fail_charges(operation_id)
    state = billing_state(connection, user_id, _at(2, 7), tochka)
    assert (state.plan.code, state.source, state.state, state.checkout_plan) == ("beta", "granted", "failed", "pro")
    active = _active(connection, user_id)
    # The free plan starts where the paid period ended and catches up with today.
    assert (active.started_at, active.period_start, active.period_end) == (_at(2, 5), _at(2, 5), _at(3, 5))
    assert _checkout_row(connection, user_id).status == "failed"


def test_late_charge_after_the_failure(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    billing_state(connection, user_id, _at(2, 7), tochka)
    tochka.charge(operation_id, _at(2, 8))
    assert confirm_operation(connection, operation_id, tochka) == 1
    active = _active(connection, user_id)
    assert (active.plan, active.source, active.period_start, active.period_end) == (
        "pro",
        "tochka",
        _at(2, 8),
        _at(3, 8),
    )
    assert billing_state(connection, user_id, _at(2, 9), tochka).state == "active"


def test_tochka_down_at_the_end_changes_nothing(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    tochka.unavailable = True
    with pytest.raises(TochkaUnavailable):
        billing_state(connection, user_id, _at(2, 7), tochka)
    assert (_active(connection, user_id).plan, _checkout_row(connection, user_id).status) == ("pro", "active")


def test_pay_again_cancels_the_old_subscription(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    tochka.fail_charges(operation_id, "PastDue")
    billing_state(connection, user_id, _at(2, 7), tochka)
    link = checkout(connection, user_id, "pro", _at(2, 8), tochka)
    assert tochka.cancelled == [operation_id]
    assert link == _checkout_row(connection, user_id).payment_link
    assert billing_state(connection, user_id, _at(2, 8), tochka).state == "pending"


def test_pay_again_when_tochka_ended_the_old_one(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    tochka.fail_charges(operation_id, "Failed")
    billing_state(connection, user_id, _at(2, 7), tochka)
    checkout(connection, user_id, "pro", _at(2, 8), tochka)
    assert (tochka.status_asked, tochka.cancelled) == ([operation_id], [])


# Cancellation


def test_cancel_keeps_the_plan_to_the_end(connection: Connection, tochka: FakeTochka) -> None:
    user_id, operation_id = _paid(connection, tochka)
    cancel(connection, user_id, _at(1, 10), tochka)
    assert tochka.cancelled == [operation_id]
    state = billing_state(connection, user_id, _at(1, 11), tochka)
    assert (state.plan.code, state.state, state.period_end, state.next_charge_at) == (
        "pro",
        "cancelled",
        _at(2, 5),
        None,
    )


def test_after_a_cancelled_period(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    cancel(connection, user_id, _at(1, 10), tochka)
    state = billing_state(connection, user_id, _at(3, 20), tochka)
    assert (state.plan.code, state.source, state.state) == ("beta", "granted", "none")
    active = _active(connection, user_id)
    assert (active.started_at, active.period_start, active.period_end) == (_at(2, 5), _at(3, 5), _at(4, 5))
    assert state.plan.limit_rub == Decimal(500)


def test_cancel_without_a_paid_subscription(connection: Connection, tochka: FakeTochka) -> None:
    with pytest.raises(Conflict):
        cancel(connection, _user(connection), _at(1, 10), tochka)


def test_cancel_twice(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    cancel(connection, user_id, _at(1, 10), tochka)
    with pytest.raises(Conflict):
        cancel(connection, user_id, _at(1, 11), tochka)


def test_cancel_not_confirmed_by_tochka(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    tochka.unavailable = True
    with pytest.raises(TochkaUnavailable):
        cancel(connection, user_id, _at(1, 10), tochka)
    assert _checkout_row(connection, user_id).status == "active"


def test_resubscribe_after_cancelling(connection: Connection, tochka: FakeTochka) -> None:
    user_id, _ = _paid(connection, tochka)
    cancel(connection, user_id, _at(1, 10), tochka)
    checkout(connection, user_id, "max", _at(1, 11), tochka)
    tochka.charge(_checkout_row(connection, user_id).operation_id, _at(1, 12))
    confirm_operation(connection, _checkout_row(connection, user_id).operation_id, tochka)
    active = _active(connection, user_id)
    assert (active.plan, active.period_start) == ("max", _at(1, 12))


# Return from the payment page


def test_check_after_the_return(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    tochka.charge(_checkout_row(connection, user_id).operation_id, _at(1, 5, 11))
    check_payment(connection, user_id, _at(1, 5, 11), tochka)
    assert billing_state(connection, user_id, _at(1, 5, 12), tochka).state == "active"


def test_check_of_an_expired_link(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    tochka.set(_checkout_row(connection, user_id).operation_id, status="EXPIRED")
    check_payment(connection, user_id, _at(1, 6), tochka)
    assert _checkout_row(connection, user_id).status == "expired"
    assert billing_state(connection, user_id, _at(1, 6), tochka).state == "none"


def test_check_without_a_checkout_does_not_ask_tochka(connection: Connection, tochka: FakeTochka) -> None:
    tochka.unavailable = True
    check_payment(connection, _user(connection), _at(1, 6), tochka)


# Table constraints


@pytest.mark.parametrize(
    ("changes", "constraint"),
    [
        ({"amount_rub": Decimal(0)}, "ck_billing_checkouts_amount_positive"),
        ({"status": "paid"}, "ck_billing_checkouts_status_known"),
        ({"status": "cancelled"}, "ck_billing_checkouts_cancelled_at_when_cancelled"),
        ({"status": "active"}, "ck_billing_checkouts_paid_has_subscription"),
        ({"operation_id": ""}, "ck_billing_checkouts_fields_not_empty"),
    ],
)
def test_checkout_constraints(connection: Connection, changes: dict[str, object], constraint: str) -> None:
    row = {
        "id": uuid.uuid4(),
        "user_id": _user(connection),
        "plan": "pro",
        "amount_rub": PRO,
        "operation_id": str(uuid.uuid4()),
        "payment_link": "https://merch.example.com/",
        "status": "created",
        "link_expires_at": _at(1, 12),
        **changes,
    }
    with pytest.raises(IntegrityError, match=constraint):
        connection.execute(insert(billing_checkouts).values(row))


def test_one_checkout_per_tochka_subscription(connection: Connection, tochka: FakeTochka) -> None:
    user_id = _user(connection)
    checkout(connection, user_id, "pro", _at(1, 5), tochka)
    first = _checkout_row(connection, user_id)
    with pytest.raises(IntegrityError, match="uq_billing_checkouts_operation_id"):
        connection.execute(
            insert(billing_checkouts).values(
                id=uuid.uuid4(),
                user_id=user_id,
                plan="pro",
                amount_rub=PRO,
                operation_id=first.operation_id,
                payment_link=first.payment_link,
                status="created",
                link_expires_at=_at(1, 12),
            )
        )


def test_no_card_data_is_stored(connection: Connection) -> None:
    for table in ("billing_checkouts", "payments"):
        columns = set(
            connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns"
                    " WHERE table_schema = 'authorled' AND table_name = :table"
                ),
                {"table": table},
            ).scalars()
        )
        assert not columns & {"masked_pan", "card_type", "token_card_id", "pan", "card"}


# Two confirmations at once


@pytest.fixture
def committed_user(engine: Engine) -> Iterator[tuple[uuid.UUID, FakeTochka]]:
    """A user with an open checkout, committed so two connections see it; removed afterwards."""
    tochka = FakeTochka()
    with engine.begin() as connection:
        user_id = _user(connection)
        checkout(connection, user_id, "pro", _at(1, 5), tochka)
    yield user_id, tochka
    with engine.begin() as connection:
        connection.execute(delete(payments).where(payments.c.user_id == user_id))
        connection.execute(
            update(billing_checkouts)
            .where(billing_checkouts.c.user_id == user_id)
            .values(subscription_id=None, status="expired", cancelled_at=None)
        )
        connection.execute(delete(billing_checkouts).where(billing_checkouts.c.user_id == user_id))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == user_id))
        connection.execute(delete(users).where(users.c.id == user_id))


def test_two_confirmations_wait_for_each_other(engine: Engine, committed_user: tuple[uuid.UUID, FakeTochka]) -> None:
    user_id, tochka = committed_user
    with engine.connect() as probe:
        operation_id = _checkout_row(probe, user_id).operation_id
    tochka.charge(operation_id, _at(1, 5, 11))
    results: list[object] = []

    with engine.connect() as first:
        transaction = first.begin()
        assert confirm_operation(first, operation_id, tochka) == 1

        def second() -> None:
            with engine.begin() as connection:
                connection.execute(text("SET LOCAL lock_timeout = '300ms'"))
                try:
                    results.append(confirm_operation(connection, operation_id, tochka))
                except OperationalError as error:
                    results.append(type(error.orig).__name__)

        worker = threading.Thread(target=second)
        worker.start()
        worker.join()
        # The second waited on the lock of the checkout while the first had not committed.
        assert results == ["LockNotAvailable"]
        transaction.commit()

    with engine.begin() as connection:
        assert confirm_operation(connection, operation_id, tochka) == 0
        assert len(_payments(connection, user_id)) == 1


# The administrator's report


def test_report_settles_and_shows_the_source(connection: Connection, tochka: FakeTochka) -> None:
    from core.billing import settled_subscription
    from core.usage import report

    user_id, operation_id = _paid(connection, tochka)
    email = connection.execute(select(users.c.email).where(users.c.id == user_id)).scalar_one()

    def read(c: Connection, who: uuid.UUID, at: datetime):  # type: ignore[no-untyped-def]
        return settled_subscription(c, who, at, tochka)

    (row,) = [row for row in report(connection, _at(1, 10), read) if row.email == email]
    assert (row.plan, row.source, row.period_end) == ("pro", "tochka", _at(2, 5))
    tochka.fail_charges(operation_id)
    (row,) = [row for row in report(connection, _at(2, 10), read) if row.email == email]
    assert (row.plan, row.source) == ("beta", "granted")

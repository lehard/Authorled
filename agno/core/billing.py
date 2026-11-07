"""Paid plans through the internet acquiring of Tochka (openspec/specs/api/billing; payments-tochka design).

A plan is bought as a monthly subscription in Tochka with a receipt. Only an operation that the API of Tochka returns
as APPROVED changes a subscription: a notice or the return of the buyer is only a reason to ask Tochka. Each charge is
an `approval` order of an operation and counts once: payments are unique by operation and order, and the checkout row
is locked while its charges are counted.

A paid subscription is renewed only here. When its period is over, `settled_subscription` asks Tochka for new charges
once; without one the user moves to the plan of new accounts (`signup_plan`). All operations run in the caller's
transaction; the client of Tochka is passed in.
"""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal, Protocol

from sqlalchemy import Connection, Row, func, insert, select, update

from core.errors import Conflict, Invalid
from core.plans import Plan, UnknownPlan, plans
from core.subscriptions import Subscription, SubscriptionEnded, current_subscription, next_period, start_subscription
from core.tables import billing_checkouts, payments, subscriptions, users
from core.tochka import Operation, Order, SubscriptionStatus, TochkaSettings
from core.tochka import Subscription as TochkaSubscription
from core.usage import period_spend

log = logging.getLogger(__name__)

# A payment link of Tochka lives 168 hours.
LINK_LIFETIME = timedelta(hours=168)
HISTORY = 12
# Statuses of a subscription in Tochka that may still charge the card and so are cancelled before a new checkout.
_STILL_CHARGING: tuple[SubscriptionStatus, ...] = ("Active", "PastDue", "Suspended", "Trial", "Preparing")

State = Literal["none", "pending", "active", "cancelled", "failed"]


class Tochka(Protocol):
    """What the core needs of the client (core/tochka.py); tests pass a replacement."""

    settings: TochkaSettings

    def create_subscription(
        self, *, payment_link_id: str, purpose: str, item_name: str, amount: Decimal, email: str
    ) -> TochkaSubscription: ...

    def cancel_subscription(self, operation_id: str) -> None: ...

    def subscription_status(self, operation_id: str) -> SubscriptionStatus: ...

    def operation(self, operation_id: str) -> Operation: ...


def receipt_text(plan: Plan) -> str:
    """The purpose of the payment and the name of the receipt line."""
    return f"CoAuthor, тариф «{plan.name}», 1 месяц"


def check_plans() -> None:
    """Plans for sale must fit a monthly subscription of Tochka; the API does not start otherwise."""
    for plan in plans().all():
        if not plan.purchasable:
            continue
        if plan.price_rub <= 0 or plan.price_rub != plan.price_rub.quantize(Decimal("0.01")):
            raise RuntimeError(f"Plan {plan.code!r} is for sale: price_rub must be above 0, in whole kopecks")
        if plan.period_months != 1:
            raise RuntimeError(f"Plan {plan.code!r} is for sale: period_months must be 1, Tochka charges monthly")
        if len(receipt_text(plan)) > 140:
            raise RuntimeError(f"Plan {plan.code!r} is for sale: its name is too long for the purpose of a payment")


@dataclass(frozen=True)
class Checkout:
    id: uuid.UUID
    user_id: uuid.UUID
    plan: str
    amount_rub: Decimal
    operation_id: str
    payment_link: str
    status: str
    subscription_id: uuid.UUID | None
    link_expires_at: datetime
    created_at: datetime


def _checkout(row: Row) -> Checkout:
    return Checkout(
        id=row.id,
        user_id=row.user_id,
        plan=row.plan,
        amount_rub=row.amount_rub,
        operation_id=row.operation_id,
        payment_link=row.payment_link,
        status=row.status,
        subscription_id=row.subscription_id,
        link_expires_at=row.link_expires_at,
        created_at=row.created_at,
    )


def _set_status(connection: Connection, checkout: Checkout, status: str, now: datetime) -> None:
    values: dict[str, object] = {"status": status, "updated_at": func.now()}
    values["cancelled_at"] = now if status == "cancelled" else None
    connection.execute(update(billing_checkouts).where(billing_checkouts.c.id == checkout.id).values(values))


def _checkout_of(connection: Connection, subscription: Subscription) -> Checkout:
    """The checkout whose payment opened this paid subscription, locked; none is broken data, not a free plan."""
    row = connection.execute(
        select(billing_checkouts).where(billing_checkouts.c.subscription_id == subscription.id).with_for_update()
    ).one_or_none()
    if row is None:
        raise RuntimeError(f"Paid subscription {subscription.id} has no checkout")
    return _checkout(row)


def _active(connection: Connection, user_id: uuid.UUID) -> Subscription | None:
    """The active subscription as it is stored, without moving its period."""
    row = connection.execute(
        select(subscriptions)
        .where(subscriptions.c.user_id == user_id, subscriptions.c.status == "active")
        .with_for_update()
    ).one_or_none()
    if row is None:
        return None
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


def _refusal(checkout: Checkout, operation: Operation, settings: TochkaSettings) -> str | None:
    """Why the operation does not pay this checkout, or None when it does."""
    if operation.customer_code != settings.customer_code:
        return f"customerCode {operation.customer_code} is not ours"
    if operation.payment_link_id != str(checkout.id):
        return f"paymentLinkId {operation.payment_link_id} is not checkout {checkout.id}"
    if operation.status != "APPROVED":
        return f"status {operation.status}"
    if operation.amount != checkout.amount_rub:
        return f"amount {operation.amount} is not {checkout.amount_rub}"
    if not any(order.type == "approval" for order in operation.orders):
        return "no approval order"
    return None


def _count_charge(connection: Connection, checkout: Checkout, operation: Operation, order: Order) -> Subscription:
    """Renew or open the paid subscription for one new charge and write the payment."""
    active = _active(connection, checkout.user_id)
    paid_at = order.time
    if (
        active is not None
        and active.source == "tochka"
        and active.id == checkout.subscription_id
        and paid_at < active.period_end
    ):
        # Charged before the end of the paid period: the next period follows it.
        subscription = next_period(connection, active.id)
    else:
        # The first payment, or a payment after the paid period ended: a month from the payment.
        if active is not None and active.source == "tochka" and active.id != checkout.subscription_id:
            log.warning("Checkout %s replaces paid subscription %s of another checkout", checkout.id, active.id)
        subscription = start_subscription(connection, checkout.user_id, checkout.plan, "tochka", paid_at)
    connection.execute(
        insert(payments).values(
            checkout_id=checkout.id,
            user_id=checkout.user_id,
            subscription_id=subscription.id,
            operation_id=operation.operation_id,
            order_id=order.order_id,
            amount_rub=order.amount,
            paid_at=paid_at,
            period_start=subscription.period_start,
            period_end=subscription.period_end,
        )
    )
    connection.execute(
        update(billing_checkouts)
        .where(billing_checkouts.c.id == checkout.id)
        .values(
            subscription_id=subscription.id,
            status="cancelled" if checkout.status == "cancelled" else "active",
            updated_at=func.now(),
        )
    )
    return subscription


def _count(connection: Connection, checkout: Checkout, operation: Operation, settings: TochkaSettings) -> int:
    """Count the new charges of the operation for the locked checkout; the number counted."""
    refusal = _refusal(checkout, operation, settings)
    if refusal is not None:
        log.warning("Operation %s does not pay checkout %s: %s", operation.operation_id, checkout.id, refusal)
        return 0
    known = set(
        connection.execute(select(payments.c.order_id).where(payments.c.operation_id == operation.operation_id))
        .scalars()
        .all()
    )
    counted = 0
    for order in sorted(operation.orders, key=lambda item: item.time):
        if order.type != "approval" or order.order_id in known:
            continue
        if order.amount != checkout.amount_rub:
            log.warning(
                "Order %s of operation %s charged %s, not %s",
                order.order_id,
                operation.operation_id,
                order.amount,
                checkout.amount_rub,
            )
            continue
        _count_charge(connection, checkout, operation, order)
        checkout = _locked_checkout(connection, checkout.id)
        counted += 1
    return counted


def _locked_checkout(connection: Connection, checkout_id: uuid.UUID) -> Checkout:
    return _checkout(
        connection.execute(
            select(billing_checkouts).where(billing_checkouts.c.id == checkout_id).with_for_update()
        ).one()
    )


def _settle(connection: Connection, ended: Subscription, now: datetime, tochka: Tochka) -> None:
    """The paid period is over: count new charges once, else move the user to the plan of new accounts."""
    checkout = _checkout_of(connection, ended)
    if checkout.status != "cancelled":
        _count(connection, checkout, tochka.operation(checkout.operation_id), tochka.settings)
        renewed = _active(connection, ended.user_id)
        if renewed is not None and renewed.source == "tochka" and now < renewed.period_end:
            return
        log.warning("Paid subscription %s of checkout %s was not renewed by a charge", ended.id, checkout.id)
        _set_status(connection, _locked_checkout(connection, checkout.id), "failed", now)
    last = _active(connection, ended.user_id)
    start = ended.period_end if last is None else last.period_end
    start_subscription(connection, ended.user_id, plans().signup.code, "granted", start)


def settled_subscription(connection: Connection, user_id: uuid.UUID, now: datetime, tochka: Tochka) -> Subscription:
    """The current subscription; an ended paid period is settled with Tochka first (renewed or free)."""
    try:
        return current_subscription(connection, user_id, now)
    except SubscriptionEnded as ended:
        _settle(connection, ended.subscription, now, tochka)
    return current_subscription(connection, user_id, now)


def confirm_operation(connection: Connection, operation_id: str, tochka: Tochka) -> int:
    """Ask Tochka about the operation and count its new charges; the number counted (0: unpaid, repeat or foreign)."""
    operation = tochka.operation(operation_id)
    if operation.customer_code != tochka.settings.customer_code:
        log.warning("Operation %s belongs to customerCode %s", operation.operation_id, operation.customer_code)
        return 0
    checkout_id = _uuid(operation.payment_link_id)
    row = None
    if checkout_id is not None:
        row = connection.execute(
            select(billing_checkouts).where(billing_checkouts.c.id == checkout_id).with_for_update()
        ).one_or_none()
    if row is None:
        log.warning("Operation %s has no checkout of ours (paymentLinkId %s)", operation_id, operation.payment_link_id)
        return 0
    return _count(connection, _checkout(row), operation, tochka.settings)


_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _uuid(value: str | None) -> uuid.UUID | None:
    """Our order numbers are UUIDs in canonical form; any other value names no checkout of ours."""
    if value is None or not _UUID.fullmatch(value):
        return None
    return uuid.UUID(value)


def _plan_for_sale(code: str) -> Plan:
    try:
        plan = plans().get(code)
    except UnknownPlan as error:
        raise Invalid("Такого тарифа нет.", field="plan") from error
    if not plan.purchasable or plan.price_rub <= 0:
        raise Invalid("Этот тариф нельзя купить.", field="plan")
    return plan


def _checkouts(connection: Connection, user_id: uuid.UUID, *statuses: str) -> list[Checkout]:
    rows = connection.execute(
        select(billing_checkouts)
        .where(billing_checkouts.c.user_id == user_id, billing_checkouts.c.status.in_(statuses))
        .order_by(billing_checkouts.c.created_at)
        .with_for_update()
    ).all()
    return [_checkout(row) for row in rows]


def checkout(connection: Connection, user_id: uuid.UUID, plan_code: str, now: datetime, tochka: Tochka) -> str:
    """The payment link of a new monthly subscription to the plan; an open link of the same plan is reused."""
    plan = _plan_for_sale(plan_code)
    subscription = settled_subscription(connection, user_id, now, tochka)
    if subscription.source == "tochka" and _checkout_of(connection, subscription).status == "active":
        raise Conflict("Подписка уже оплачена. Чтобы сменить тариф, сначала отмените её.")
    for open_one in _checkouts(connection, user_id, "created"):
        if open_one.plan == plan.code and now < open_one.link_expires_at:
            return open_one.payment_link
        _set_status(connection, open_one, "expired", now)
    for failed in _checkouts(connection, user_id, "failed"):
        # Pay again: the old subscription of Tochka must not charge later as well.
        if tochka.subscription_status(failed.operation_id) in _STILL_CHARGING:
            tochka.cancel_subscription(failed.operation_id)
        _set_status(connection, failed, "cancelled", now)
    email = connection.execute(select(users.c.email).where(users.c.id == user_id)).scalar_one()
    checkout_id = uuid.uuid4()
    text = receipt_text(plan)
    created = tochka.create_subscription(
        payment_link_id=str(checkout_id), purpose=text, item_name=text, amount=plan.price_rub, email=email
    )
    connection.execute(
        insert(billing_checkouts).values(
            id=checkout_id,
            user_id=user_id,
            plan=plan.code,
            amount_rub=plan.price_rub,
            operation_id=created.operation_id,
            payment_link=created.payment_link,
            status="created",
            link_expires_at=now + LINK_LIFETIME,
            # The clock of the operation, not of the transaction: checkouts of one transaction keep their order.
            created_at=now,
        )
    )
    return created.payment_link


def check_payment(connection: Connection, user_id: uuid.UUID, now: datetime, tochka: Tochka) -> None:
    """After the return from the payment page: ask Tochka about the open checkouts of the user."""
    settled_subscription(connection, user_id, now, tochka)
    for open_one in _checkouts(connection, user_id, "created"):
        operation = tochka.operation(open_one.operation_id)
        if operation.status == "APPROVED":
            _count(connection, open_one, operation, tochka.settings)
        elif operation.status == "EXPIRED":
            _set_status(connection, open_one, "expired", now)


def cancel(connection: Connection, user_id: uuid.UUID, now: datetime, tochka: Tochka) -> None:
    """Stop the monthly charges in Tochka; the paid plan stays until the end of its period."""
    subscription = settled_subscription(connection, user_id, now, tochka)
    if subscription.source != "tochka":
        raise Conflict("Нет оплаченной подписки, которую можно отменить.")
    paid = _checkout_of(connection, subscription)
    if paid.status != "active":
        raise Conflict("Подписка уже отменена.")
    tochka.cancel_subscription(paid.operation_id)
    _set_status(connection, paid, "cancelled", now)


@dataclass(frozen=True)
class Offer:
    code: str
    name: str
    price_rub: Decimal
    limit_rub: Decimal


@dataclass(frozen=True)
class PaymentLine:
    paid_at: datetime
    amount_rub: Decimal
    plan: str
    period_start: datetime
    period_end: datetime


@dataclass(frozen=True)
class BillingState:
    plan: Plan
    source: str
    period_end: datetime
    spent_rub: Decimal
    used_percent: int
    state: State
    next_charge_at: datetime | None
    payment_link: str | None
    # The plan of the open or failed checkout: what «Оплатить снова» buys.
    checkout_plan: str | None
    offers: tuple[Offer, ...]
    payments: tuple[PaymentLine, ...]


def _used_percent(spent: Decimal, limit: Decimal) -> int:
    if limit <= 0:
        return 100
    return min(100, int(spent * 100 / limit))


def billing_state(connection: Connection, user_id: uuid.UUID, now: datetime, tochka: Tochka) -> BillingState:
    """What the page «Тариф» shows."""
    subscription = settled_subscription(connection, user_id, now, tochka)
    plan = plans().get(subscription.plan)
    spent = period_spend(connection, subscription)
    state: State = "none"
    next_charge_at: datetime | None = None
    link: str | None = None
    checkout_plan: str | None = None
    if subscription.source == "tochka":
        paid = _checkout_of(connection, subscription)
        state = "active" if paid.status == "active" else "cancelled"
        next_charge_at = subscription.period_end if state == "active" else None
    else:
        latest = connection.execute(
            select(billing_checkouts)
            .where(billing_checkouts.c.user_id == user_id)
            .order_by(billing_checkouts.c.created_at.desc(), billing_checkouts.c.id)
            .limit(1)
        ).one_or_none()
        if latest is not None and latest.status == "failed":
            state, checkout_plan = "failed", latest.plan
        elif latest is not None and latest.status == "created" and now < latest.link_expires_at:
            state, link, checkout_plan = "pending", latest.payment_link, latest.plan
    history = connection.execute(
        select(payments, billing_checkouts.c.plan)
        .join(billing_checkouts, billing_checkouts.c.id == payments.c.checkout_id)
        .where(payments.c.user_id == user_id)
        .order_by(payments.c.paid_at.desc())
        .limit(HISTORY)
    ).all()
    return BillingState(
        plan=plan,
        source=subscription.source,
        period_end=subscription.period_end,
        spent_rub=spent,
        used_percent=_used_percent(spent, plan.limit_rub),
        state=state,
        next_charge_at=next_charge_at,
        payment_link=link,
        checkout_plan=checkout_plan,
        offers=tuple(
            Offer(p.code, p.name, p.price_rub, p.limit_rub) for p in plans().all() if p.purchasable and p.price_rub > 0
        ),
        payments=tuple(
            PaymentLine(row.paid_at, row.amount_rub, row.plan, row.period_start, row.period_end) for row in history
        ),
    )

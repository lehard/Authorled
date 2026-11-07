"""The page «Тариф» and the notices of Tochka (openspec/specs/api/billing).

`/billing`, `/billing/checkout`, `/billing/check` and `/billing/cancel` work only with the caller's own subscription.
`/billing/tochka/webhook` takes no token of a user (the auth module exempts it): the body must be signed by Tochka,
and even then it only names the operation the core asks Tochka about.
"""

import logging
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from app.api.body import read_object
from app.api.problems import Problem
from app.auth import Principal, current_principal
from core.billing import BillingState, Tochka, billing_state, cancel, check_payment, checkout, confirm_operation
from core.engine import get_engine
from core.tochka import (
    InvalidNotice,
    TochkaError,
    TochkaUnavailable,
    connect,
    read_notice,
    tochka_settings,
    webhook_key,
)
from core.users import active_user_id

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Billing"])

WEBHOOK_PATH = "/api/v1/billing/tochka/webhook"


def tochka_client() -> Iterator[Tochka]:
    """The client of Tochka for one request; route tests replace this dependency."""
    with connect(tochka_settings()) as client:
        yield client


class PlanOut(BaseModel):
    code: str
    name: str
    limit_rub: Decimal


class OfferOut(BaseModel):
    code: str
    name: str
    price_rub: Decimal
    limit_rub: Decimal


class PaymentOut(BaseModel):
    paid_at: datetime
    amount_rub: Decimal
    plan: str
    period_start: datetime
    period_end: datetime


class BillingOut(BaseModel):
    plan: PlanOut
    source: str
    period_end: datetime
    spent_rub: Decimal
    used_percent: int
    state: Literal["none", "pending", "active", "cancelled", "failed"]
    next_charge_at: datetime | None
    payment_url: str | None
    checkout_plan: str | None
    offers: list[OfferOut]
    payments: list[PaymentOut]


class CheckoutIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan: str = Field(min_length=1)


class CheckoutOut(BaseModel):
    payment_url: str


def _out(state: BillingState) -> BillingOut:
    return BillingOut(
        plan=PlanOut(code=state.plan.code, name=state.plan.name, limit_rub=state.plan.limit_rub),
        source=state.source,
        period_end=state.period_end,
        spent_rub=state.spent_rub,
        used_percent=state.used_percent,
        state=state.state,
        next_charge_at=state.next_charge_at,
        payment_url=state.payment_link,
        checkout_plan=state.checkout_plan,
        offers=[OfferOut(code=o.code, name=o.name, price_rub=o.price_rub, limit_rub=o.limit_rub) for o in state.offers],
        payments=[
            PaymentOut(
                paid_at=p.paid_at,
                amount_rub=p.amount_rub,
                plan=p.plan,
                period_start=p.period_start,
                period_end=p.period_end,
            )
            for p in state.payments
        ],
    )


def _state(principal: Principal, tochka: Tochka, before: str | None = None) -> BillingOut:
    now = datetime.now(UTC)
    with get_engine().begin() as connection:
        user_id: uuid.UUID = active_user_id(connection, principal.user_id)
        if before == "check":
            check_payment(connection, user_id, now, tochka)
        elif before == "cancel":
            cancel(connection, user_id, now, tochka)
        return _out(billing_state(connection, user_id, now, tochka))


@router.get("/billing", response_model=BillingOut, summary="The caller's plan, its limit and payments")
async def get_billing(
    principal: Principal = Depends(current_principal), tochka: Tochka = Depends(tochka_client)
) -> BillingOut:
    return await run_in_threadpool(_state, principal, tochka)


def _checkout(principal: Principal, tochka: Tochka, plan: str) -> CheckoutOut:
    with get_engine().begin() as connection:
        user_id = active_user_id(connection, principal.user_id)
        return CheckoutOut(payment_url=checkout(connection, user_id, plan, datetime.now(UTC), tochka))


@router.post(
    "/billing/checkout",
    response_model=CheckoutOut,
    summary="Start paying for a plan: the link to the payment page of Tochka",
    openapi_extra={
        "requestBody": {"required": True, "content": {"application/json": {"schema": CheckoutIn.model_json_schema()}}}
    },
)
async def post_checkout(
    request: Request, principal: Principal = Depends(current_principal), tochka: Tochka = Depends(tochka_client)
) -> CheckoutOut:
    body = await read_object(request)
    try:
        wanted = CheckoutIn.model_validate(body)
    except ValidationError as error:
        raise Problem(422, "Unprocessable Content", "Поле «plan»: укажите код тарифа.") from error
    return await run_in_threadpool(_checkout, principal, tochka, wanted.plan)


@router.post("/billing/check", response_model=BillingOut, summary="Ask Tochka about the payment just made")
async def post_check(
    principal: Principal = Depends(current_principal), tochka: Tochka = Depends(tochka_client)
) -> BillingOut:
    return await run_in_threadpool(_state, principal, tochka, "check")


@router.post("/billing/cancel", response_model=BillingOut, summary="Stop the monthly charges")
async def post_cancel(
    principal: Principal = Depends(current_principal), tochka: Tochka = Depends(tochka_client)
) -> BillingOut:
    return await run_in_threadpool(_state, principal, tochka, "cancel")


def _confirm(operation_id: str, tochka: Tochka) -> int:
    with get_engine().begin() as connection:
        return confirm_operation(connection, operation_id, tochka)


@router.post(WEBHOOK_PATH.removeprefix("/api/v1"), summary="Notice of Tochka about a payment (no user token)")
async def post_tochka_webhook(request: Request, tochka: Tochka = Depends(tochka_client)) -> JSONResponse:
    try:
        notice = read_notice(await request.body(), webhook_key())
    except InvalidNotice as error:
        log.warning("Refused a notice of Tochka: %s", error)
        raise Problem(400, "Bad Request", str(error)) from error
    try:
        counted = await run_in_threadpool(_confirm, notice.operation_id, tochka)
    except (TochkaUnavailable, TochkaError) as error:
        # Not 200: Tochka repeats the notice, and the charge is counted when it answers.
        log.warning("Notice about operation %s not confirmed: %s", notice.operation_id, error)
        raise Problem(503, "Service Unavailable", "Не удалось подтвердить операцию в Точке.") from error
    return JSONResponse({"counted": counted})

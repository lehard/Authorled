"""A replacement of Tochka for tests of payments, and paid plans of tests only.

`FakeTochka` keeps operations the way the API of Tochka returns them (core/tochka.py); a test pays a checkout by
adding an `approval` order. The plans of tests replace core/plans.toml for one test; the file of the release has no
paid plans until the owner decides them.
"""

import itertools
import uuid
from collections.abc import Iterator
from dataclasses import replace
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest

from core import plans as plans_module
from core.tochka import Operation, Order, SubscriptionStatus, TochkaSettings, TochkaUnavailable
from core.tochka import Subscription as TochkaSubscription

SETTINGS = TochkaSettings(
    api_url="https://enter.tochka.com/sandbox/v2/",
    jwt="sandbox.jwt.token",
    customer_code="1234567ab",
    merchant_id="200000000001097",
    tax_system="usn_income",
    vat_type="none",
    payment_method="full_prepayment",
    redirect_url="https://coauthor.example.com/settings/billing/return",
    fail_redirect_url="https://coauthor.example.com/settings/billing/fail",
)

PLANS_TOML = """
signup_plan = "beta"

[plans.beta]
name = "Бета"
price_rub = 0
period_months = 1
limit_rub = 500
purchasable = false

[plans.pro]
name = "Про"
price_rub = 490
period_months = 1
limit_rub = 2000
purchasable = true

[plans.max]
name = "Макс"
price_rub = 990.50
period_months = 1
limit_rub = 5000
purchasable = true
"""

PRO = Decimal(490)


@pytest.fixture
def paid_plans(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Plans `beta` (signup, free), `pro` and `max` (for sale) for one test."""
    file = tmp_path / "plans.toml"
    file.write_text(PLANS_TOML)
    monkeypatch.setattr(plans_module, "PLANS_FILE", file)
    plans_module.plans.cache_clear()
    yield
    plans_module.plans.cache_clear()


class FakeTochka:
    """The acquiring API of Tochka as the core sees it, in memory."""

    def __init__(self) -> None:
        self.settings = SETTINGS
        self.created: list[dict[str, object]] = []
        self.cancelled: list[str] = []
        self.status_asked: list[str] = []
        self.operations: dict[str, Operation] = {}
        self.statuses: dict[str, SubscriptionStatus] = {}
        self.unavailable = False
        self._orders = itertools.count(1)

    def _check(self) -> None:
        if self.unavailable:
            raise TochkaUnavailable("Точка недоступна: ConnectError.")

    def create_subscription(
        self, *, payment_link_id: str, purpose: str, item_name: str, amount: Decimal, email: str
    ) -> TochkaSubscription:
        self._check()
        operation_id = str(uuid.uuid4())
        self.created.append(
            {
                "payment_link_id": payment_link_id,
                "purpose": purpose,
                "item_name": item_name,
                "amount": amount,
                "email": email,
            }
        )
        self.operations[operation_id] = Operation(
            operation_id=operation_id,
            status="CREATED",
            customer_code=SETTINGS.customer_code,
            amount=amount,
            payment_link_id=payment_link_id,
            paid_at=None,
            orders=(),
        )
        self.statuses[operation_id] = "Preparing"
        return TochkaSubscription(operation_id, f"https://merch.example.com/order/?uuid={operation_id}")

    def cancel_subscription(self, operation_id: str) -> None:
        self._check()
        self.cancelled.append(operation_id)
        self.statuses[operation_id] = "Cancelled"

    def subscription_status(self, operation_id: str) -> SubscriptionStatus:
        self._check()
        self.status_asked.append(operation_id)
        return self.statuses[operation_id]

    def operation(self, operation_id: str) -> Operation:
        self._check()
        return self.operations[operation_id]

    # What happens in Tochka, outside our API.

    def charge(self, operation_id: str, at: datetime, amount: Decimal | None = None) -> Order:
        """A successful charge of the card: an approval order in the operation, which becomes APPROVED."""
        operation = self.operations[operation_id]
        order = Order(f"order-{next(self._orders)}", "approval", operation.amount if amount is None else amount, at)
        self.operations[operation_id] = replace(
            operation, status="APPROVED", paid_at=operation.paid_at or at, orders=(*operation.orders, order)
        )
        self.statuses[operation_id] = "Active"
        return order

    def set(self, operation_id: str, **changes: object) -> None:
        self.operations[operation_id] = replace(self.operations[operation_id], **changes)  # type: ignore[arg-type]

    def renewal_as_new_operation(self, operation_id: str, at: datetime) -> str:
        """A monthly charge reported as an operation of its own with the same order number."""
        first = self.operations[operation_id]
        new_id = str(uuid.uuid4())
        self.operations[new_id] = replace(
            first,
            operation_id=new_id,
            status="APPROVED",
            paid_at=at,
            orders=(Order(f"order-{next(self._orders)}", "approval", first.amount, at),),
        )
        return new_id

    def fail_charges(self, operation_id: str, status: SubscriptionStatus = "PastDue") -> None:
        self.statuses[operation_id] = status

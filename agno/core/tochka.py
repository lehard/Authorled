"""Client of the Tochka internet acquiring API (openspec/specs/integrations, «Интернет-эквайринг Точки»).

A monthly subscription with a 54-FZ receipt, its cancellation and status, a payment operation, and the
signature of the `acquiringInternetPayment` notice. The facts about the API, with links to the documentation,
are in openspec/changes/payments-tochka/design.md. The client knows nothing about users, plans or the
database: the core decides what a confirmed operation means.

Answers are checked against the schema of Tochka: a missing field or a status outside its list is an error
that names it, never a guess.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from functools import cache
from os import environ
from pathlib import Path
from typing import Any, Literal, get_args
from urllib.parse import urlsplit

import httpx
import jwt
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError

PRODUCTION_URL = "https://enter.tochka.com/uapi/"
SANDBOX_URL = "https://enter.tochka.com/sandbox/v2/"
# enter.tochka.com is signed by the Russian Trusted Sub CA: certifi alone does not verify it.
CA_BUNDLE = Path(__file__).resolve().parents[1] / "litellm" / "certs" / "ca-bundle.pem"
# The public key of the notices, https://enter.tochka.com/doc/openapi/static/keys/public.
WEBHOOK_KEY_FILE = Path(__file__).with_name("tochka_webhook_key.json")
TIMEOUT_SECONDS = 30
# The most monthly charges Tochka allows in one scheduled subscription.
MONTHLY_CHARGES = 84

TaxSystem = Literal["osn", "usn_income", "usn_income_outcome", "esn", "patent"]
VatType = Literal["none", "vat0", "vat5", "vat7", "vat10", "vat22", "vat105", "vat107", "vat110", "vat122"]
PaymentMethod = Literal["full_payment", "full_prepayment"]
PaymentStatus = Literal[
    "CREATED", "APPROVED", "ON-REFUND", "REFUNDED", "EXPIRED", "REFUNDED_PARTIALLY", "AUTHORIZED", "WAIT_FULL_PAYMENT"
]
SubscriptionStatus = Literal[
    "Active",
    "Cancelled",
    "Completed",
    "Expired",
    "Failed",
    "PastDue",
    "Preparing",
    "Refused",
    "Rejected",
    "Suspended",
    "Trial",
]
OrderType = Literal["refund", "approval", "authorized"]


class TochkaError(Exception):
    """Tochka refused the request or answered outside its schema."""

    def __init__(self, status: int, code: str | None, message: str) -> None:
        super().__init__(f"Точка ответила {status}" + (f" ({code})" if code else "") + f": {message}")
        self.status = status
        self.code = code
        self.message = message


class TochkaUnavailable(Exception):
    """Tochka did not answer: no connection, a timeout or a 5xx. The request may be repeated later."""


class InvalidNotice(Exception):
    """The body of a notice is not a JWT signed by Tochka, or not an acquiring notice."""


@dataclass(frozen=True)
class TochkaSettings:
    api_url: str
    jwt: str = field(repr=False)
    customer_code: str
    merchant_id: str
    tax_system: TaxSystem
    vat_type: VatType
    payment_method: PaymentMethod
    redirect_url: str
    fail_redirect_url: str


def _required(name: str) -> str:
    value = environ.get(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set (internet acquiring of Tochka)")
    return value


def _matching(name: str, pattern: str, what: str) -> str:
    value = _required(name)
    if not re.fullmatch(pattern, value):
        raise RuntimeError(f"{name} must be {what}, not {value!r}")
    return value


def _one_of(name: str, allowed: Any) -> Any:
    value = _required(name)
    choices = get_args(allowed)
    if value not in choices:
        raise RuntimeError(f"{name} must be one of {', '.join(choices)}, not {value!r}")
    return value


def _page_url(name: str) -> str:
    value = _required(name)
    parts = urlsplit(value)
    # Tochka refuses http return addresses, even in the sandbox.
    if parts.scheme != "https" or not parts.netloc or len(value) > 2083:
        raise RuntimeError(f"{name} must be an https address of at most 2083 characters, not {value!r}")
    return value


def tochka_settings() -> TochkaSettings:
    """The TOCHKA_* settings; the API checks them at startup and does not start without them."""
    api_url = _required("TOCHKA_API_URL")
    if api_url not in (PRODUCTION_URL, SANDBOX_URL):
        raise RuntimeError(f"TOCHKA_API_URL must be {PRODUCTION_URL} or {SANDBOX_URL}, not {api_url!r}")
    return TochkaSettings(
        api_url=api_url,
        jwt=_required("TOCHKA_JWT"),
        customer_code=_matching("TOCHKA_CUSTOMER_CODE", r"[0-9A-Za-z]{9}", "the 9-character customerCode"),
        merchant_id=_matching("TOCHKA_MERCHANT_ID", r"\d{15}", "the 15-digit merchantId of the retail point"),
        tax_system=_one_of("TOCHKA_TAX_SYSTEM", TaxSystem),
        vat_type=_one_of("TOCHKA_VAT_TYPE", VatType),
        payment_method=_one_of("TOCHKA_PAYMENT_METHOD", PaymentMethod),
        redirect_url=_page_url("TOCHKA_REDIRECT_URL"),
        fail_redirect_url=_page_url("TOCHKA_FAIL_REDIRECT_URL"),
    )


@dataclass(frozen=True)
class Subscription:
    """A subscription just created: its id in Tochka and the page where the buyer pays."""

    operation_id: str
    payment_link: str


@dataclass(frozen=True)
class Order:
    """One movement of money inside an operation: a charge (`approval`), a hold or a refund."""

    order_id: str
    type: OrderType
    amount: Decimal
    time: datetime


@dataclass(frozen=True)
class Operation:
    operation_id: str
    status: PaymentStatus
    customer_code: str
    amount: Decimal
    payment_link_id: str | None
    paid_at: datetime | None
    orders: tuple[Order, ...]


@dataclass(frozen=True)
class Notice:
    """What the core takes from a signed notice: only the operation to ask Tochka about."""

    operation_id: str
    customer_code: str


class _Answer(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class _CreatedData(_Answer):
    operation_id: str = Field(alias="operationId", min_length=1)
    payment_link: str = Field(alias="paymentLink", min_length=1)


class _Created(_Answer):
    data: _CreatedData = Field(alias="Data")


class _ResultData(_Answer):
    result: bool


class _Result(_Answer):
    data: _ResultData = Field(alias="Data")


class _StatusData(_Answer):
    status: SubscriptionStatus


class _Status(_Answer):
    data: _StatusData = Field(alias="Data")


class _OrderItem(_Answer):
    order_id: str = Field(alias="orderId", min_length=1)
    type: OrderType
    amount: Decimal
    time: AwareDatetime


class _OperationItem(_Answer):
    operation_id: str = Field(alias="operationId", min_length=1)
    status: PaymentStatus
    customer_code: str = Field(alias="customerCode")
    amount: Decimal
    payment_link_id: str | None = Field(default=None, alias="paymentLinkId")
    paid_at: AwareDatetime | None = Field(default=None, alias="paidAt")
    orders: list[_OrderItem] = Field(alias="Order")


class _OperationList(_Answer):
    operations: list[_OperationItem] = Field(alias="Operation")


class _Operations(_Answer):
    data: _OperationList = Field(alias="Data")


class _NoticeBody(_Answer):
    webhook_type: Literal["acquiringInternetPayment"] = Field(alias="webhookType")
    operation_id: str = Field(alias="operationId", min_length=1)
    customer_code: str = Field(alias="customerCode")


def _schema_error(error: ValidationError) -> str:
    first = error.errors()[0]
    where = ".".join(str(part) for part in first["loc"])
    return f"ответ не по схеме Точки: {where}: {first['msg']}"


def _refusal(response: httpx.Response) -> tuple[str | None, str]:
    """The code and the reason of a refused request: the message of Tochka and of its Errors, never the
    whole body. Tochka answers in its documented shape or, before its API (a missing token), with only
    `message`; a body without either is named as such."""
    try:
        body = json.loads(response.content)
    except json.JSONDecodeError as error:
        return None, f"ответ без JSON ({error.msg})"
    if not isinstance(body, dict):
        return None, "ответ без описания ошибки"
    code = str(body["code"]) if "code" in body else None
    parts = [str(body["message"])] if "message" in body else []
    errors = body.get("Errors")
    if isinstance(errors, list):
        parts += [str(item["message"]) for item in errors if isinstance(item, dict) and "message" in item]
    return code, "; ".join(parts)[:600] if parts else "ответ без описания ошибки"


def _amount(value: Decimal) -> float:
    """Rubles with at most two decimal places, as the JSON number the API expects."""
    if value <= 0 or value != value.quantize(Decimal("0.01")):
        raise ValueError(f"Сумма должна быть больше нуля и с точностью до копейки, а не {value}")
    return float(value)


class TochkaClient:
    """Requests to the acquiring methods; `transport` carries them (httpx.HTTPTransport in the API)."""

    def __init__(self, settings: TochkaSettings, transport: httpx.BaseTransport) -> None:
        self.settings = settings
        self._http = httpx.Client(
            base_url=f"{settings.api_url}acquiring/v1.0/",
            headers={"Authorization": f"Bearer {settings.jwt}"},
            timeout=TIMEOUT_SECONDS,
            transport=transport,
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> TochkaClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _call(self, method: str, path: str, answer: type[_Answer], body: dict[str, Any] | None = None) -> Any:
        try:
            response = self._http.request(method, path, json=body)
        except httpx.TransportError as error:
            raise TochkaUnavailable(f"Точка недоступна: {type(error).__name__}.") from error
        if response.status_code >= 500:
            raise TochkaUnavailable(f"Точка ответила {response.status_code}: {_refusal(response)[1]}.")
        if response.status_code != 200:
            code, reason = _refusal(response)
            raise TochkaError(response.status_code, code, reason)
        try:
            # Amounts stay exact: JSON numbers become Decimal, not float.
            body = json.loads(response.content, parse_float=Decimal)
        except json.JSONDecodeError as error:
            raise TochkaError(200, None, f"ответ без JSON ({error.msg})") from error
        try:
            return answer.model_validate(body)
        except ValidationError as error:
            raise TochkaError(200, None, _schema_error(error)) from error

    def create_subscription(
        self, *, payment_link_id: str, purpose: str, item_name: str, amount: Decimal, email: str
    ) -> Subscription:
        """A subscription charged by Tochka every month, with a receipt to `email` for each charge.

        `payment_link_id` is our order number: Tochka refuses a repeated one and returns it in the
        operation, so a payment is matched to its checkout by it.
        """
        if not 1 <= len(payment_link_id) <= 45:
            raise ValueError("Номер заказа для Точки должен быть от 1 до 45 символов")
        if not 1 <= len(purpose) <= 140:
            raise ValueError("Назначение платежа должно быть от 1 до 140 символов")
        if not 1 <= len(item_name) <= 256:
            raise ValueError("Название позиции чека должно быть от 1 до 256 символов")
        price = _amount(amount)
        settings = self.settings
        data = {
            "customerCode": settings.customer_code,
            "merchantId": settings.merchant_id,
            "amount": price,
            "purpose": purpose,
            "paymentLinkId": payment_link_id,
            "redirectUrl": settings.redirect_url,
            "failRedirectUrl": settings.fail_redirect_url,
            "Client": {"email": email},
            "Items": [
                {
                    "name": item_name,
                    "amount": price,
                    "quantity": 1,
                    "vatType": settings.vat_type,
                    "paymentMethod": settings.payment_method,
                    "paymentObject": "service",
                    "measure": "шт.",
                }
            ],
            "taxSystemCode": settings.tax_system,
            "Options": {"period": "Month", "trancheCount": MONTHLY_CHARGES},
        }
        created: _Created = self._call("POST", "subscriptions_with_receipt", _Created, {"Data": data})
        return Subscription(created.data.operation_id, created.data.payment_link)

    def cancel_subscription(self, operation_id: str) -> None:
        """Stop the monthly charges; an answer without `result: true` is a refusal."""
        done: _Result = self._call(
            "POST", f"subscriptions/{_segment(operation_id)}/status", _Result, {"Data": {"status": "Cancelled"}}
        )
        if not done.data.result:
            raise TochkaError(200, None, "Точка не подтвердила отмену подписки")

    def subscription_status(self, operation_id: str) -> SubscriptionStatus:
        status: _Status = self._call("GET", f"subscriptions/{_segment(operation_id)}/status", _Status)
        return status.data.status

    def operation(self, operation_id: str) -> Operation:
        """The operation as Tochka sees it now; exactly one is expected for one id."""
        found: _Operations = self._call("GET", f"payments/{_segment(operation_id)}", _Operations)
        if len(found.data.operations) != 1:
            raise TochkaError(200, None, f"ожидалась одна операция, пришло {len(found.data.operations)}")
        item = found.data.operations[0]
        return Operation(
            operation_id=item.operation_id,
            status=item.status,
            customer_code=item.customer_code,
            amount=item.amount,
            payment_link_id=item.payment_link_id,
            paid_at=item.paid_at,
            orders=tuple(Order(order.order_id, order.type, order.amount, order.time) for order in item.orders),
        )


def _segment(operation_id: str) -> str:
    """An id put into a path must stay one path segment."""
    if not re.fullmatch(r"[0-9A-Za-z-]{1,64}", operation_id):
        raise ValueError(f"Недопустимый идентификатор операции Точки: {operation_id!r}")
    return operation_id


def connect(settings: TochkaSettings) -> TochkaClient:
    """The client of the API: TLS checked with the bundle that holds the Russian Trusted CA."""
    if not CA_BUNDLE.is_file():
        raise RuntimeError(f"{CA_BUNDLE} does not exist; rebuild it with ./agno/scripts/build_ca_bundle.sh")
    return TochkaClient(settings, httpx.HTTPTransport(verify=str(CA_BUNDLE), retries=0))


@cache
def webhook_key() -> Any:
    """The public key of Tochka for notices, from the JWK file in the repository."""
    return jwt.PyJWK.from_dict(json.loads(WEBHOOK_KEY_FILE.read_text()), algorithm="RS256").key


def read_notice(body: bytes, key: Any) -> Notice:
    """A notice whose signature checks with `key` (RS256 only), or InvalidNotice.

    The body is trusted for nothing but the operation id: the core asks Tochka about it.
    """
    try:
        claims = jwt.decode(body.decode("ascii").strip(), key, algorithms=["RS256"])
    except (UnicodeDecodeError, jwt.PyJWTError) as error:
        raise InvalidNotice(f"Подпись уведомления Точки не проверяется: {type(error).__name__}.") from error
    try:
        notice = _NoticeBody.model_validate(claims)
    except ValidationError as error:
        raise InvalidNotice(f"Уведомление Точки не по схеме: {_schema_error(error)}.") from error
    return Notice(notice.operation_id, notice.customer_code)

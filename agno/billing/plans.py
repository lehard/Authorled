"""Plans and model prices: data files of the billing module (openspec/specs/billing/subscriptions).

`plans.toml` and `model_prices.toml` lie next to this module. Every field is required and unknown fields are refused,
so a typo stops the API at startup instead of silently changing a limit.
"""

import re
import tomllib
from dataclasses import dataclass
from decimal import Decimal
from functools import cache
from pathlib import Path
from typing import Any

PLANS_FILE = Path(__file__).with_name("plans.toml")
PRICES_FILE = Path(__file__).with_name("model_prices.toml")

_PLAN_CODE = re.compile(r"[a-z0-9-]+")
_MILLION = Decimal(1_000_000)


class DataFileError(Exception):
    """A plans or prices file breaks its format; the message names the file and the field."""


class UnknownPlan(Exception):
    """The plan code is not in the plans file."""


class UnknownModel(Exception):
    """The model alias has no price in the prices file."""


@dataclass(frozen=True)
class Plan:
    code: str
    name: str
    price_rub: Decimal
    period_months: int
    limit_rub: Decimal
    purchasable: bool


@dataclass(frozen=True)
class ModelPrice:
    """Rubles per million tokens."""

    model: str
    input_rub: Decimal
    cache_read_rub: Decimal
    output_rub: Decimal

    def cost_rub(self, input_tokens: int, cache_read_tokens: int, output_tokens: int) -> Decimal:
        """Input tokens include the tokens read from the cache, as the provider reports them."""
        if min(input_tokens, cache_read_tokens, output_tokens) < 0:
            raise ValueError("Token counts must not be negative")
        if cache_read_tokens > input_tokens:
            raise ValueError(f"Cache read tokens {cache_read_tokens} exceed input tokens {input_tokens}")
        total = (
            (input_tokens - cache_read_tokens) * self.input_rub
            + cache_read_tokens * self.cache_read_rub
            + output_tokens * self.output_rub
        )
        return total / _MILLION


@dataclass(frozen=True)
class Plans:
    signup: Plan
    by_code: dict[str, Plan]

    def get(self, code: str) -> Plan:
        plan = self.by_code.get(code)
        if plan is None:
            raise UnknownPlan(f"Plan {code!r} is not in {PLANS_FILE.name}")
        return plan

    def all(self) -> tuple[Plan, ...]:
        return tuple(self.by_code.values())


@dataclass(frozen=True)
class Prices:
    by_model: dict[str, ModelPrice]

    def get(self, model: str) -> ModelPrice:
        price = self.by_model.get(model)
        if price is None:
            raise UnknownModel(f"Model {model!r} has no price in {PRICES_FILE.name}")
        return price


def _read(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as file:
            return tomllib.load(file, parse_float=Decimal)
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise DataFileError(f"{path.name}: {error}") from error


def _fields(where: str, table: Any, expected: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(table, dict):
        raise DataFileError(f"{where} must be a table")
    missing = [name for name in expected if name not in table]
    if missing:
        raise DataFileError(f"{where}: missing field {', '.join(missing)}")
    extra = sorted(set(table) - set(expected))
    if extra:
        raise DataFileError(f"{where}: unknown field {', '.join(extra)}")
    return table


def _rubles(where: str, value: Any) -> Decimal:
    # TOML integers arrive as int, fractions as Decimal (parse_float); bool is an int in Python and is refused.
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise DataFileError(f"{where} must be a number")
    amount = Decimal(value)
    if amount < 0:
        raise DataFileError(f"{where} must not be negative")
    return amount


def parse_plans(data: dict[str, Any], source: str) -> Plans:
    top = _fields(source, data, ("signup_plan", "plans"))
    tables = top["plans"]
    if not isinstance(tables, dict) or not tables:
        raise DataFileError(f"{source}: plans must be a non-empty table")
    by_code: dict[str, Plan] = {}
    for code, table in tables.items():
        where = f"{source}: plans.{code}"
        if not _PLAN_CODE.fullmatch(code):
            raise DataFileError(f"{where}: the code must match [a-z0-9-]+")
        fields = _fields(where, table, ("name", "price_rub", "period_months", "limit_rub", "purchasable"))
        name, months, purchasable = fields["name"], fields["period_months"], fields["purchasable"]
        if not isinstance(name, str) or not name.strip():
            raise DataFileError(f"{where}.name must be a non-empty string")
        if isinstance(months, bool) or not isinstance(months, int) or months < 1:
            raise DataFileError(f"{where}.period_months must be an integer of at least 1")
        if not isinstance(purchasable, bool):
            raise DataFileError(f"{where}.purchasable must be true or false")
        by_code[code] = Plan(
            code=code,
            name=name,
            price_rub=_rubles(f"{where}.price_rub", fields["price_rub"]),
            period_months=months,
            limit_rub=_rubles(f"{where}.limit_rub", fields["limit_rub"]),
            purchasable=purchasable,
        )
    signup = top["signup_plan"]
    if not isinstance(signup, str) or signup not in by_code:
        raise DataFileError(f"{source}: signup_plan {signup!r} is not one of the plans")
    return Plans(signup=by_code[signup], by_code=by_code)


def parse_prices(data: dict[str, Any], source: str) -> Prices:
    top = _fields(source, data, ("models",))
    tables = top["models"]
    if not isinstance(tables, dict) or not tables:
        raise DataFileError(f"{source}: models must be a non-empty table")
    by_model: dict[str, ModelPrice] = {}
    for model, table in tables.items():
        where = f"{source}: models.{model}"
        fields = _fields(where, table, ("input_rub", "cache_read_rub", "output_rub"))
        by_model[model] = ModelPrice(
            model=model,
            input_rub=_rubles(f"{where}.input_rub", fields["input_rub"]),
            cache_read_rub=_rubles(f"{where}.cache_read_rub", fields["cache_read_rub"]),
            output_rub=_rubles(f"{where}.output_rub", fields["output_rub"]),
        )
    return Prices(by_model=by_model)


@cache
def plans() -> Plans:
    """The plans of the release, read once per process."""
    return parse_plans(_read(PLANS_FILE), PLANS_FILE.name)


@cache
def prices() -> Prices:
    """The model prices of the release, read once per process."""
    return parse_prices(_read(PRICES_FILE), PRICES_FILE.name)

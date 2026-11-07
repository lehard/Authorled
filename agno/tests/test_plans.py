"""Plans and model prices as data.

openspec/specs/core/subscriptions: «Тарифы как данные», «Цены моделей как данные».
"""

from decimal import Decimal
from typing import Any

import pytest

from app.settings import DEEPSEEK_FAST, DEEPSEEK_THINKING
from core.plans import DataFileError, UnknownModel, UnknownPlan, parse_plans, parse_prices, plans, prices

BETA = {"name": "Бета", "price_rub": 0, "period_months": 1, "limit_rub": 500, "purchasable": False}
PRICE = {"input_rub": 30, "cache_read_rub": Decimal("0.6"), "output_rub": 120}


def _plans(**changes: Any) -> dict[str, Any]:
    return {"signup_plan": "beta", "plans": {"beta": {**BETA, **changes}}}


def test_release_beta_plan() -> None:
    beta = plans().signup
    assert beta == plans().get("beta")
    assert (beta.price_rub, beta.period_months, beta.limit_rub, beta.purchasable) == (
        Decimal(0),
        1,
        Decimal(500),
        False,
    )


def test_release_prices_cover_the_models() -> None:
    for model in (DEEPSEEK_FAST, DEEPSEEK_THINKING):
        assert prices().get(model).model == model


def test_cost() -> None:
    price = parse_prices({"models": {"m": PRICE}}, "prices").get("m")
    assert price.cost_rub(10_000, 4_000, 2_000) == Decimal("0.4224")


def test_cost_refuses_more_cache_than_input() -> None:
    price = parse_prices({"models": {"m": PRICE}}, "prices").get("m")
    with pytest.raises(ValueError, match="exceed"):
        price.cost_rub(10, 11, 0)


def test_missing_field() -> None:
    data = _plans()
    del data["plans"]["beta"]["limit_rub"]
    with pytest.raises(DataFileError, match=r"plans\.beta: missing field limit_rub"):
        parse_plans(data, "plans.toml")


def test_unknown_field() -> None:
    with pytest.raises(DataFileError, match=r"plans\.beta: unknown field discount"):
        parse_plans(_plans(discount=10), "plans.toml")


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"limit_rub": -1}, "limit_rub"),
        ({"price_rub": "0"}, "price_rub"),
        ({"period_months": 0}, "period_months"),
        ({"purchasable": "no"}, "purchasable"),
        ({"name": " "}, "name"),
    ],
)
def test_invalid_values(changes: dict[str, Any], field: str) -> None:
    with pytest.raises(DataFileError, match=rf"plans\.beta\.{field}"):
        parse_plans(_plans(**changes), "plans.toml")


def test_signup_plan_must_be_a_plan() -> None:
    with pytest.raises(DataFileError, match="'trial'"):
        parse_plans({**_plans(), "signup_plan": "trial"}, "plans.toml")


def test_plan_code_format() -> None:
    with pytest.raises(DataFileError, match="code must match"):
        parse_plans({"signup_plan": "Beta", "plans": {"Beta": BETA}}, "plans.toml")


def test_unknown_plan_and_model() -> None:
    with pytest.raises(UnknownPlan, match="'old'"):
        plans().get("old")
    with pytest.raises(UnknownModel, match="'gpt-4o'"):
        prices().get("gpt-4o")


def test_price_missing_field() -> None:
    with pytest.raises(DataFileError, match=r"models\.m: missing field output_rub"):
        parse_prices({"models": {"m": {"input_rub": 1, "cache_read_rub": 1}}}, "prices.toml")


def test_money_is_exact() -> None:
    """Fractions in the file arrive as Decimal (tomllib parse_float), never as float."""
    import tomllib

    text = 'signup_plan = "beta"\n[plans.beta]\nname = "Бета"\nprice_rub = 990.90\nperiod_months = 1\n'
    text += "limit_rub = 500.10\npurchasable = false\n"
    plan = parse_plans(tomllib.loads(text, parse_float=Decimal), "plans.toml").signup
    assert (plan.price_rub, plan.limit_rub) == (Decimal("990.90"), Decimal("500.10"))
    assert isinstance(plan.limit_rub, Decimal)


@pytest.mark.parametrize("field", ["price_rub", "limit_rub"])
def test_float_is_refused(field: str) -> None:
    with pytest.raises(DataFileError, match=rf"plans\.beta\.{field} must be a number"):
        parse_plans(_plans(**{field: 500.1}), "plans.toml")

"""python -m admin report | set-plan <e-mail> <plan>: spending and plans of users (openspec/specs/core/subscriptions).

Run in the API container through ./scripts/usage.sh. Everything goes through the core operations; a failure exits
non-zero with its reason.
"""

import argparse
import sys
from datetime import UTC, datetime
from decimal import Decimal

from core.billing import settled_subscription
from core.engine import get_engine
from core.plans import UnknownPlan
from core.subscriptions import NoSubscription, set_plan
from core.tochka import connect, tochka_settings
from core.usage import ReportRow, report, user_id_by_email

_COLUMNS = (
    "почта",
    "тариф",
    "оплачено до",
    "период (UTC)",
    "запросы",
    "вход",
    "кэш",
    "выход",
    "расход ₽",
    "лимит ₽",
    "остаток ₽",
    "LiteLLM $",
)


def _money(amount: Decimal, places: str) -> str:
    return str(amount.quantize(Decimal(places)))


def _cells(row: ReportRow) -> tuple[str, ...]:
    return (
        row.email,
        row.plan,
        f"{row.period_end:%Y-%m-%d %H:%M}" if row.source == "tochka" else "—",
        f"{row.period_start:%Y-%m-%d %H:%M} — {row.period_end:%Y-%m-%d %H:%M}",
        str(row.runs),
        str(row.input_tokens),
        str(row.cache_read_tokens),
        str(row.output_tokens),
        _money(row.spent_rub, "0.01"),
        _money(row.limit_rub, "0.01"),
        _money(row.remaining_rub, "0.01"),
        "—" if row.provider_cost_usd is None else _money(row.provider_cost_usd, "0.0001"),
    )


def print_report(rows: list[ReportRow]) -> None:
    table = [_COLUMNS, *(_cells(row) for row in rows)]
    widths = [max(len(line[i]) for line in table) for i in range(len(_COLUMNS))]
    for line in table:
        print("  ".join(cell.ljust(width) for cell, width in zip(line, widths, strict=True)).rstrip())


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m admin")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("report", help="spending of every user in the current period")
    change = commands.add_parser("set-plan", help="move a user to another plan; the period stays")
    change.add_argument("email")
    change.add_argument("plan")
    args = parser.parse_args(argv)

    now = datetime.now(UTC)
    if args.command == "report":
        # An ended paid period is settled with Tochka first, as the page «Тариф» would do.
        with get_engine().begin() as connection, connect(tochka_settings()) as tochka:
            rows = report(connection, now, lambda c, user_id, at: settled_subscription(c, user_id, at, tochka))
        print_report(rows)
        return 0
    try:
        with get_engine().begin() as connection:
            subscription = set_plan(connection, user_id_by_email(connection, args.email), args.plan)
    except (LookupError, UnknownPlan, NoSubscription) as refusal:
        print(f"set-plan: {refusal}", file=sys.stderr)
        return 1
    print(
        f"{args.email}: тариф {subscription.plan}, период "
        f"{subscription.period_start:%Y-%m-%d %H:%M} — {subscription.period_end:%Y-%m-%d %H:%M} UTC."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

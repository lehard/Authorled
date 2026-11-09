"""python -m demo: reads the development users as JSON from stdin, `./scripts/dev.sh seed` passes them."""

import json
import sys

import billing
from core.engine import get_engine
from core.users import get_or_create_user
from demo.load import DemoExists, SchemaBehind, ensure_migrated, load_demo


def main() -> int:
    people = json.load(sys.stdin)
    try:
        with get_engine().begin() as connection:
            ensure_migrated(connection)
            made = [
                (person["email"], get_or_create_user(connection, person["subject"], person["email"], person["name"]))
                for person in people
            ]
            accounts = {email: account.id for email, account in made}
            stories = load_demo(connection, accounts)
        # Subscriptions come from billing, as at a sign-in (GET /api/v1/me), once the stories are in.
        for _, account in made:
            billing.ensure_subscription(account.id, account.created_at)
    except (DemoExists, SchemaBehind) as refusal:
        print(f"seed: {refusal}", file=sys.stderr)
        return 1
    print(f"Демо-истории загружены: {stories} у каждого из {', '.join(accounts)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

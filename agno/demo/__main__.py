"""python -m demo: reads the development users as JSON from stdin, `./scripts/dev.sh seed` passes them."""

import json
import sys

from core.engine import get_engine
from core.users import get_or_create_user
from demo.load import DemoExists, SchemaBehind, ensure_migrated, load_demo


def main() -> int:
    people = json.load(sys.stdin)
    try:
        with get_engine().begin() as connection:
            ensure_migrated(connection)
            accounts = {
                person["email"]: get_or_create_user(connection, person["subject"], person["email"], person["name"]).id
                for person in people
            }
            stories = load_demo(connection, accounts)
    except (DemoExists, SchemaBehind) as refusal:
        print(f"seed: {refusal}", file=sys.stderr)
        return 1
    print(f"Демо-истории загружены: {stories} у каждого из {', '.join(accounts)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

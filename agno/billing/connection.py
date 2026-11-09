"""Database URL of the billing module from the DB_* variables (openspec/specs/architecture).

The billing module imports nothing of the core (openspec/specs/billing/module), so it builds the URL itself, with the
same required variables and refusals as the core. Moved into its own service, it gets its own variables here.
"""

from os import environ

from sqlalchemy.engine import URL

REQUIRED_DB_VARS = ("DB_DRIVER", "DB_USER", "DB_PASS", "DB_HOST", "DB_PORT", "DB_DATABASE")


def build_db_url() -> str:
    """Build the database URL; a missing variable or a port that is not a number is an error naming it."""
    missing = [name for name in REQUIRED_DB_VARS if not environ.get(name)]
    if missing:
        raise RuntimeError(f"Required environment variable(s) not set: {', '.join(missing)}")
    port = environ["DB_PORT"]
    if not port.isdigit():
        raise RuntimeError(f"DB_PORT must be an integer, got {port!r}")
    return URL.create(
        drivername=environ["DB_DRIVER"],
        username=environ["DB_USER"],
        password=environ["DB_PASS"],
        host=environ["DB_HOST"],
        port=int(port),
        database=environ["DB_DATABASE"],
    ).render_as_string(hide_password=False)

"""PostgreSQL connection configuration."""

from os import environ

from sqlalchemy.engine import URL

REQUIRED_DB_VARS = ("DB_DRIVER", "DB_USER", "DB_PASS", "DB_HOST", "DB_PORT", "DB_DATABASE")


def _required(name: str) -> str:
    value = environ.get(name)
    if not value:
        raise RuntimeError(f"Required environment variable {name} is not set")
    return value


def build_db_url() -> str:
    """Build database URL from required environment variables."""
    missing = [name for name in REQUIRED_DB_VARS if not environ.get(name)]
    if missing:
        raise RuntimeError(f"Required environment variable(s) not set: {', '.join(missing)}")
    port = _required("DB_PORT")
    if not port.isdigit():
        raise RuntimeError(f"DB_PORT must be an integer, got {port!r}")
    return URL.create(
        drivername=_required("DB_DRIVER"),
        username=_required("DB_USER"),
        password=_required("DB_PASS"),
        host=_required("DB_HOST"),
        port=int(port),
        database=_required("DB_DATABASE"),
    ).render_as_string(hide_password=False)


db_url = build_db_url()

"""The connection pool of the billing module: the same database and role as the core, its own pool."""

from functools import cache

from sqlalchemy import Engine, create_engine

from billing.connection import build_db_url


@cache
def get_engine() -> Engine:
    """One engine per process, created on first use from the DB_* variables."""
    return create_engine(build_db_url(), pool_size=2, pool_pre_ping=True)

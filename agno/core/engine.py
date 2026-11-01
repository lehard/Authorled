"""The connection pool of the product core: the same database and role as Agno, its own pool."""

from functools import cache

from sqlalchemy import Engine, create_engine

from core.connection import build_db_url


@cache
def get_engine() -> Engine:
    """One engine per process, created on first use from the DB_* variables."""
    return create_engine(build_db_url(), pool_size=5, pool_pre_ping=True)

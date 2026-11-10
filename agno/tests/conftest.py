"""Core tests run on the fresh test database that ./scripts/dev.sh test prepares and migrates:
ai_test in the main checkout, ai_test_<worktree> in a worktree (openspec/specs/core/database)."""

import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.engine import make_url

from core.connection import build_db_url

# Fixtures of the route tests: client, authors.
pytest_plugins = ["tests.routes"]

TEST_DATABASE = re.compile(r"ai_test(_[a-z0-9_]+)?")
ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
BILLING_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "billing" / "alembic.ini"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = build_db_url()
    database = make_url(url).database
    if database is None or TEST_DATABASE.fullmatch(database) is None:
        raise RuntimeError(
            f"Core tests run only on ai_test or ai_test_<worktree>, DB_DATABASE is {database!r}: "
            "use ./scripts/dev.sh test"
        )
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def connection(engine: Engine) -> Iterator[Connection]:
    """A connection whose transaction is rolled back after the test, so tests do not see each other's rows."""
    with engine.connect() as connection:
        transaction = connection.begin()
        yield connection
        transaction.rollback()


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    return Config(str(ALEMBIC_INI))


@pytest.fixture(scope="session")
def billing_alembic_config() -> Config:
    return Config(str(BILLING_ALEMBIC_INI))


@pytest.fixture(scope="session", autouse=True)
def project_access() -> None:
    """The source of project access the API registers at startup (app/main.py), once per test process."""
    from app.auth import set_project_access_source
    from core.projects import ProjectAccess

    set_project_access_source(ProjectAccess())

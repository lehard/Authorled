"""Migrations of schema authorled (openspec/specs/core/database)."""

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, Engine, text

from core.tables import SCHEMA, metadata


def _current_revision(engine: Engine) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection, opts={"version_table_schema": SCHEMA}).get_current_revision()


def test_one_head(alembic_config: Config) -> None:
    assert len(ScriptDirectory.from_config(alembic_config).get_heads()) == 1


def test_database_is_at_head(engine: Engine, alembic_config: Config) -> None:
    assert _current_revision(engine) == ScriptDirectory.from_config(alembic_config).get_current_head()


def test_upgrade_again_changes_nothing(engine: Engine, alembic_config: Config) -> None:
    before = _current_revision(engine)
    command.upgrade(alembic_config, "head")
    assert _current_revision(engine) == before


def test_tables_match_the_database(connection: Connection) -> None:
    context = MigrationContext.configure(
        connection,
        opts={
            "include_schemas": True,
            "include_name": lambda name, type_, parent: type_ != "schema" or name == SCHEMA,
            "version_table_schema": SCHEMA,
        },
    )
    assert compare_metadata(context, metadata) == []


def test_schema_belongs_to_agentos(connection: Connection) -> None:
    owner = connection.execute(
        text("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = :schema"), {"schema": SCHEMA}
    ).scalar_one()
    assert owner == "agentos"


def test_product_tables_stay_in_their_schema(connection: Connection) -> None:
    rows = connection.execute(
        text(
            "SELECT table_schema, table_name FROM information_schema.tables"
            " WHERE table_name IN ('users', 'user_settings', 'alembic_version')"
        )
    ).all()
    assert sorted(rows) == [(SCHEMA, "alembic_version"), (SCHEMA, "user_settings"), (SCHEMA, "users")]

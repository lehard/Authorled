"""Alembic environment of the billing module: only schema `billing`, its own version table, the URL from DB_*."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from billing.connection import build_db_url
from billing.tables import SCHEMA, metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def include_name(name: str | None, type_: str, parent_names: object) -> bool:
    """Compare and migrate schema `billing` only; the core, Agno and Authentik own the other schemas."""
    if type_ == "schema":
        return name == SCHEMA
    return True


def run_migrations_online() -> None:
    engine = create_engine(build_db_url())
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=metadata,
            version_table_schema=SCHEMA,
            include_schemas=True,
            include_name=include_name,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise RuntimeError("Offline migrations are not supported; run `alembic upgrade head` against the database")
run_migrations_online()

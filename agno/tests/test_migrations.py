"""Migrations of schema authorled (openspec/specs/core/database)."""

import uuid

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, Engine, delete, func, insert, select, text

from core.tables import SCHEMA, documents, metadata, projects, users


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
    names = [table.name for table in metadata.sorted_tables] + ["alembic_version"]
    rows = connection.execute(
        text("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = ANY(:names)"),
        {"names": names},
    ).all()
    assert sorted(rows) == sorted((SCHEMA, name) for name in names)


def test_drafts_migration_clears_stories_and_keeps_users(engine: Engine, alembic_config: Config) -> None:
    """Applied from 0005 on a database with a user and a story; head is restored for the other tests."""
    head = ScriptDirectory.from_config(alembic_config).get_current_head()
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE authorled.document_versions, authorled.draft_points, authorled.draft_opens"))
        connection.execute(
            text("DROP TABLE authorled.document_versions, authorled.draft_points, authorled.draft_opens")
        )
        connection.execute(text("DELETE FROM authorled.projects"))
        connection.execute(text("DROP INDEX authorled.ix_documents_one_script"))
        connection.execute(text("DROP INDEX authorled.ix_documents_draft_id_kind_position"))
        connection.execute(text("ALTER TABLE authorled.documents DROP CONSTRAINT ck_documents_ck_documents_kind_known"))
        connection.execute(text("ALTER TABLE authorled.documents DROP COLUMN draft_id, DROP COLUMN updated_by"))
        connection.execute(text("ALTER TABLE authorled.screenplay_texts DROP COLUMN updated_by"))
        connection.execute(text("DROP TABLE authorled.drafts"))
        connection.execute(
            text(
                "ALTER TABLE authorled.documents ADD CONSTRAINT ck_documents_ck_documents_kind_known "
                "CHECK (kind IN ('script', 'character', 'location', 'world', 'draft'))"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX ix_documents_project_id_kind_position ON authorled.documents (project_id, kind, position)"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX ix_documents_one_script ON authorled.documents (project_id) WHERE kind = 'script'"
            )
        )
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0005_files'"))
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email=f"{subject}@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        project = connection.execute(
            insert(projects).values(owner_id=owner, title="Демо", format="feature").returning(projects.c.id)
        ).scalar_one()
        connection.execute(
            text(
                "INSERT INTO authorled.documents (project_id, kind, name, position) "
                "VALUES (:project, 'script', 'Демо', 0), (:project, 'draft', 'Старый', 0)"
            ),
            {"project": project},
        )
    command.upgrade(alembic_config, "head")
    assert _current_revision(engine) == head
    with engine.begin() as connection:
        assert connection.execute(select(func.count()).select_from(projects)).scalar_one() == 0
        assert connection.execute(select(func.count()).select_from(documents)).scalar_one() == 0
        assert connection.execute(delete(users).where(users.c.id == owner)).rowcount == 1

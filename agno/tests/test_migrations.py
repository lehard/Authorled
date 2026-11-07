"""Migrations of schema authorled (openspec/specs/core/database)."""

import uuid
from datetime import UTC, datetime

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, Engine, delete, func, insert, select, text, update

from core.documents import create_documents, document_row
from core.documents import update_document as change
from core.projects import create_project
from core.saves import create_point, restore_point, restore_version
from core.tables import (
    SCHEMA,
    document_versions,
    documents,
    draft_points,
    metadata,
    notes,
    projects,
    subscriptions,
    users,
)


def _drop_subscriptions(connection: Connection) -> None:
    """Undo 0010 and 0009 before a test rewinds the schema to an older revision."""
    connection.execute(text("DROP TABLE authorled.payments, authorled.billing_checkouts"))
    connection.execute(text("DROP TABLE authorled.usage_records, authorled.subscriptions"))


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
        _drop_subscriptions(connection)
        connection.execute(text("DROP TABLE authorled.notes"))
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
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        assert connection.execute(delete(users).where(users.c.id == owner)).rowcount == 1


def test_script_fields_migration_keeps_stories_and_rollback(engine: Engine, alembic_config: Config) -> None:
    """Applied from 0006 on states of the old form; the migration changes data only."""
    subject = f"test-{uuid.uuid4()}"
    show = {"title": True, "synopsis": False, "treatment": True, "text": True}
    old = {"tagline": "Фраза", "logline": "О воде", "show": show}
    with engine.begin() as connection:
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email=f"{subject}@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        project, draft, script = create_project(connection, owner, "Маяк")
        no_parts, _, plain = create_project(connection, owner, "Паром")
        (vera,) = create_documents(
            connection,
            draft,
            [{"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "вода"}}],
            owner,
        )
        connection.execute(update(documents).where(documents.c.id == script).values(name="Маяк", fields=old))
        connection.execute(update(documents).where(documents.c.id == plain).values(fields={"tagline": "Рейс"}))
        point = create_point(connection, draft, "До правки", owner)
        version, vera_version = connection.execute(
            insert(document_versions)
            .values(
                [
                    {
                        "document_id": document,
                        "part": "fields",
                        "content": {"name": name, "role": None, "summary": "", "fields": fields},
                        "reason": "auto",
                        "saved_by": owner,
                        "saved_at": func.now(),
                    }
                    for document, name, fields in ((script, "Маяк", old), (vera.id, "Вера", {"tagline": "чужое"}))
                ]
            )
            .returning(document_versions.c.id)
        ).scalars()
        _drop_subscriptions(connection)
        connection.execute(text("DROP TABLE authorled.notes"))
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0006_drafts_and_saves'"))

    command.upgrade(alembic_config, "head")

    new = {"logline": "О воде", "show": {**show, "logline": True}}
    with engine.begin() as connection:
        document = document_row(connection, script)
        assert (document.name, document.fields, document.revision) == ("Сценарий", new, 1)
        assert document_row(connection, plain).fields == {}
        assert document_row(connection, vera.id).fields == {"fear": "вода"}

        def saved(version_id: uuid.UUID) -> dict[str, object]:
            query = select(document_versions.c.content).where(document_versions.c.id == version_id)
            return connection.execute(query).scalar_one()

        assert (saved(version)["name"], saved(version)["fields"]) == ("Сценарий", new)
        assert saved(vera_version)["fields"] == {"tagline": "чужое"}
        content = connection.execute(select(draft_points.c.content).where(draft_points.c.id == point.id)).scalar_one()
        states = {state["kind"]: state for state in content["documents"]}
        assert states["script"]["fields"] == new and states["character"]["name"] == "Вера"

        restored = restore_version(connection, version, 1, owner)
        assert (
            change(connection, script, restored, {"fields": {"logline": "Новый"}}, owner).fields["logline"] == "Новый"
        )
        restore_point(connection, point.id, owner)
        revision = document_row(connection, script).revision
        assert change(connection, script, revision, {"fields": {"logline": "После"}}, owner).name == "Сценарий"

        connection.execute(delete(projects).where(projects.c.id.in_((project.id, no_parts.id))))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        assert connection.execute(delete(users).where(users.c.id == owner)).rowcount == 1


def test_notes_migration_keeps_stories(engine: Engine, alembic_config: Config) -> None:
    """Applied from 0007 on a database with a story; the new table comes empty."""
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="notes@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        story, _, script = create_project(connection, owner, "Маяк")
        _drop_subscriptions(connection)
        connection.execute(text("DROP TABLE authorled.notes"))
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0007_script_fields'"))

    command.upgrade(alembic_config, "head")

    with engine.begin() as connection:
        assert connection.execute(select(func.count()).select_from(notes)).scalar_one() == 0
        assert document_row(connection, script).project_id == story.id
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(delete(users).where(users.c.id == owner))


def test_subscriptions_migration_gives_users_beta(engine: Engine, alembic_config: Config) -> None:
    """Applied from 0008: every user outside the trash gets beta with the first period from the creation."""
    subject, gone = f"test-{uuid.uuid4()}", f"test-{uuid.uuid4()}"
    created = datetime(2026, 10, 31, 10, tzinfo=UTC)
    with engine.begin() as connection:
        _drop_subscriptions(connection)
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0008_notes'"))
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="old@authorled.test", display_name="Автор", created_at=created)
            .returning(users.c.id)
        ).scalar_one()
        deleted = connection.execute(
            insert(users)
            .values(auth_subject=gone, email="gone@authorled.test", display_name="Автор", deleted_at=created)
            .returning(users.c.id)
        ).scalar_one()

    command.upgrade(alembic_config, "head")

    with engine.begin() as connection:
        rows = connection.execute(select(subscriptions).where(subscriptions.c.user_id.in_([owner, deleted]))).all()
        assert [(row.user_id, row.plan, row.source, row.status) for row in rows] == [
            (owner, "beta", "granted", "active")
        ]
        assert (rows[0].started_at, rows[0].period_start) == (created, created)
        assert rows[0].period_end == datetime(2026, 11, 30, 10, tzinfo=UTC)
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(users).where(users.c.id.in_([owner, deleted])))

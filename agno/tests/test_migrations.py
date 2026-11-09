"""Migrations of schemas authorled and billing (openspec/specs/core/database, openspec/specs/billing/module)."""

import uuid
from datetime import UTC, datetime

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, Engine, delete, func, insert, select, text, update

from billing.tables import SCHEMA as BILLING_SCHEMA
from billing.tables import metadata as billing_metadata
from billing.tables import subscriptions, usage_records
from core.documents import create_documents, document_row
from core.documents import update_document as change
from core.projects import create_project
from core.saves import create_point, restore_point, restore_version
from core.tables import (
    SCHEMA,
    comment_messages,
    comment_threads,
    document_versions,
    documents,
    draft_points,
    files,
    metadata,
    notes,
    projects,
    user_settings,
    users,
    writing_progress,
)


def _undo_coauthor_actions(connection: Connection) -> None:
    """Undo 0010 before a test rewinds the schema to an older revision."""
    connection.execute(text("ALTER TABLE authorled.user_settings DROP COLUMN coauthor_mode"))
    connection.execute(text("ALTER TABLE authorled.comment_threads DROP COLUMN scene_uid"))
    connection.execute(text("DELETE FROM authorled.comment_messages WHERE author_kind = 'coauthor'"))
    connection.execute(text("ALTER TABLE authorled.comment_messages DROP COLUMN author_kind"))
    connection.execute(text("ALTER TABLE authorled.comment_messages ALTER COLUMN author_id SET NOT NULL"))
    connection.execute(text("DELETE FROM authorled.document_versions WHERE reason = 'coauthor'"))
    connection.execute(
        text("ALTER TABLE authorled.document_versions DROP CONSTRAINT ck_document_versions_reason_known")
    )
    connection.execute(
        text(
            # The name 0006 gave it: Alembic prefixed the full name once more by the naming convention.
            "ALTER TABLE authorled.document_versions ADD CONSTRAINT "
            "ck_document_versions_ck_document_versions_reason_known "
            "CHECK (reason IN ('auto', 'suggestion', 'import', 'restore'))"
        )
    )


def _undo_note_files(connection: Connection) -> None:
    """Undo 0015 before a test rewinds the schema to an older revision."""
    connection.execute(text("ALTER TABLE authorled.notes DROP COLUMN file_id"))
    connection.execute(text("DELETE FROM authorled.files WHERE purpose = 'note'"))
    # The name 0005 gave it: Alembic prefixed the full name once more by the naming convention.
    connection.execute(text("ALTER TABLE authorled.files DROP CONSTRAINT ck_files_ck_files_purpose_known"))
    connection.execute(
        text(
            "ALTER TABLE authorled.files ADD CONSTRAINT ck_files_ck_files_purpose_known "
            "CHECK (purpose IN ('chat', 'import'))"
        )
    )


def _undo_story_cover_colors(connection: Connection) -> None:
    """Undo 0014 before a test rewinds the schema to an older revision."""
    connection.execute(text("ALTER TABLE authorled.projects DROP COLUMN cover_color"))


def _undo_writing_goals(connection: Connection) -> None:
    """Undo 0013 before a test rewinds the schema to an older revision."""
    connection.execute(text("DROP TABLE authorled.writing_progress"))
    connection.execute(text("ALTER TABLE authorled.projects DROP COLUMN goal_deadline, DROP COLUMN word_goal"))
    connection.execute(text("ALTER TABLE authorled.user_settings DROP COLUMN daily_word_goal"))


def _undo_coauthor_feedback(connection: Connection) -> None:
    """Undo 0012 before a test rewinds the schema to an older revision."""
    connection.execute(text("DROP TABLE authorled.coauthor_feedback"))


def _undo_beta_requests(connection: Connection) -> None:
    """Undo 0011 before a test rewinds the schema to an older revision."""
    connection.execute(text("DROP TABLE authorled.beta_requests"))


def _drop_subscriptions(connection: Connection) -> None:
    """Undo 0015, 0014, 0013, 0012, 0011, 0010 and 0009 before a test rewinds the core to an older revision.

    The tables of 0009 live in schema billing after b0001_from_core, so the billing chain is rewound to its base too;
    `_upgrade` brings both chains back to head.
    """
    _undo_note_files(connection)
    _undo_story_cover_colors(connection)
    _undo_writing_goals(connection)
    _undo_coauthor_feedback(connection)
    _undo_beta_requests(connection)
    _undo_coauthor_actions(connection)
    connection.execute(text("DROP TABLE billing.usage_records, billing.subscriptions"))
    connection.execute(text("DELETE FROM billing.alembic_version"))


def _upgrade(alembic_config: Config, billing_alembic_config: Config) -> None:
    """The migration step: the core, then billing (openspec/specs/billing/module, «Миграции биллинга»)."""
    command.upgrade(alembic_config, "head")
    command.upgrade(billing_alembic_config, "head")


def _current_revision(engine: Engine, schema: str = SCHEMA) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection, opts={"version_table_schema": schema}).get_current_revision()


def test_one_head(alembic_config: Config, billing_alembic_config: Config) -> None:
    assert len(ScriptDirectory.from_config(alembic_config).get_heads()) == 1
    assert len(ScriptDirectory.from_config(billing_alembic_config).get_heads()) == 1


def test_database_is_at_head(engine: Engine, alembic_config: Config, billing_alembic_config: Config) -> None:
    assert _current_revision(engine) == ScriptDirectory.from_config(alembic_config).get_current_head()
    assert (
        _current_revision(engine, BILLING_SCHEMA)
        == ScriptDirectory.from_config(billing_alembic_config).get_current_head()
    )


def test_upgrade_again_changes_nothing(engine: Engine, alembic_config: Config, billing_alembic_config: Config) -> None:
    before = (_current_revision(engine), _current_revision(engine, BILLING_SCHEMA))
    _upgrade(alembic_config, billing_alembic_config)
    assert (_current_revision(engine), _current_revision(engine, BILLING_SCHEMA)) == before


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


def test_billing_tables_match_the_database(connection: Connection) -> None:
    context = MigrationContext.configure(
        connection,
        opts={
            "include_schemas": True,
            "include_name": lambda name, type_, parent: type_ != "schema" or name == BILLING_SCHEMA,
            "version_table_schema": BILLING_SCHEMA,
        },
    )
    assert compare_metadata(context, billing_metadata) == []


def test_schema_belongs_to_agentos(connection: Connection) -> None:
    for schema in (SCHEMA, BILLING_SCHEMA):
        owner = connection.execute(
            text("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = :schema"), {"schema": schema}
        ).scalar_one()
        assert owner == "agentos"


def test_product_tables_stay_in_their_schema(connection: Connection) -> None:
    expected = [(SCHEMA, table.name) for table in metadata.sorted_tables]
    expected += [(BILLING_SCHEMA, table.name) for table in billing_metadata.sorted_tables]
    expected += [(SCHEMA, "alembic_version"), (BILLING_SCHEMA, "alembic_version")]
    rows = connection.execute(
        text("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = ANY(:names)"),
        {"names": sorted({name for _, name in expected})},
    ).all()
    assert sorted(rows) == sorted(expected)


def test_drafts_migration_clears_stories_and_keeps_users(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
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
    _upgrade(alembic_config, billing_alembic_config)
    assert _current_revision(engine) == head
    with engine.begin() as connection:
        assert connection.execute(select(func.count()).select_from(projects)).scalar_one() == 0
        assert connection.execute(select(func.count()).select_from(documents)).scalar_one() == 0
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        assert connection.execute(delete(users).where(users.c.id == owner)).rowcount == 1


def test_script_fields_migration_keeps_stories_and_rollback(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
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

    _upgrade(alembic_config, billing_alembic_config)

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


def test_notes_migration_keeps_stories(engine: Engine, alembic_config: Config, billing_alembic_config: Config) -> None:
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

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        assert connection.execute(select(func.count()).select_from(notes)).scalar_one() == 0
        assert document_row(connection, script).project_id == story.id
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(delete(users).where(users.c.id == owner))


def test_subscriptions_migration_gives_users_beta(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
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

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        rows = connection.execute(select(subscriptions).where(subscriptions.c.user_id.in_([owner, deleted]))).all()
        assert [(row.user_id, row.plan, row.source, row.status) for row in rows] == [
            (owner, "beta", "granted", "active")
        ]
        assert (rows[0].started_at, rows[0].period_start) == (created, created)
        assert rows[0].period_end == datetime(2026, 11, 30, 10, tzinfo=UTC)
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(users).where(users.c.id.in_([owner, deleted])))


def test_coauthor_actions_migration_keeps_settings_and_comments(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
    """Applied from 0009: settings so far get `ask`, messages so far are written by users."""
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        # The story is made by the code of today, before the schema goes back: later migrations add its columns.
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="mode@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        story, _, script = create_project(connection, owner, "Маяк")
        _undo_note_files(connection)
        _undo_story_cover_colors(connection)
        _undo_writing_goals(connection)
        _undo_coauthor_feedback(connection)
        _undo_beta_requests(connection)
        _undo_coauthor_actions(connection)
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0009_subscriptions_usage'"))
        connection.execute(text("INSERT INTO authorled.user_settings (user_id) VALUES (:id)"), {"id": owner})
        thread = uuid.uuid4()
        connection.execute(
            text("INSERT INTO authorled.comment_threads (id, document_id, quote) VALUES (:id, :doc, 'Вера')"),
            {"id": thread, "doc": script},
        )
        connection.execute(
            text(
                "INSERT INTO authorled.comment_messages (thread_id, author_id, author_role, body) "
                "VALUES (:thread, :owner, '', 'Слишком прямо')"
            ),
            {"thread": thread, "owner": owner},
        )

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        assert (
            connection.execute(
                select(user_settings.c.coauthor_mode).where(user_settings.c.user_id == owner)
            ).scalar_one()
            == "ask"
        )
        message = connection.execute(select(comment_messages).where(comment_messages.c.thread_id == thread)).one()
        assert (message.author_kind, message.author_id) == ("user", owner)
        assert (
            connection.execute(select(comment_threads.c.scene_uid).where(comment_threads.c.id == thread)).scalar_one()
            is None
        )
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(delete(user_settings).where(user_settings.c.user_id == owner))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(users).where(users.c.id == owner))


def test_writing_goals_migration_leaves_goals_empty(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
    """Applied from 0012 on a user with settings and a story: the goals come empty, the journal comes empty."""
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="goals@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        connection.execute(insert(user_settings).values(user_id=owner, theme="dark"))
        story, _, _ = create_project(connection, owner, "Маяк")
        _undo_note_files(connection)
        _undo_story_cover_colors(connection)
        _undo_writing_goals(connection)
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0012_coauthor_feedback'"))

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        settings = connection.execute(select(user_settings).where(user_settings.c.user_id == owner)).one()
        assert (settings.theme, settings.daily_word_goal) == ("dark", None)
        project = connection.execute(select(projects).where(projects.c.id == story.id)).one()
        assert (project.title, project.word_goal, project.goal_deadline) == ("Маяк", None, None)
        assert connection.execute(select(func.count()).select_from(writing_progress)).scalar_one() == 0
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(delete(user_settings).where(user_settings.c.user_id == owner))
        connection.execute(delete(users).where(users.c.id == owner))


def test_billing_move_keeps_rows(engine: Engine, billing_alembic_config: Config) -> None:
    """b0001_from_core on tables of the core with rows: same identifiers in billing, nothing left in authorled."""
    with engine.begin() as connection:
        # Rewind billing to its base: the tables go back to the core with their keys to users, as 0009 made them.
        connection.execute(text("ALTER TABLE billing.subscriptions SET SCHEMA authorled"))
        connection.execute(text("ALTER TABLE billing.usage_records SET SCHEMA authorled"))
        connection.execute(text("DELETE FROM billing.alembic_version"))
        owner = connection.execute(
            insert(users)
            .values(auth_subject=f"test-{uuid.uuid4()}", email="move@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        user_id = owner
        subscription = connection.execute(
            text(
                "INSERT INTO authorled.subscriptions (user_id, plan, source, status, started_at, period_start, "
                "period_end) VALUES (:user, 'beta', 'granted', 'active', now(), now(), now() + interval '1 month') "
                "RETURNING id"
            ),
            {"user": user_id},
        ).scalar_one()
        record = connection.execute(
            text(
                "INSERT INTO authorled.usage_records (user_id, subscription_id, run_id, session_id, agent_id, model, "
                "run_status, input_tokens, cache_read_tokens, output_tokens, cost_rub, occurred_at) VALUES "
                "(:user, :subscription, :run, 'p:d:c', 'coauthor', 'deepseek-fast', 'completed', 10, 4, 2, 0.1, now()) "
                "RETURNING id"
            ),
            {"user": user_id, "subscription": subscription, "run": f"move-{user_id}"},
        ).scalar_one()
        for table in ("subscriptions", "usage_records"):
            connection.execute(
                text(
                    f"ALTER TABLE authorled.{table} ADD CONSTRAINT fk_{table}_user_id_users "
                    # NOT VALID: rows of other tests keep users of the core by value only.
                    "FOREIGN KEY (user_id) REFERENCES authorled.users (id) ON DELETE RESTRICT NOT VALID"
                )
            )
        before = {
            table: connection.execute(text(f"SELECT count(*) FROM authorled.{table}")).scalar_one()
            for table in ("subscriptions", "usage_records")
        }

    command.upgrade(billing_alembic_config, "head")

    with engine.begin() as connection:
        assert connection.execute(select(subscriptions.c.user_id).where(subscriptions.c.id == subscription)).one()
        assert connection.execute(select(usage_records.c.run_id).where(usage_records.c.id == record)).scalar_one() == (
            f"move-{user_id}"
        )
        after = {
            "subscriptions": connection.execute(select(func.count()).select_from(subscriptions)).scalar_one(),
            "usage_records": connection.execute(select(func.count()).select_from(usage_records)).scalar_one(),
        }
        assert after == before
        left = connection.execute(
            text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'authorled' "
                "AND table_name IN ('subscriptions', 'usage_records')"
            )
        ).all()
        assert left == []
        # Without the key to users the account goes without touching billing.
        connection.execute(delete(users).where(users.c.id == user_id))
        connection.execute(delete(usage_records).where(usage_records.c.id == record))
        connection.execute(delete(subscriptions).where(subscriptions.c.id == subscription))


def test_cover_colors_migration_colours_stories_in_turn(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
    """Applied from 0013: each author's stories take the colours in the order of creation, from blue."""
    subjects = [f"test-{uuid.uuid4()}" for _ in range(2)]
    with engine.begin() as connection:
        _undo_note_files(connection)
        _undo_story_cover_colors(connection)
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0013_writing_goals'"))
        first, second = (
            connection.execute(
                insert(users)
                .values(auth_subject=subject, email=f"{subject}@authorled.test", display_name="Автор")
                .returning(users.c.id)
            ).scalar_one()
            for subject in subjects
        )
        stories = {}
        for owner, title, day in [(first, "Паром", 2), (first, "Маяк", 1), (second, "Дача", 3)]:
            stories[title] = connection.execute(
                text(
                    "INSERT INTO authorled.projects (owner_id, title, format, created_at) "
                    "VALUES (:owner, :title, 'feature', :created) RETURNING id"
                ),
                {"owner": owner, "title": title, "created": datetime(2026, 11, day, tzinfo=UTC)},
            ).scalar_one()

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        colors = dict(
            connection.execute(
                select(projects.c.title, projects.c.cover_color).where(projects.c.owner_id.in_([first, second]))
            ).all()
        )
        assert colors == {"Маяк": "blue", "Паром": "teal", "Дача": "blue"}
        connection.execute(delete(projects).where(projects.c.id.in_(stories.values())))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id.in_([first, second])))
        connection.execute(delete(users).where(users.c.id.in_([first, second])))


def test_billing_move_needs_the_core_first(engine: Engine, billing_alembic_config: Config) -> None:
    """Without the tables of 0009 in authorled the first billing migration stops and names what to apply."""
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM billing.alembic_version"))
    try:
        with pytest.raises(RuntimeError, match="authorled.subscriptions, authorled.usage_records not found"):
            command.upgrade(billing_alembic_config, "head")
    finally:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO billing.alembic_version (version_num) VALUES ('b0001_from_core')"))


def test_note_files_migration_keeps_notes_and_files(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
    """Applied from 0014 on a database with a note and a chat file: notes get no original, files stay."""
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        _undo_note_files(connection)
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0014_story_cover_colors'"))
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="note-files@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        story, _, _ = create_project(connection, owner, "Маяк")
        note = connection.execute(
            insert(notes).values(project_id=story.id, title="Финал", updated_by=owner).returning(notes.c.id)
        ).scalar_one()
        chat_file = connection.execute(
            insert(files)
            .values(
                project_id=story.id,
                uploaded_by=owner,
                purpose="chat",
                session_id=f"{story.id}:x",
                name="эпоха.txt",
                media_type="text/plain; charset=utf-8",
                size_bytes=5,
                sha256="0" * 64,
                text_content="Эпоха",
            )
            .returning(files.c.id)
        ).scalar_one()

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        assert connection.execute(select(notes.c.file_id).where(notes.c.id == note)).scalar_one() is None
        kept = connection.execute(select(files).where(files.c.id == chat_file)).one()
        assert (kept.purpose, kept.name, kept.text_content) == ("chat", "эпоха.txt", "Эпоха")
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
        connection.execute(delete(users).where(users.c.id == owner))

"""Drafts of a story, snapshots of documents and points of a draft; stories are cleared.

There are no users yet, only demo content, so the stories are deleted, not carried over
(openspec/changes/story-drafts-and-saves, design, decision 14).

Revision ID: 0006_drafts_and_saves
Revises: 0005_files
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_drafts_and_saves"
down_revision: str | None = "0005_files"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _users_fk(table: str, column: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        [column], ["authorled.users.id"], name=f"fk_{table}_{column}_users", ondelete="RESTRICT"
    )


def upgrade() -> None:
    op.execute("DELETE FROM authorled.projects")

    op.create_table(
        "drafts",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("locked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("forked_from_id", sa.Uuid(), nullable=True),
        sa.Column("forked_from_name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_drafts"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["authorled.projects.id"], name="fk_drafts_project_id_projects", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["forked_from_id"], ["authorled.drafts.id"], name="fk_drafts_forked_from_id_drafts", ondelete="SET NULL"
        ),
        sa.UniqueConstraint("id", "project_id", name="uq_drafts_id"),
        sa.CheckConstraint("name <> ''", name="ck_drafts_name_not_empty"),
        schema="authorled",
    )
    op.create_index("ix_drafts_project_id", "drafts", ["project_id"], schema="authorled")

    op.drop_index("ix_documents_one_script", table_name="documents", schema="authorled")
    op.drop_index("ix_documents_project_id_kind_position", table_name="documents", schema="authorled")
    op.drop_constraint("ck_documents_kind_known", "documents", schema="authorled", type_="check")
    op.add_column("documents", sa.Column("draft_id", sa.Uuid(), nullable=False), schema="authorled")
    op.add_column("documents", sa.Column("updated_by", sa.Uuid(), nullable=False), schema="authorled")
    op.create_foreign_key(
        "fk_documents_draft_id_drafts",
        "documents",
        "drafts",
        ["draft_id", "project_id"],
        ["id", "project_id"],
        source_schema="authorled",
        referent_schema="authorled",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_documents_updated_by_users",
        "documents",
        "users",
        ["updated_by"],
        ["id"],
        source_schema="authorled",
        referent_schema="authorled",
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_documents_kind_known",
        "documents",
        "kind IN ('script', 'character', 'location', 'world')",
        schema="authorled",
    )
    op.create_index(
        "ix_documents_draft_id_kind_position", "documents", ["draft_id", "kind", "position"], schema="authorled"
    )
    op.create_index(
        "ix_documents_one_script",
        "documents",
        ["draft_id"],
        unique=True,
        schema="authorled",
        postgresql_where=sa.text("kind = 'script'"),
    )

    op.add_column("screenplay_texts", sa.Column("updated_by", sa.Uuid(), nullable=False), schema="authorled")
    op.create_foreign_key(
        "fk_screenplay_texts_updated_by_users",
        "screenplay_texts",
        "users",
        ["updated_by"],
        ["id"],
        source_schema="authorled",
        referent_schema="authorled",
        ondelete="RESTRICT",
    )

    op.create_table(
        "document_versions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("part", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("saved_by", sa.Uuid(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_document_versions"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["authorled.documents.id"],
            name="fk_document_versions_document_id_documents",
            ondelete="CASCADE",
        ),
        _users_fk("document_versions", "saved_by"),
        sa.CheckConstraint("part IN ('text', 'fields')", name="ck_document_versions_part_known"),
        sa.CheckConstraint(
            "reason IN ('auto', 'suggestion', 'import', 'restore')", name="ck_document_versions_reason_known"
        ),
        sa.CheckConstraint("jsonb_typeof(content) = 'object'", name="ck_document_versions_content_object"),
        schema="authorled",
    )
    op.create_index(
        "ix_document_versions_document_id_part_created_at",
        "document_versions",
        ["document_id", "part", "created_at"],
        schema="authorled",
    )

    op.create_table(
        "draft_points",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("draft_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_draft_points"),
        sa.ForeignKeyConstraint(
            ["draft_id"], ["authorled.drafts.id"], name="fk_draft_points_draft_id_drafts", ondelete="CASCADE"
        ),
        _users_fk("draft_points", "created_by"),
        sa.CheckConstraint("name <> ''", name="ck_draft_points_name_not_empty"),
        sa.CheckConstraint("kind IN ('manual', 'auto')", name="ck_draft_points_kind_known"),
        sa.CheckConstraint("jsonb_typeof(content) = 'object'", name="ck_draft_points_content_object"),
        schema="authorled",
    )
    op.create_index("ix_draft_points_draft_id", "draft_points", ["draft_id"], schema="authorled")

    op.create_table(
        "draft_opens",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("draft_id", sa.Uuid(), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "project_id", name="pk_draft_opens"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_draft_opens_user_id_users", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["authorled.projects.id"], name="fk_draft_opens_project_id_projects", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["draft_id"], ["authorled.drafts.id"], name="fk_draft_opens_draft_id_drafts", ondelete="CASCADE"
        ),
        schema="authorled",
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

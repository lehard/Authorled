"""Create authorled.projects and authorled.documents: stories and their documents.

Revision ID: 0003_projects_documents
Revises: 0002_user_settings
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_projects_documents"
down_revision: str | None = "0002_user_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["authorled.users.id"], name="fk_projects_owner_id_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint("title <> ''", name="ck_projects_title_not_empty"),
        sa.CheckConstraint("format IN ('feature')", name="ck_projects_format_known"),
        schema="authorled",
    )
    op.create_index("ix_projects_owner_id_deleted_at", "projects", ["owner_id", "deleted_at"], schema="authorled")
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), server_default="", nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("fields", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_documents"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["authorled.projects.id"], name="fk_documents_project_id_projects", ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "kind IN ('script', 'character', 'location', 'world', 'draft')", name="ck_documents_kind_known"
        ),
        sa.CheckConstraint("name <> ''", name="ck_documents_name_not_empty"),
        sa.CheckConstraint(
            "(role IS NOT NULL) = (kind IN ('character', 'location'))"
            " AND (role IS NULL OR role IN ('main', 'secondary', 'episodic'))",
            name="ck_documents_role_by_kind",
        ),
        sa.CheckConstraint("position >= 0", name="ck_documents_position_not_negative"),
        sa.CheckConstraint("jsonb_typeof(fields) = 'object'", name="ck_documents_fields_object"),
        sa.CheckConstraint("revision >= 1", name="ck_documents_revision_positive"),
        schema="authorled",
    )
    op.create_index(
        "ix_documents_project_id_kind_position",
        "documents",
        ["project_id", "kind", "position"],
        schema="authorled",
    )
    op.create_index(
        "ix_documents_one_script",
        "documents",
        ["project_id"],
        unique=True,
        schema="authorled",
        postgresql_where=sa.text("kind = 'script'"),
    )


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema authorled only go forward")

"""Create authorled.files and authorled.file_contents: uploaded files that passed the antivirus.

Revision ID: 0005_files
Revises: 0004_screenplay_texts_review
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_files"
down_revision: str | None = "0004_screenplay_texts_review"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("media_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_files"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["authorled.projects.id"], name="fk_files_project_id_projects", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"], ["authorled.users.id"], name="fk_files_uploaded_by_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint("purpose IN ('chat', 'import')", name="ck_files_purpose_known"),
        sa.CheckConstraint("(session_id IS NOT NULL) = (purpose = 'chat')", name="ck_files_session_for_chat"),
        sa.CheckConstraint("name <> ''", name="ck_files_name_not_empty"),
        sa.CheckConstraint("size_bytes BETWEEN 1 AND 20971520", name="ck_files_size_allowed"),
        sa.CheckConstraint("length(sha256) = 64", name="ck_files_sha256_hex"),
        schema="authorled",
    )
    op.create_index("ix_files_project_id", "files", ["project_id"], schema="authorled")
    op.create_table(
        "file_contents",
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("bytes", sa.LargeBinary(), nullable=False),
        sa.PrimaryKeyConstraint("file_id", name="pk_file_contents"),
        sa.ForeignKeyConstraint(
            ["file_id"], ["authorled.files.id"], name="fk_file_contents_file_id_files", ondelete="CASCADE"
        ),
        schema="authorled",
    )


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema authorled only go forward")

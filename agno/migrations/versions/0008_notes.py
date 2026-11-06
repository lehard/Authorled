"""Create authorled.notes: notes of the author, shared by all drafts of a story.

Revision ID: 0008_notes
Revises: 0007_script_fields
Create Date: 2026-11-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_notes"
down_revision: str | None = "0007_script_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), server_default="", nullable=False),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_notes"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["authorled.projects.id"], name="fk_notes_project_id_projects", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["authorled.users.id"], name="fk_notes_updated_by_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint("title <> ''", name="ck_notes_title_not_empty"),
        sa.CheckConstraint("revision >= 1", name="ck_notes_revision_positive"),
        schema="authorled",
    )
    op.create_index("ix_notes_project_id", "notes", ["project_id"], schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

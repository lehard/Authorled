"""Originals of notes: files with purpose `note`, linked from authorled.notes.file_id.

Revision ID: 0013_note_files
Revises: 0012_coauthor_feedback
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_note_files"
down_revision: str | None = "0012_coauthor_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_files_purpose_known", "files", type_="check", schema="authorled")
    op.create_check_constraint(
        "ck_files_purpose_known", "files", "purpose IN ('chat', 'import', 'note')", schema="authorled"
    )
    op.add_column("notes", sa.Column("file_id", sa.Uuid(), nullable=True), schema="authorled")
    # No ON DELETE: deleting a file under a note fails, the cascade from the story removes both.
    op.create_foreign_key(
        "fk_notes_file_id_files",
        "notes",
        "files",
        ["file_id"],
        ["id"],
        source_schema="authorled",
        referent_schema="authorled",
    )
    op.create_unique_constraint("uq_notes_file_id", "notes", ["file_id"], schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

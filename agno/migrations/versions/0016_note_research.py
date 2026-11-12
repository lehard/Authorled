"""Research briefs: authorled.notes.research marks a note the co-author wrote as a research brief.

Revision ID: 0016_note_research
Revises: 0015_note_files
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0016_note_research"
down_revision: str | None = "0015_note_files"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notes", sa.Column("research", JSONB(), nullable=True), schema="authorled")
    op.create_check_constraint(
        "research_object",
        "notes",
        "research IS NULL OR jsonb_typeof(research) = 'object'",
        schema="authorled",
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

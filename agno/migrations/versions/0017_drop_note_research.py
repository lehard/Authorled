"""Research briefs live in the co-author's answer: authorled.notes.research goes.

Revision ID: 0017_drop_note_research
Revises: 0016_note_research
Create Date: 2026-11-11
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0017_drop_note_research"
down_revision: str | None = "0016_note_research"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("research_object", "notes", type_="check", schema="authorled")
    op.drop_column("notes", "research", schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

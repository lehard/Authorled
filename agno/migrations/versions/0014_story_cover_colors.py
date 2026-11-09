"""The colour of a story's cover.

Existing stories take the colours in turn, in the order each author created them, from blue.

Revision ID: 0014_story_cover_colors
Revises: 0013_writing_goals
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_story_cover_colors"
down_revision: str | None = "0013_writing_goals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The palette as of this migration; the core keeps its own copy (core.tables.COVER_COLORS).
COLORS = ("blue", "teal", "amber", "crimson", "plum", "graphite")


def upgrade() -> None:
    op.add_column("projects", sa.Column("cover_color", sa.Text(), nullable=True), schema="authorled")
    palette = ", ".join(f"'{color}'" for color in COLORS)
    op.execute(
        f"""
        UPDATE authorled.projects AS p
        SET cover_color = (ARRAY[{palette}])[(n.place - 1) % {len(COLORS)} + 1]
        FROM (
            SELECT id, row_number() OVER (PARTITION BY owner_id ORDER BY created_at, id) AS place
            FROM authorled.projects
        ) AS n
        WHERE p.id = n.id
        """
    )
    op.alter_column("projects", "cover_color", nullable=False, schema="authorled")
    op.execute(
        "ALTER TABLE authorled.projects ADD CONSTRAINT ck_projects_cover_color_known "
        f"CHECK (cover_color IN ({palette}))"
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

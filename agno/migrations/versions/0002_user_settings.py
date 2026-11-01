"""Create authorled.user_settings: settings of a user, one row per user.

Revision ID: 0002_user_settings
Revises: 0001_create_users
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_user_settings"
down_revision: str | None = "0001_create_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("theme", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_settings"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["authorled.users.id"],
            name="fk_user_settings_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("theme IN ('light', 'sepia', 'dark')", name="ck_user_settings_theme_known"),
        schema="authorled",
    )


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema authorled only go forward")

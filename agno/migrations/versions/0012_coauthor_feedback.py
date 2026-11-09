"""Marks of the author on answers of the co-author.

Revision ID: 0012_coauthor_feedback
Revises: 0011_beta_requests
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_coauthor_feedback"
down_revision: str | None = "0011_beta_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coauthor_feedback",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_coauthor_feedback"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_coauthor_feedback_user_id_users", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("user_id", "run_id", name="uq_coauthor_feedback_user_id_run_id"),
        sa.CheckConstraint("run_id <> '' AND session_id <> ''", name="ck_coauthor_feedback_ids_not_empty"),
        sa.CheckConstraint("value IN ('useful', 'not_useful')", name="ck_coauthor_feedback_value_known"),
        schema="authorled",
    )
    op.create_index("ix_coauthor_feedback_updated_at", "coauthor_feedback", ["updated_at"], schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

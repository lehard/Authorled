"""Writing goals: the daily goal of the author, the goal of a story and the journal of written words.

The boundary check of a period uses date_bin, which PostgreSQL 18 accepts in a CHECK constraint (checked on ai_test).

Revision ID: 0013_writing_goals
Revises: 0012_coauthor_feedback
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_writing_goals"
down_revision: str | None = "0012_coauthor_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MAX_WORD_GOAL = 1_000_000


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("daily_word_goal", sa.Integer(), nullable=True), schema="authorled")
    op.create_check_constraint(
        "ck_user_settings_daily_word_goal_range",
        "user_settings",
        f"daily_word_goal BETWEEN 1 AND {MAX_WORD_GOAL}",
        schema="authorled",
    )
    op.add_column("projects", sa.Column("word_goal", sa.Integer(), nullable=True), schema="authorled")
    op.add_column("projects", sa.Column("goal_deadline", sa.Date(), nullable=True), schema="authorled")
    op.create_check_constraint(
        "ck_projects_word_goal_range", "projects", f"word_goal BETWEEN 1 AND {MAX_WORD_GOAL}", schema="authorled"
    )
    op.create_check_constraint(
        "ck_projects_deadline_needs_goal",
        "projects",
        "goal_deadline IS NULL OR word_goal IS NOT NULL",
        schema="authorled",
    )
    op.create_table(
        "writing_progress",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("words", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "project_id", "period_start", name="pk_writing_progress"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_writing_progress_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["authorled.projects.id"],
            name="fk_writing_progress_project_id_projects",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "date_bin('15 minutes', period_start, TIMESTAMPTZ '2000-01-01 00:00+00') = period_start",
            name="ck_writing_progress_period_on_boundary",
        ),
        schema="authorled",
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

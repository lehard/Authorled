"""Create authorled.subscriptions and authorled.usage_records; give every existing user a subscription to beta.

The plan code is written as a literal: it is the plan of new accounts at the time of this migration
(core/plans.toml). The first period runs one month from the account's creation, counted in UTC like the core;
later periods follow lazily in the core (core/subscriptions.py).

Revision ID: 0009_subscriptions_usage
Revises: 0008_notes
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_subscriptions_usage"
down_revision: str | None = "0008_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Check names are short: the naming convention of the metadata prefixes them with ck_<table>_.
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_subscriptions"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_subscriptions_user_id_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint("plan <> ''", name="plan_not_empty"),
        sa.CheckConstraint("source IN ('granted')", name="source_known"),
        sa.CheckConstraint("status IN ('active', 'ended')", name="status_known"),
        sa.CheckConstraint("period_end > period_start", name="period_forward"),
        sa.CheckConstraint("(ended_at IS NOT NULL) = (status = 'ended')", name="ended_at_when_ended"),
        schema="authorled",
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], schema="authorled")
    op.create_index(
        "ix_subscriptions_one_active",
        "subscriptions",
        ["user_id"],
        unique=True,
        schema="authorled",
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "usage_records",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("agent_id", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("run_status", sa.Text(), nullable=False),
        sa.Column("input_tokens", sa.BigInteger(), nullable=False),
        sa.Column("cache_read_tokens", sa.BigInteger(), nullable=False),
        sa.Column("output_tokens", sa.BigInteger(), nullable=False),
        sa.Column("cost_rub", sa.Numeric(14, 6), nullable=False),
        sa.Column("provider_cost_usd", sa.Numeric(14, 6), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_usage_records"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_usage_records_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["authorled.subscriptions.id"],
            name="fk_usage_records_subscription_id_subscriptions",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("run_id", "model", name="uq_usage_records_run_id_model"),
        sa.CheckConstraint(
            "run_id <> '' AND session_id <> '' AND agent_id <> '' AND model <> ''",
            name="ids_not_empty",
        ),
        sa.CheckConstraint("run_status IN ('completed', 'error', 'cancelled')", name="run_status_known"),
        sa.CheckConstraint(
            "input_tokens >= 0 AND cache_read_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens <= input_tokens",
            name="tokens_valid",
        ),
        sa.CheckConstraint("cost_rub >= 0", name="cost_not_negative"),
        schema="authorled",
    )
    op.create_index(
        "ix_usage_records_subscription_id_occurred_at",
        "usage_records",
        ["subscription_id", "occurred_at"],
        schema="authorled",
    )
    op.create_index("ix_usage_records_user_id", "usage_records", ["user_id"], schema="authorled")

    op.execute(
        """
        INSERT INTO authorled.subscriptions (user_id, plan, source, status, started_at, period_start, period_end)
        SELECT id, 'beta', 'granted', 'active', created_at, created_at,
               (created_at AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC'
        FROM authorled.users
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

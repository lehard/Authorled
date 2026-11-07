"""Payments through the internet acquiring of Tochka: the source `tochka` of subscriptions, authorled.billing_checkouts
and authorled.payments (openspec/changes/payments-tochka).

Revision ID: 0010_billing
Revises: 0009_subscriptions_usage
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_billing"
down_revision: str | None = "0009_subscriptions_usage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Check names are short: the naming convention of the metadata prefixes them with ck_<table>_.
    # op.f: the full name as it is in the database, not prefixed again by the naming convention.
    op.drop_constraint(op.f("ck_subscriptions_source_known"), "subscriptions", type_="check", schema="authorled")
    op.create_check_constraint("source_known", "subscriptions", "source IN ('granted', 'tochka')", schema="authorled")

    op.create_table(
        "billing_checkouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("amount_rub", sa.Numeric(12, 2), nullable=False),
        sa.Column("operation_id", sa.Text(), nullable=False),
        sa.Column("payment_link", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=True),
        sa.Column("link_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_billing_checkouts"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_billing_checkouts_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["authorled.subscriptions.id"],
            name="fk_billing_checkouts_subscription_id_subscriptions",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("operation_id", name="uq_billing_checkouts_operation_id"),
        sa.CheckConstraint("plan <> '' AND operation_id <> '' AND payment_link <> ''", name="fields_not_empty"),
        sa.CheckConstraint("amount_rub > 0", name="amount_positive"),
        sa.CheckConstraint("status IN ('created', 'active', 'cancelled', 'failed', 'expired')", name="status_known"),
        sa.CheckConstraint("(cancelled_at IS NOT NULL) = (status = 'cancelled')", name="cancelled_at_when_cancelled"),
        sa.CheckConstraint(
            "status NOT IN ('active', 'cancelled', 'failed') OR subscription_id IS NOT NULL",
            name="paid_has_subscription",
        ),
        schema="authorled",
    )
    op.create_index("ix_billing_checkouts_user_id", "billing_checkouts", ["user_id"], schema="authorled")

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("checkout_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("operation_id", sa.Text(), nullable=False),
        sa.Column("order_id", sa.Text(), nullable=False),
        sa.Column("amount_rub", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_payments"),
        sa.ForeignKeyConstraint(
            ["checkout_id"],
            ["authorled.billing_checkouts.id"],
            name="fk_payments_checkout_id_billing_checkouts",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["authorled.users.id"], name="fk_payments_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["authorled.subscriptions.id"],
            name="fk_payments_subscription_id_subscriptions",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("operation_id", "order_id", name="uq_payments_operation_id_order_id"),
        sa.CheckConstraint("operation_id <> '' AND order_id <> ''", name="ids_not_empty"),
        sa.CheckConstraint("amount_rub > 0", name="amount_positive"),
        sa.CheckConstraint("period_end > period_start", name="period_forward"),
        schema="authorled",
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"], schema="authorled")
    op.create_index("ix_payments_checkout_id", "payments", ["checkout_id"], schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

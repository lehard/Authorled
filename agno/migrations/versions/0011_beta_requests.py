"""Requests for the closed beta from the product site.

Revision ID: 0011_beta_requests
Revises: 0010_coauthor_actions
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_beta_requests"
down_revision: str | None = "0010_coauthor_actions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "beta_requests",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_beta_requests"),
        sa.UniqueConstraint("email", name="uq_beta_requests_email"),
        sa.CheckConstraint("email <> '' AND email = lower(email)", name="ck_beta_requests_email_lower"),
        sa.CheckConstraint("name <> ''", name="ck_beta_requests_name_not_empty"),
        sa.CheckConstraint("role IN ('screenwriter', 'writer', 'other')", name="ck_beta_requests_role_known"),
        schema="authorled",
    )
    op.create_index("ix_beta_requests_created_at", "beta_requests", ["created_at"], schema="authorled")


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

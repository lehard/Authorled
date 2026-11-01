"""Create authorled.users: the user of the product, linked to Authentik by the token `sub`.

Revision ID: 0001_create_users
Revises:
Create Date: 2026-11-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_create_users"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("auth_subject", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("auth_subject", name="uq_users_auth_subject"),
        sa.CheckConstraint("auth_subject <> ''", name="ck_users_auth_subject_not_empty"),
        sa.CheckConstraint("email <> ''", name="ck_users_email_not_empty"),
        sa.CheckConstraint("display_name <> ''", name="ck_users_display_name_not_empty"),
        schema="authorled",
    )


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema authorled only go forward")

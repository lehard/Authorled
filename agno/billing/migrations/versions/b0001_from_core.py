"""Move the subscriptions and the usage journal from schema authorled to schema billing.

The core created both tables in migration 0009_subscriptions_usage; this first migration of the billing chain moves
them with all rows, keeps their identifiers, indexes and constraints, and drops their foreign keys to
authorled.users: billing keeps the user of the core by value (openspec/specs/billing/module, «Перенос данных
биллинга из схемы ядра»). It is the only billing migration that changes schema authorled.

Revision ID: b0001_from_core
Revises:
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b0001_from_core"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("subscriptions", "usage_records")


def upgrade() -> None:
    connection = op.get_bind()
    found = set(
        connection.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'authorled' AND table_name IN ('subscriptions', 'usage_records')"
            )
        ).scalars()
    )
    missing = [name for name in TABLES if name not in found]
    if missing:
        raise RuntimeError(
            f"authorled.{', authorled.'.join(missing)} not found: apply the core migrations through "
            "0009_subscriptions_usage first (`alembic upgrade head` from agno/)"
        )
    op.drop_constraint("fk_usage_records_user_id_users", "usage_records", schema="authorled", type_="foreignkey")
    op.drop_constraint("fk_subscriptions_user_id_users", "subscriptions", schema="authorled", type_="foreignkey")
    # SET SCHEMA moves the rows, indexes, constraints and the key from usage_records to subscriptions together.
    op.execute("ALTER TABLE authorled.subscriptions SET SCHEMA billing")
    op.execute("ALTER TABLE authorled.usage_records SET SCHEMA billing")


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema billing only go forward")

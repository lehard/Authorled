"""Actions of the co-author: its mode in the settings, its comments and the snapshot before its change.

Revision ID: 0010_coauthor_actions
Revises: 0009_subscriptions_usage
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_coauthor_actions"
down_revision: str | None = "0009_subscriptions_usage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every user so far starts in the mode of a new one.
    op.add_column(
        "user_settings",
        sa.Column("coauthor_mode", sa.Text(), server_default="ask", nullable=False),
        schema="authorled",
    )
    op.create_check_constraint(
        "coauthor_mode_known", "user_settings", "coauthor_mode IN ('ask', 'auto')", schema="authorled"
    )

    op.add_column("comment_threads", sa.Column("scene_uid", sa.Text(), nullable=True), schema="authorled")
    op.create_check_constraint("scene_uid_not_empty", "comment_threads", "scene_uid <> ''", schema="authorled")

    # The messages so far are written by users; the core names the kind of every new one.
    op.add_column(
        "comment_messages",
        sa.Column("author_kind", sa.Text(), server_default="user", nullable=False),
        schema="authorled",
    )
    op.alter_column("comment_messages", "author_kind", server_default=None, schema="authorled")
    op.alter_column("comment_messages", "author_id", nullable=True, schema="authorled")
    op.create_check_constraint(
        "author_kind_known",
        "comment_messages",
        "author_kind IN ('user', 'coauthor')",
        schema="authorled",
    )
    op.create_check_constraint(
        "author_of_kind",
        "comment_messages",
        "(author_kind = 'user') = (author_id IS NOT NULL)",
        schema="authorled",
    )

    # Alembic prefixes constraint names by the naming convention of the metadata (ck_<table>_<name>): 0006 named this
    # one ck_document_versions_ck_document_versions_reason_known, which this name becomes; the new names get one prefix.
    op.drop_constraint("ck_document_versions_reason_known", "document_versions", schema="authorled", type_="check")
    op.create_check_constraint(
        "reason_known",
        "document_versions",
        "reason IN ('auto', 'suggestion', 'import', 'restore', 'coauthor')",
        schema="authorled",
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

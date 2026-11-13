"""Participants of a story, invitations, the link «почитать», presence, authors of suggestions, conflict snapshots.

Revision ID: 0019_story_sharing
Revises: 0018_sources
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_story_sharing"
down_revision: str | None = "0018_sources"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

S = "authorled"


def _now() -> sa.TextClause:
    return sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("added_by", sa.Uuid(), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.CheckConstraint("role IN ('coauthor', 'reviewer', 'reader')", name="ck_project_members_role_known"),
        sa.ForeignKeyConstraint(
            ["project_id"], [f"{S}.projects.id"], name="fk_project_members_project_id_projects", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{S}.users.id"], name="fk_project_members_user_id_users", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["added_by"], [f"{S}.users.id"], name="fk_project_members_added_by_users", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("project_id", "user_id", name="pk_project_members"),
        schema=S,
    )
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"], schema=S)

    op.create_table(
        "project_invitations",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.CheckConstraint("email <> '' AND email = lower(email)", name="ck_project_invitations_email_lower"),
        sa.CheckConstraint("role IN ('coauthor', 'reviewer', 'reader')", name="ck_project_invitations_role_known"),
        sa.ForeignKeyConstraint(
            ["project_id"],
            [f"{S}.projects.id"],
            name="fk_project_invitations_project_id_projects",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"], [f"{S}.users.id"], name="fk_project_invitations_invited_by_users", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_project_invitations"),
        sa.UniqueConstraint("project_id", "email", name="uq_project_invitations_project_id"),
        schema=S,
    )
    op.create_index("ix_project_invitations_email", "project_invitations", ["email"], schema=S)

    op.create_table(
        "draft_read_links",
        sa.Column("draft_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.CheckConstraint("key <> ''", name="ck_draft_read_links_key_not_empty"),
        sa.ForeignKeyConstraint(
            ["draft_id"], [f"{S}.drafts.id"], name="fk_draft_read_links_draft_id_drafts", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], [f"{S}.users.id"], name="fk_draft_read_links_created_by_users", ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("draft_id", name="pk_draft_read_links"),
        sa.UniqueConstraint("key", name="uq_draft_read_links_key"),
        schema=S,
    )

    op.create_table(
        "draft_presence",
        sa.Column("draft_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["draft_id"], [f"{S}.drafts.id"], name="fk_draft_presence_draft_id_drafts", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{S}.users.id"], name="fk_draft_presence_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("draft_id", "user_id", name="pk_draft_presence"),
        schema=S,
    )

    # Suggestions of participants: the existing ones are all the co-author's.
    op.add_column("suggestions", sa.Column("author_kind", sa.Text(), nullable=True), schema=S)
    op.execute(f"UPDATE {S}.suggestions SET author_kind = 'coauthor'")
    op.alter_column("suggestions", "author_kind", nullable=False, schema=S)
    op.add_column("suggestions", sa.Column("author_id", sa.Uuid(), nullable=True), schema=S)
    op.add_column("suggestions", sa.Column("decided_by", sa.Uuid(), nullable=True), schema=S)
    op.create_foreign_key(
        op.f("fk_suggestions_author_id_users"),
        "suggestions",
        "users",
        ["author_id"],
        ["id"],
        source_schema=S,
        referent_schema=S,
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        op.f("fk_suggestions_decided_by_users"),
        "suggestions",
        "users",
        ["decided_by"],
        ["id"],
        source_schema=S,
        referent_schema=S,
        ondelete="RESTRICT",
    )
    op.alter_column("suggestions", "session_id", nullable=True, schema=S)
    op.create_check_constraint(
        op.f("ck_suggestions_author_kind_known"), "suggestions", "author_kind IN ('coauthor', 'user')", schema=S
    )
    op.create_check_constraint(
        op.f("ck_suggestions_author_of_kind"),
        "suggestions",
        "(author_kind = 'user') = (author_id IS NOT NULL)",
        schema=S,
    )
    op.create_check_constraint(
        op.f("ck_suggestions_session_of_coauthor"),
        "suggestions",
        "(author_kind = 'coauthor') = (session_id IS NOT NULL)",
        schema=S,
    )

    # A snapshot of a save refused for an older revision.
    op.drop_constraint(op.f("ck_document_versions_reason_known"), "document_versions", schema=S, type_="check")
    op.create_check_constraint(
        op.f("ck_document_versions_reason_known"),
        "document_versions",
        "reason IN ('auto', 'suggestion', 'import', 'restore', 'coauthor', 'conflict')",
        schema=S,
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

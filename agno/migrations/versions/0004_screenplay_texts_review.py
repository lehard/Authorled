"""Create authorled.screenplay_texts and the review tables: comment threads, messages, suggestions.

Revision ID: 0004_screenplay_texts_review
Revises: 0003_projects_documents
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_screenplay_texts_review"
down_revision: str | None = "0003_projects_documents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "screenplay_texts",
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("document_id", name="pk_screenplay_texts"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["authorled.documents.id"],
            name="fk_screenplay_texts_document_id_documents",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("jsonb_typeof(content) = 'object'", name="ck_screenplay_texts_content_object"),
        sa.CheckConstraint("revision >= 1", name="ck_screenplay_texts_revision_positive"),
        schema="authorled",
    )
    op.create_table(
        "comment_threads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_comment_threads"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["authorled.documents.id"],
            name="fk_comment_threads_document_id_documents",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"], ["authorled.users.id"], name="fk_comment_threads_resolved_by_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "(resolved_at IS NULL) = (resolved_by IS NULL)", name="ck_comment_threads_resolved_together"
        ),
        schema="authorled",
    )
    op.create_index("ix_comment_threads_document_id", "comment_threads", ["document_id"], schema="authorled")
    op.create_table(
        "comment_messages",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("author_role", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_comment_messages"),
        sa.ForeignKeyConstraint(
            ["thread_id"],
            ["authorled.comment_threads.id"],
            name="fk_comment_messages_thread_id_comment_threads",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["authorled.users.id"], name="fk_comment_messages_author_id_users", ondelete="RESTRICT"
        ),
        sa.CheckConstraint("body <> ''", name="ck_comment_messages_body_not_empty"),
        schema="authorled",
    )
    op.create_index("ix_comment_messages_thread_id", "comment_messages", ["thread_id"], schema="authorled")
    op.create_table(
        "suggestions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("scene_uid", sa.Text(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("why", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_suggestions"),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["authorled.documents.id"],
            name="fk_suggestions_document_id_documents",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("scene_uid <> ''", name="ck_suggestions_scene_uid_not_empty"),
        sa.CheckConstraint("quote <> ''", name="ck_suggestions_quote_not_empty"),
        sa.CheckConstraint("session_id <> ''", name="ck_suggestions_session_id_not_empty"),
        sa.CheckConstraint("status IN ('open', 'accepted', 'rejected')", name="ck_suggestions_status_known"),
        sa.CheckConstraint("(status = 'open') = (decided_at IS NULL)", name="ck_suggestions_decided_when_closed"),
        schema="authorled",
    )
    op.create_index("ix_suggestions_document_id", "suggestions", ["document_id"], schema="authorled")


def downgrade() -> None:
    # Migrations only go forward (openspec/context/04-engineering-standards.md).
    raise NotImplementedError("Migrations of schema authorled only go forward")

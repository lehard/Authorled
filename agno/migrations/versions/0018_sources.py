"""The library of sources: books of the canon and their pieces with vectors (openspec/specs/core/database).

Revision ID: 0018_sources
Revises: 0017_drop_note_research
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0018_sources"
down_revision: str | None = "0017_drop_note_research"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "source_books",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("authors", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("language", sa.Text(), nullable=False),
        sa.Column("original_year", sa.Integer(), nullable=True),
        sa.Column("edition_year", sa.Integer(), nullable=True),
        sa.Column("translator", sa.Text(), nullable=True),
        sa.Column("translation_year", sa.Integer(), nullable=True),
        sa.Column("original_title", sa.Text(), nullable=True),
        sa.Column("embedding_model", sa.Text(), nullable=False),
        sa.Column("loaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_source_books"),
        sa.UniqueConstraint("slug", name="uq_source_books_slug"),
        sa.CheckConstraint("slug <> ''", name="ck_source_books_slug_not_empty"),
        sa.CheckConstraint("title <> ''", name="ck_source_books_title_not_empty"),
        sa.CheckConstraint("cardinality(authors) > 0", name="ck_source_books_authors_not_empty"),
        sa.CheckConstraint("language IN ('ru', 'en')", name="ck_source_books_language_known"),
        sa.CheckConstraint("embedding_model <> ''", name="ck_source_books_embedding_model_not_empty"),
        schema="authorled",
    )
    op.create_table(
        "source_fragments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("book_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("path", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("ts_config", postgresql.REGCONFIG(), nullable=False),
        sa.Column("tsv", postgresql.TSVECTOR(), sa.Computed("to_tsvector(ts_config, content)", persisted=True)),
        # The type lives in schema public, where agno/db/init.sql creates the extension.
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_source_fragments"),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["authorled.source_books.id"],
            name="fk_source_fragments_book_id_source_books",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("book_id", "position", name="uq_source_fragments_book_id_position"),
        sa.CheckConstraint("position >= 0", name="ck_source_fragments_position_not_negative"),
        sa.CheckConstraint("content <> ''", name="ck_source_fragments_content_not_empty"),
        schema="authorled",
    )
    op.create_index("ix_source_fragments_tsv", "source_fragments", ["tsv"], schema="authorled", postgresql_using="gin")
    op.create_index(
        "ix_source_fragments_embedding",
        "source_fragments",
        ["embedding"],
        schema="authorled",
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

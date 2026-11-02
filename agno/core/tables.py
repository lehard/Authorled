"""Tables of the product core in schema `authorled` (openspec/specs/core/database).

Migrations in `migrations/versions/` create these tables; tests compare this description with the database.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

SCHEMA = "authorled"

# Named constraints, so the database and this description compare equal.
metadata = MetaData(
    schema=SCHEMA,
    naming_convention={
        "pk": "pk_%(table_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "ix": "ix_%(table_name)s_%(column_0_name)s",
    },
)

# One row per user of the product. Settings live in a separate profile table; groups and roles stay in Authentik.
users = Table(
    "users",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    # Claim `sub` of the Authentik token.
    Column("auth_subject", Text, nullable=False),
    Column("email", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("last_seen_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    # Set when the account is deleted softly, like a story in the trash.
    Column("deleted_at", DateTime(timezone=True)),
    UniqueConstraint("auth_subject"),
    CheckConstraint("auth_subject <> ''", name="auth_subject_not_empty"),
    CheckConstraint("email <> ''", name="email_not_empty"),
    CheckConstraint("display_name <> ''", name="display_name_not_empty"),
)

# Themes of the design system (web/src/design-system/theme.ts); NULL follows the system setting.
THEMES = ("light", "sepia", "dark")

# Settings of a user, one row per user. Each new setting is a column added by its own migration.
user_settings = Table(
    "user_settings",
    metadata,
    Column("user_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), primary_key=True),
    Column("theme", Text),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("theme IN ('light', 'sepia', 'dark')", name="theme_known"),
)

# Stories of the authors (openspec/specs/api/stories). MVP: one format, the feature film; one owner.
projects = Table(
    "projects",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("owner_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("title", Text, nullable=False),
    Column("description", Text, nullable=False, server_default=""),
    Column("format", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    # Set while the story lies in the trash; only the author empties it, there is no expiry.
    Column("deleted_at", DateTime(timezone=True)),
    CheckConstraint("title <> ''", name="title_not_empty"),
    CheckConstraint("format IN ('feature')", name="format_known"),
    Index("ix_projects_owner_id_deleted_at", "owner_id", "deleted_at"),
)

DOCUMENT_KINDS = ("script", "character", "location", "world", "draft")
ROLES = ("main", "secondary", "episodic")

# Every document of a story in one table; the fields of each kind live in `fields` and the core
# validates them (core/fields.py).
documents = Table(
    "documents",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), nullable=False),
    Column("kind", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("role", Text),
    Column("summary", Text, nullable=False, server_default=""),
    Column("position", Integer, nullable=False),
    Column("fields", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("revision", Integer, nullable=False, server_default=text("1")),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("deleted_at", DateTime(timezone=True)),
    CheckConstraint(
        "kind IN ('script', 'character', 'location', 'world', 'draft')",
        name="kind_known",
    ),
    CheckConstraint("name <> ''", name="name_not_empty"),
    # A role exactly for characters and locations.
    CheckConstraint(
        "(role IS NOT NULL) = (kind IN ('character', 'location'))"
        " AND (role IS NULL OR role IN ('main', 'secondary', 'episodic'))",
        name="role_by_kind",
    ),
    CheckConstraint("position >= 0", name="position_not_negative"),
    CheckConstraint("jsonb_typeof(fields) = 'object'", name="fields_object"),
    CheckConstraint("revision >= 1", name="revision_positive"),
    Index("ix_documents_project_id_kind_position", "project_id", "kind", "position"),
    # One screenplay per story.
    Index("ix_documents_one_script", "project_id", unique=True, postgresql_where=text("kind = 'script'")),
)

# Text of the screenplay or of a draft: the editor document (web/src/editor/document.ts) with the
# marks of colour, comments and suggestions.
screenplay_texts = Table(
    "screenplay_texts",
    metadata,
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), primary_key=True),
    Column("content", JSONB, nullable=False),
    Column("revision", Integer, nullable=False, server_default=text("1")),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("jsonb_typeof(content) = 'object'", name="content_object"),
    CheckConstraint("revision >= 1", name="revision_positive"),
)

# A comment thread on a fragment; its id is the id of the `comment` mark in the text.
comment_threads = Table(
    "comment_threads",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), nullable=False),
    Column("quote", Text, nullable=False),
    Column("resolved_at", DateTime(timezone=True)),
    Column("resolved_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT")),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("(resolved_at IS NULL) = (resolved_by IS NULL)", name="resolved_together"),
    Index("ix_comment_threads_document_id", "document_id"),
)

comment_messages = Table(
    "comment_messages",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("thread_id", Uuid, ForeignKey(comment_threads.c.id, ondelete="CASCADE"), nullable=False),
    Column("author_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    # Role of the author in the story team when writing, «редактор»; empty when the token has none.
    Column("author_role", Text, nullable=False),
    Column("body", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("edited_at", DateTime(timezone=True)),
    CheckConstraint("body <> ''", name="body_not_empty"),
    Index("ix_comment_messages_thread_id", "thread_id"),
)

SUGGESTION_STATUSES = ("open", "accepted", "rejected")

# A co-author suggestion, anchored by the scene uid and an exact quote; the browser places its mark.
suggestions = Table(
    "suggestions",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), nullable=False),
    Column("scene_uid", Text, nullable=False),
    Column("quote", Text, nullable=False),
    Column("text", Text, nullable=False),
    Column("why", Text, nullable=False),
    Column("status", Text, nullable=False, server_default="open"),
    # The Agno session (conversation) the suggestion came from.
    Column("session_id", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("decided_at", DateTime(timezone=True)),
    CheckConstraint("scene_uid <> ''", name="scene_uid_not_empty"),
    CheckConstraint("quote <> ''", name="quote_not_empty"),
    CheckConstraint("session_id <> ''", name="session_id_not_empty"),
    CheckConstraint("status IN ('open', 'accepted', 'rejected')", name="status_known"),
    CheckConstraint("(status = 'open') = (decided_at IS NULL)", name="decided_when_closed"),
    Index("ix_suggestions_document_id", "document_id"),
)

FILE_PURPOSES = ("chat", "import")
MAX_FILE_BYTES = 20 * 1024 * 1024

# An uploaded file that passed the antivirus; its bytes live in file_contents.
files = Table(
    "files",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), nullable=False),
    Column("uploaded_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("purpose", Text, nullable=False),
    Column("session_id", Text),
    Column("name", Text, nullable=False),
    Column("media_type", Text, nullable=False),
    Column("size_bytes", Integer, nullable=False),
    Column("sha256", Text, nullable=False),
    # Text extracted on upload, for the co-author.
    Column("text_content", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("purpose IN ('chat', 'import')", name="purpose_known"),
    CheckConstraint("(session_id IS NOT NULL) = (purpose = 'chat')", name="session_for_chat"),
    CheckConstraint("name <> ''", name="name_not_empty"),
    CheckConstraint(f"size_bytes BETWEEN 1 AND {MAX_FILE_BYTES}", name="size_allowed"),
    CheckConstraint("length(sha256) = 64", name="sha256_hex"),
    Index("ix_files_project_id", "project_id"),
)

file_contents = Table(
    "file_contents",
    metadata,
    Column("file_id", Uuid, ForeignKey(files.c.id, ondelete="CASCADE"), primary_key=True),
    Column("bytes", LargeBinary, nullable=False),
)

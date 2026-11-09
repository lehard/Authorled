"""Tables of the product core in schema `authorled` (openspec/specs/core/database).

Migrations in `migrations/versions/` create these tables; tests compare this description with the database.
"""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
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
# Modes of the co-author: `ask` waits for the author before each change, `auto` makes it at once.
COAUTHOR_MODES = ("ask", "auto")

# Settings of a user, one row per user. Each new setting is a column added by its own migration.
user_settings = Table(
    "user_settings",
    metadata,
    Column("user_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), primary_key=True),
    Column("theme", Text),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    # The mode a new user starts with is `ask` (business-intents/coauthor-actions.md).
    Column("coauthor_mode", Text, nullable=False, server_default="ask"),
    CheckConstraint("theme IN ('light', 'sepia', 'dark')", name="theme_known"),
    CheckConstraint("coauthor_mode IN ('ask', 'auto')", name="coauthor_mode_known"),
)

# Stories of the authors (openspec/specs/api/stories). MVP: one format, the feature film; one owner.
# Colours of a story's cover in the order new stories take them (openspec/specs/api/stories).
COVER_COLORS = ("blue", "teal", "amber", "crimson", "plum", "graphite")

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
    # No default: the core picks the colour of every new story.
    Column("cover_color", Text, nullable=False),
    CheckConstraint("title <> ''", name="title_not_empty"),
    CheckConstraint("format IN ('feature')", name="format_known"),
    CheckConstraint(f"cover_color IN ({', '.join(repr(c) for c in COVER_COLORS)})", name="cover_color_known"),
    Index("ix_projects_owner_id_deleted_at", "owner_id", "deleted_at"),
)

# A parallel version of a story: it owns the screenplay, the cards, the review and the conversations. All drafts
# are equal; a new one is a copy of another and keeps only the name of its base, for the label.
drafts = Table(
    "drafts",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), nullable=False),
    Column("name", Text, nullable=False),
    Column("locked", Boolean, nullable=False, server_default=text("false")),
    Column("forked_from_id", Uuid, ForeignKey("drafts.id", ondelete="SET NULL")),
    Column("forked_from_name", Text),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("deleted_at", DateTime(timezone=True)),
    CheckConstraint("name <> ''", name="name_not_empty"),
    # The target of the composite key of `documents`: a document stays in the story of its draft.
    UniqueConstraint("id", "project_id"),
    Index("ix_drafts_project_id", "project_id"),
)

DOCUMENT_KINDS = ("script", "character", "location", "world")
ROLES = ("main", "secondary", "episodic")

# Every document of a draft in one table; the fields of each kind live in `fields` and the core
# validates them (core/fields.py).
documents = Table(
    "documents",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), nullable=False),
    Column("draft_id", Uuid, nullable=False),
    Column("kind", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("role", Text),
    Column("summary", Text, nullable=False, server_default=""),
    Column("position", Integer, nullable=False),
    Column("fields", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("revision", Integer, nullable=False, server_default=text("1")),
    Column("updated_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("deleted_at", DateTime(timezone=True)),
    ForeignKeyConstraint(
        ["draft_id", "project_id"],
        [drafts.c.id, drafts.c.project_id],
        name="fk_documents_draft_id_drafts",
        ondelete="CASCADE",
    ),
    CheckConstraint("kind IN ('script', 'character', 'location', 'world')", name="kind_known"),
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
    Index("ix_documents_draft_id_kind_position", "draft_id", "kind", "position"),
    # One screenplay per draft.
    Index("ix_documents_one_script", "draft_id", unique=True, postgresql_where=text("kind = 'script'")),
)

# Notes of the author: they belong to the story, not to a draft, so forks, rollbacks and locks do not touch them.
notes = Table(
    "notes",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), nullable=False),
    Column("title", Text, nullable=False),
    Column("body", Text, nullable=False, server_default=""),
    Column("revision", Integer, nullable=False, server_default=text("1")),
    Column("updated_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("deleted_at", DateTime(timezone=True)),
    CheckConstraint("title <> ''", name="title_not_empty"),
    CheckConstraint("revision >= 1", name="revision_positive"),
    Index("ix_notes_project_id", "project_id"),
)

# Text of the screenplay of a draft: the editor document (web/src/editor/document.ts) with the
# marks of colour, comments and suggestions.
screenplay_texts = Table(
    "screenplay_texts",
    metadata,
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), primary_key=True),
    Column("content", JSONB, nullable=False),
    Column("revision", Integer, nullable=False, server_default=text("1")),
    Column("updated_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("jsonb_typeof(content) = 'object'", name="content_object"),
    CheckConstraint("revision >= 1", name="revision_positive"),
)

VERSION_PARTS = ("text", "fields")
VERSION_REASONS = ("auto", "suggestion", "import", "restore", "coauthor")

# A snapshot of a part of a document as it was: `saved_by` and `saved_at` tell who saved that state,
# `created_at` when the snapshot was taken. Full copies, no diffs (design of story-drafts-and-saves).
document_versions = Table(
    "document_versions",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), nullable=False),
    Column("part", Text, nullable=False),
    Column("content", JSONB, nullable=False),
    Column("reason", Text, nullable=False),
    Column("saved_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("saved_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("part IN ('text', 'fields')", name="part_known"),
    CheckConstraint("reason IN ('auto', 'suggestion', 'import', 'restore', 'coauthor')", name="reason_known"),
    CheckConstraint("jsonb_typeof(content) = 'object'", name="content_object"),
    Index("ix_document_versions_document_id_part_created_at", "document_id", "part", "created_at"),
)

POINT_KINDS = ("manual", "auto")

# A named point of a whole draft: every document outside the trash with its fields and text.
draft_points = Table(
    "draft_points",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("draft_id", Uuid, ForeignKey(drafts.c.id, ondelete="CASCADE"), nullable=False),
    Column("name", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("content", JSONB, nullable=False),
    Column("created_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("name <> ''", name="name_not_empty"),
    CheckConstraint("kind IN ('manual', 'auto')", name="kind_known"),
    CheckConstraint("jsonb_typeof(content) = 'object'", name="content_object"),
    Index("ix_draft_points_draft_id", "draft_id"),
)

# The draft a user opened last in a story, so the story opens there on any device.
draft_opens = Table(
    "draft_opens",
    metadata,
    Column("user_id", Uuid, ForeignKey(users.c.id, ondelete="CASCADE"), primary_key=True),
    Column("project_id", Uuid, ForeignKey(projects.c.id, ondelete="CASCADE"), primary_key=True),
    Column("draft_id", Uuid, ForeignKey(drafts.c.id, ondelete="CASCADE"), nullable=False),
    Column("opened_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

# A comment thread on a fragment; its id is the id of the `comment` mark in the text.
# A thread of the co-author also keeps the scene of its quote: the browser places its mark by them.
comment_threads = Table(
    "comment_threads",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("document_id", Uuid, ForeignKey(documents.c.id, ondelete="CASCADE"), nullable=False),
    Column("quote", Text, nullable=False),
    Column("scene_uid", Text),
    Column("resolved_at", DateTime(timezone=True)),
    Column("resolved_by", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT")),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("(resolved_at IS NULL) = (resolved_by IS NULL)", name="resolved_together"),
    CheckConstraint("scene_uid <> ''", name="scene_uid_not_empty"),
    Index("ix_comment_threads_document_id", "document_id"),
)

comment_messages = Table(
    "comment_messages",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("thread_id", Uuid, ForeignKey(comment_threads.c.id, ondelete="CASCADE"), nullable=False),
    # `user`: a person of the story, `author_id` names them; `coauthor`: the co-author, who is no user.
    Column("author_kind", Text, nullable=False),
    Column("author_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT")),
    # Role of the author in the story team when writing, «редактор»; empty when the token has none.
    Column("author_role", Text, nullable=False),
    Column("body", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("edited_at", DateTime(timezone=True)),
    CheckConstraint("body <> ''", name="body_not_empty"),
    CheckConstraint("author_kind IN ('user', 'coauthor')", name="author_kind_known"),
    CheckConstraint("(author_kind = 'user') = (author_id IS NOT NULL)", name="author_of_kind"),
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

BETA_REQUEST_ROLES = ("screenwriter", "writer", "other")

# Requests for the closed beta from the product site, one per e-mail (openspec/specs/api/beta-requests).
# A requester is not a user yet, so there is no link to users; the e-mail is kept in lower case.
beta_requests = Table(
    "beta_requests",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("email", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("role", Text, nullable=False),
    Column("consent_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("email", name="uq_beta_requests_email"),
    CheckConstraint("email <> '' AND email = lower(email)", name="email_lower"),
    CheckConstraint("name <> ''", name="name_not_empty"),
    CheckConstraint("role IN ('screenwriter', 'writer', 'other')", name="role_known"),
    Index("ix_beta_requests_created_at", "created_at"),
)

COAUTHOR_FEEDBACK_VALUES = ("useful", "not_useful")

# The author's mark of an answer of the co-author, one per user and run (openspec/specs/core/database). The run is the
# Agno run of the billing journal; an empty value is a mark taken back. Identifiers only: no text of the answer.
coauthor_feedback = Table(
    "coauthor_feedback",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    Column("user_id", Uuid, ForeignKey(users.c.id, ondelete="RESTRICT"), nullable=False),
    Column("run_id", Text, nullable=False),
    Column("session_id", Text, nullable=False),
    Column("value", Text),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("user_id", "run_id", name="uq_coauthor_feedback_user_id_run_id"),
    CheckConstraint("run_id <> '' AND session_id <> ''", name="ids_not_empty"),
    CheckConstraint("value IN ('useful', 'not_useful')", name="value_known"),
    Index("ix_coauthor_feedback_updated_at", "updated_at"),
)

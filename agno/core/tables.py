"""Tables of the product core in schema `authorled` (openspec/specs/core/database).

Migrations in `migrations/versions/` create these tables; tests compare this description with the database.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)

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

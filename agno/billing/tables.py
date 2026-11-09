"""Tables of the billing module in schema `billing` (openspec/specs/billing/module).

The migrations of `billing/migrations/` own this schema; tests compare this description with the database.
A user is the identifier of the core's user, kept by value: no foreign key leaves schema `billing`.
"""

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    Numeric,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)

SCHEMA = "billing"

# The same convention as the core: the tables came from schema `authorled` with these names.
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

# Subscriptions of users to plans. Plans are data (billing/plans.toml), so `plan` holds a code, not a key.
# A user has at most one active subscription; ended ones stay as history.
SUBSCRIPTION_SOURCES = ("granted",)
SUBSCRIPTION_STATUSES = ("active", "ended")

subscriptions = Table(
    "subscriptions",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    # The user of the core (authorled.users.id), by value.
    Column("user_id", Uuid, nullable=False),
    Column("plan", Text, nullable=False),
    Column("source", Text, nullable=False),
    Column("status", Text, nullable=False),
    # The anchor of the periods: each period ends a whole number of months after it.
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("period_start", DateTime(timezone=True), nullable=False),
    Column("period_end", DateTime(timezone=True), nullable=False),
    Column("ended_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint("plan <> ''", name="plan_not_empty"),
    CheckConstraint("source IN ('granted')", name="source_known"),
    CheckConstraint("status IN ('active', 'ended')", name="status_known"),
    CheckConstraint("period_end > period_start", name="period_forward"),
    CheckConstraint("(ended_at IS NOT NULL) = (status = 'ended')", name="ended_at_when_ended"),
    Index("ix_subscriptions_user_id", "user_id"),
    Index("ix_subscriptions_one_active", "user_id", unique=True, postgresql_where=text("status = 'active'")),
)

USAGE_RUN_STATUSES = ("completed", "error", "cancelled")

# Spending of agent runs, one row per run and model; costs in rubles by the prices of billing/model_prices.toml.
# Identifiers only: no text of the work, no e-mail.
usage_records = Table(
    "usage_records",
    metadata,
    Column("id", Uuid, primary_key=True, server_default=text("gen_random_uuid()")),
    # The user of the core (authorled.users.id), by value.
    Column("user_id", Uuid, nullable=False),
    Column("subscription_id", Uuid, ForeignKey(subscriptions.c.id, ondelete="RESTRICT"), nullable=False),
    Column("run_id", Text, nullable=False),
    Column("session_id", Text, nullable=False),
    Column("agent_id", Text, nullable=False),
    Column("model", Text, nullable=False),
    Column("run_status", Text, nullable=False),
    # Input includes the tokens read from the cache, as the provider reports it.
    Column("input_tokens", BigInteger, nullable=False),
    Column("cache_read_tokens", BigInteger, nullable=False),
    Column("output_tokens", BigInteger, nullable=False),
    Column("cost_rub", Numeric(14, 6), nullable=False),
    # The cost LiteLLM reports, for reconciliation only.
    Column("provider_cost_usd", Numeric(14, 6)),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint("run_id", "model", name="uq_usage_records_run_id_model"),
    CheckConstraint("run_id <> '' AND session_id <> '' AND agent_id <> '' AND model <> ''", name="ids_not_empty"),
    CheckConstraint("run_status IN ('completed', 'error', 'cancelled')", name="run_status_known"),
    CheckConstraint(
        "input_tokens >= 0 AND cache_read_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens <= input_tokens",
        name="tokens_valid",
    ),
    CheckConstraint("cost_rub >= 0", name="cost_not_negative"),
    Index("ix_usage_records_subscription_id_occurred_at", "subscription_id", "occurred_at"),
    Index("ix_usage_records_user_id", "user_id"),
)

"""The screenplay loses its tagline and its own name and gets the part `logline`.

Snapshots and points keep whole states and rollback writes them unchecked, so they change too
(openspec/changes/story-page-and-logline, design, decision 3). Forward only: taglines are dropped.

Revision ID: 0007_script_fields
Revises: 0006_drafts_and_saves
Create Date: 2026-11-06
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_script_fields"
down_revision: str | None = "0006_drafts_and_saves"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _script_state(state: dict[str, Any]) -> dict[str, Any]:
    """A state with `name` and `fields` in the new form; the rest stays as it was."""
    fields = {key: value for key, value in state["fields"].items() if key != "tagline"}
    if "show" in fields:
        fields["show"] = {**fields["show"], "logline": True}
    return {**state, "name": "Сценарий", "fields": fields}


def _update(table: str, column: str) -> sa.TextClause:
    return sa.text(f"UPDATE authorled.{table} SET {column} = :value WHERE id = :id").bindparams(
        sa.bindparam("value", type_=postgresql.JSONB)
    )


def upgrade() -> None:
    connection = op.get_bind()

    scripts = connection.execute(sa.text("SELECT id, name, fields FROM authorled.documents WHERE kind = 'script'"))
    for row in scripts.all():
        state = _script_state({"name": row.name, "fields": row.fields})
        connection.execute(
            sa.text("UPDATE authorled.documents SET name = :name, fields = :fields WHERE id = :id").bindparams(
                sa.bindparam("fields", type_=postgresql.JSONB)
            ),
            {"id": row.id, "name": state["name"], "fields": state["fields"]},
        )

    versions = connection.execute(
        sa.text(
            "SELECT v.id, v.content FROM authorled.document_versions v "
            "JOIN authorled.documents d ON d.id = v.document_id "
            "WHERE d.kind = 'script' AND v.part = 'fields'"
        )
    )
    for row in versions.all():
        connection.execute(_update("document_versions", "content"), {"id": row.id, "value": _script_state(row.content)})

    points = connection.execute(sa.text("SELECT id, content FROM authorled.draft_points"))
    for row in points.all():
        states = [_script_state(s) if s["kind"] == "script" else s for s in row.content["documents"]]
        connection.execute(
            _update("draft_points", "content"), {"id": row.id, "value": {**row.content, "documents": states}}
        )


def downgrade() -> None:
    raise NotImplementedError("Migrations of schema authorled go forward only.")

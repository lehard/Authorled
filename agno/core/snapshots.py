"""Snapshots of the parts of a document, taken as they are overwritten (openspec/specs/api/stories, «Снимки документа»).

A snapshot keeps the state a save replaces, with who saved that state and when. It runs in the transaction of the
save: a failed snapshot cancels the save.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, func, insert, select, text

from core.errors import RevisionConflict
from core.tables import document_versions, users

AUTO_INTERVAL = text("interval '10 minutes'")


def _due(connection: Connection, document_id: uuid.UUID, part: str) -> bool:
    recent = connection.execute(
        select(document_versions.c.id)
        .where(
            document_versions.c.document_id == document_id,
            document_versions.c.part == part,
            document_versions.c.created_at > func.now() - AUTO_INTERVAL,
        )
        .limit(1)
    ).first()
    return recent is None


def revision_conflict(
    connection: Connection,
    detail: str,
    saved_by: uuid.UUID,
    caller: uuid.UUID,
    part: str,
    refused: dict[str, Any] | None,
) -> RevisionConflict:
    """The refusal of a save on an old revision, naming who saved the current one."""
    name = connection.execute(select(users.c.display_name).where(users.c.id == saved_by)).scalar_one()
    return RevisionConflict(detail, name, saved_by == caller, part, refused)


def keep_refused(connection: Connection, document_id: uuid.UUID, conflict: RevisionConflict, caller: uuid.UUID) -> None:
    """Keep the state a save on an old revision tried to write, as a snapshot `conflict` of the caller.

    Runs in a transaction of its own after the refused one: the text a participant could not save is not lost.
    """
    if conflict.content is None:
        return
    connection.execute(
        insert(document_versions).values(
            created_at=func.clock_timestamp(),
            document_id=document_id,
            part=conflict.part,
            content=conflict.content,
            reason="conflict",
            saved_by=caller,
            saved_at=func.now(),
        )
    )


def keep(
    connection: Connection,
    document_id: uuid.UUID,
    part: str,
    content: dict[str, Any],
    saved_by: uuid.UUID,
    saved_at: datetime,
    reason: str | None = None,
) -> None:
    """Keep the state: always with a `reason`, without one only when the last snapshot of the part is old enough."""
    if reason is None:
        if not _due(connection, document_id, part):
            return
        reason = "auto"
    connection.execute(
        insert(document_versions).values(
            created_at=func.clock_timestamp(),
            document_id=document_id,
            part=part,
            content=content,
            reason=reason,
            saved_by=saved_by,
            saved_at=saved_at,
        )
    )

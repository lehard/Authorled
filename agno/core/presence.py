"""Who edits the screenplay of a draft now (openspec/specs/api/story-sharing, «Присутствие в тексте сценария»).

A screen with the text open for editing marks itself every 20 seconds; a mark younger than 60 seconds means the user
is there. A mark only warns, it never stops editing.
"""

import uuid

from sqlalchemy import Connection, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.tables import draft_presence, users

PRESENT_SECONDS = 60


def mark(connection: Connection, draft_id: uuid.UUID, user_id: uuid.UUID) -> list[str]:
    """Mark the user in the draft and name the others marked there within the last 60 seconds."""
    connection.execute(
        pg_insert(draft_presence)
        .values(draft_id=draft_id, user_id=user_id, seen_at=func.now())
        .on_conflict_do_update(index_elements=["draft_id", "user_id"], set_={"seen_at": func.now()})
    )
    return list(
        connection.execute(
            select(users.c.display_name)
            .join(draft_presence, draft_presence.c.user_id == users.c.id)
            .where(
                draft_presence.c.draft_id == draft_id,
                draft_presence.c.user_id != user_id,
                draft_presence.c.seen_at > func.now() - text(f"interval '{PRESENT_SECONDS} seconds'"),
            )
            .order_by(draft_presence.c.seen_at.desc())
        ).scalars()
    )

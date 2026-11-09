"""The notes of a demo story brought back to the demo state (openspec/changes/coauthor-tool-contracts, design,
decision 5; spec «Заметки истории перед просьбой»).

Notes belong to the story, not to a draft, so the fresh copy of a draft does not separate them: without this, a request
of the measurement of actions would see the notes an earlier request or run created or renamed. No model and no agent
here, so the core tests can check it on real PostgreSQL.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Connection

from core import notes
from demo.load import read_demo


class NotesMismatch(RuntimeError):
    """The notes of a story cannot be matched with its demo notes: the measurement stops, no request is run."""


@dataclass(frozen=True)
class DemoNote:
    title: str
    body: str
    trashed: bool


def demo_notes(title: str, demo: dict[str, Any] | None = None) -> tuple[DemoNote, ...]:
    """The notes of the demo story `title` in the order the demo loader creates them."""
    demo = read_demo() if demo is None else demo
    (project,) = (p for p in demo["projects"] if p["title"] == title)
    return tuple(
        DemoNote(n["title"], n["body"], n["deletedAt"] is not None)
        for n in demo["notes"]
        if n["projectId"] == project["id"]
    )


def restore_notes(
    connection: Connection, project_id: uuid.UUID, expected: tuple[DemoNote, ...], owner: uuid.UUID
) -> None:
    """Bring the notes of a story back to `expected`; every other note goes to the trash, nothing is deleted.

    The demo loader creates the demo notes first and in order, so they are the oldest notes of the story. A demo note
    is still itself when it keeps its title or its text begins with the demo text: the co-author renames notes and
    appends to them, but never trashes or restores one.
    """
    current = notes.list_notes(connection, project_id)
    if len(current) < len(expected):
        raise NotesMismatch(f"Story {project_id} has {len(current)} notes, the demo has {len(expected)}")
    for want, note in zip(expected, current, strict=False):
        if note.title != want.title and not note.body.startswith(want.body):
            raise NotesMismatch(f"Note «{note.title}» of story {project_id} is not the demo note «{want.title}»")
        if (note.deleted_at is not None) != want.trashed:
            raise NotesMismatch(f"Note «{note.title}» of story {project_id} is not in the trash state of the demo")
        if (note.title, note.body) != (want.title, want.body):
            if note.deleted_at is not None:
                raise NotesMismatch(f"Note «{note.title}» of story {project_id} changed in the trash")
            notes.update_note(connection, note.id, note.revision, {"title": want.title, "body": want.body}, owner)
    for note in current[len(expected) :]:
        if note.deleted_at is None:
            notes.trash_note(connection, note.id)

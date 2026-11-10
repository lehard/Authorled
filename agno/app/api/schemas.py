"""Response bodies of the story routes, for OpenAPI; built from the records of the core."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectOut(_Out):
    id: uuid.UUID
    title: str
    description: str
    format: str
    word_goal: int | None
    goal_deadline: date | None
    cover_color: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class ListedProjectOut(ProjectOut):
    drafts_count: int
    open_draft_id: uuid.UUID


class CreatedProject(BaseModel):
    project: ProjectOut
    draft_id: uuid.UUID
    script_id: uuid.UUID


class NextCoverColorOut(BaseModel):
    cover_color: str


class TemplatePointOut(_Out):
    name: str
    hint: str


class TemplateActOut(_Out):
    name: str
    points: list[TemplatePointOut]


class StoryTemplateOut(_Out):
    id: str
    name: str
    description: str
    acts: list[TemplateActOut]


class DraftOut(_Out):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    locked: bool
    forked_from_id: uuid.UUID | None
    forked_from_name: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class DocumentOut(_Out):
    id: uuid.UUID
    project_id: uuid.UUID
    draft_id: uuid.UUID
    kind: str
    name: str
    role: str | None
    summary: str
    position: int
    revision: int
    fields: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class NoteFileOut(_Out):
    """The original of a note made from a file."""

    id: uuid.UUID
    name: str
    media_type: str
    size_bytes: int


class NoteOut(_Out):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    body: str
    revision: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    file: NoteFileOut | None


class TextOut(_Out):
    document_id: uuid.UUID
    content: dict[str, Any]
    revision: int


class VersionOut(_Out):
    id: uuid.UUID
    part: str
    reason: str
    saved_by: uuid.UUID
    saved_by_name: str
    saved_at: datetime


class VersionContentOut(VersionOut):
    document_id: uuid.UUID
    content: dict[str, Any]


class RestoredOut(BaseModel):
    revision: int


class PointOut(_Out):
    id: uuid.UUID
    draft_id: uuid.UUID
    name: str
    kind: str
    created_by: uuid.UUID
    created_by_name: str
    created_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    # `user` or `coauthor`; the co-author is no user: its author_id is null, its name «Соавтор».
    author_kind: Literal["user", "coauthor"]
    author_id: uuid.UUID | None
    author_name: str
    author_role: str
    body: str
    created_at: datetime
    edited_at: datetime | None
    own: bool


class ThreadOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    quote: str
    # The scene of the quote of a co-author thread, by which the browser places its mark; null for the author's.
    scene_uid: str | None
    resolved_at: datetime | None
    created_at: datetime
    messages: list[MessageOut]


class SuggestionOut(_Out):
    id: uuid.UUID
    document_id: uuid.UUID
    scene_uid: str
    quote: str
    text: str
    why: str
    status: str
    session_id: str
    created_at: datetime
    decided_at: datetime | None


class FileOut(_Out):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    media_type: str
    size_bytes: int
    purpose: str
    session_id: str | None
    created_at: datetime


class SnippetOut(_Out):
    """Text around the first match: `match` as it is written, `…` where the core cut the text."""

    before: str
    match: str
    after: str


class SceneHitOut(_Out):
    """A scene; `number` 0 without `uid` gathers the paragraphs outside scenes."""

    uid: str | None
    number: int
    heading: str
    count: int
    snippet: SnippetOut


class DocumentHitOut(_Out):
    """A character, location or world; for the logline and the synopsis the screenplay of the draft."""

    id: uuid.UUID
    kind: Literal["character", "location", "world", "script"]
    name: str
    field: str
    count: int
    snippet: SnippetOut


class NoteHitOut(_Out):
    id: uuid.UUID
    title: str
    field: Literal["title", "body"]
    count: int
    snippet: SnippetOut


class SearchOut(_Out):
    query: str
    scenes: list[SceneHitOut]
    documents: list[DocumentHitOut]
    notes: list[NoteHitOut]


class WritingDayOut(_Out):
    date: date
    words: int | None
    met: bool | None


class StoryGoalOut(_Out):
    words: int
    goal: int | None
    deadline: date | None
    days_left: int | None
    per_day: int | None


class WritingOut(_Out):
    today: date
    daily_goal: int | None
    days: list[WritingDayOut]
    story: StoryGoalOut

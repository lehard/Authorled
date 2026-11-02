"""Response bodies of the story routes, for OpenAPI; built from the records of the core."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectOut(_Out):
    id: uuid.UUID
    title: str
    description: str
    format: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class CreatedProject(BaseModel):
    project: ProjectOut
    script_id: uuid.UUID


class DocumentOut(_Out):
    id: uuid.UUID
    project_id: uuid.UUID
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


class TextOut(_Out):
    document_id: uuid.UUID
    content: dict[str, Any]
    revision: int


class MessageOut(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
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

"""Shared parts of the product routes: the JSON body, If-Match, the caller and project access.

Bodies are read here, not by FastAPI parameters: FastAPI's validation errors would go through Agno's
app-wide handler, which does not answer problem+json (see app/api/me.py).
"""

import json
import uuid
from typing import Any

from fastapi import Request
from sqlalchemy import Connection
from starlette.datastructures import UploadFile

from app.api.problems import Problem
from app.auth import Principal, can_access_project
from core import members
from core.engine import get_engine
from core.projects import user_id_of
from core.tables import MAX_FILE_BYTES

# Role shown next to a comment: the story-team role of the author's group, empty for anyone else.
ROLE_OF_GROUP = {"editors": "редактор", "screenwriters": "сценарист"}

NOT_FOUND = "Не найдено."


async def read_json(request: Request) -> Any:
    try:
        return await request.json()
    except json.JSONDecodeError as error:
        raise Problem(422, "Unprocessable Content", "Тело запроса — не JSON.") from error


async def read_object(request: Request) -> dict[str, Any]:
    body = await read_json(request)
    if not isinstance(body, dict):
        raise Problem(422, "Unprocessable Content", "Тело запроса должно быть объектом JSON.")
    return body


async def read_small_object(request: Request, limit: int) -> dict[str, Any]:
    """A JSON object of at most `limit` bytes, checked by Content-Length and by the bytes actually read."""
    too_large = Problem(413, "Content Too Large", f"Тело запроса больше {limit // 1024} КБ.")
    length = request.headers.get("content-length")
    if length is not None and length.isdigit() and int(length) > limit:
        raise too_large
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > limit:
            raise too_large
    try:
        body = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise Problem(422, "Unprocessable Content", "Тело запроса — не JSON.") from error
    if not isinstance(body, dict):
        raise Problem(422, "Unprocessable Content", "Тело запроса должно быть объектом JSON.")
    return body


def if_match(request: Request) -> int:
    """The revision the change is based on: `If-Match: 7` (an ETag in quotes is accepted too)."""
    value = request.headers.get("If-Match")
    if value is None:
        raise Problem(428, "Precondition Required", "Нужен заголовок If-Match с ревизией, на которой основана правка.")
    revision = value.strip().removeprefix("W/").strip('"')
    if not revision.isdigit():
        raise Problem(422, "Unprocessable Content", f"If-Match должен быть номером ревизии, а не «{value}».")
    return int(revision)


def parse_id(value: str) -> uuid.UUID:
    """A path id; anything that is not a UUID is simply not found."""
    try:
        return uuid.UUID(value)
    except ValueError as error:
        raise Problem(404, "Not Found", NOT_FOUND) from error


def require_project(principal: Principal, project_id: uuid.UUID, need: members.Need) -> members.Role:
    """The caller's role in the story, which must allow `need` (openspec/specs/api/story-sharing, «Права ролей»).

    Without a role the story is not found: a missing and someone else's story look the same. A role that is too
    small is refused with 403 naming it.
    """
    if not can_access_project(principal, str(project_id)):
        raise Problem(404, "Not Found", NOT_FOUND)
    with get_engine().connect() as connection:
        role = members.role_of_subject(connection, principal.user_id, project_id)
    if role is None:
        raise Problem(404, "Not Found", NOT_FOUND)
    if not members.allows(role, need):
        raise Problem(403, "Forbidden", members.refusal(role, need))
    return role


def caller_id(connection: Connection, principal: Principal) -> uuid.UUID:
    return user_id_of(connection, principal.user_id)


def caller_role(principal: Principal) -> str:
    return next((ROLE_OF_GROUP[group] for group in principal.groups if group in ROLE_OF_GROUP), "")


TOO_LARGE = Problem(413, "Content Too Large", f"Файл больше {MAX_FILE_BYTES // (1024 * 1024)} МБ.")
# The multipart envelope around one file and a few short fields.
_ENVELOPE = 64 * 1024


async def read_upload(request: Request, fields: set[str]) -> tuple[dict[str, str], str, bytes]:
    """A multipart body with one file `file` and text `fields`; the file is read up to the limit + 1 byte."""
    length = request.headers.get("Content-Length")
    if length is not None and length.isdigit() and int(length) > MAX_FILE_BYTES + _ENVELOPE:
        raise TOO_LARGE
    async with request.form(max_files=1, max_fields=len(fields)) as form:
        unknown = set(form.keys()) - fields - {"file"}
        if unknown:
            raise Problem(422, "Unprocessable Content", f"Поле «{sorted(unknown)[0]}» здесь не принимается.")
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise Problem(422, "Unprocessable Content", "Поле «file»: нужен файл.")
        values: dict[str, str] = {}
        for name in fields:
            value = form.get(name)
            if isinstance(value, UploadFile):
                raise Problem(422, "Unprocessable Content", f"Поле «{name}» должно быть строкой.")
            if value is not None:
                values[name] = value
        data = await upload.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise TOO_LARGE
        return values, upload.filename or "", data


def is_multipart(request: Request) -> bool:
    return request.headers.get("Content-Type", "").startswith("multipart/form-data")

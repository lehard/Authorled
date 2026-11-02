"""Files of a story: /api/v1 (openspec/specs/api/files). Upload scans and reads the file before storing it.

The multipart body is read with its own limit, not through FastAPI parameters (app/api/body.py, read_upload).
"""

import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.body import caller_id, parse_id, read_upload, require_project
from app.api.problems import Problem
from app.api.schemas import FileOut
from app.auth import Principal, current_principal
from core import files
from core.engine import get_engine

router = APIRouter(prefix="/api/v1", tags=["Files"])


def _file(principal: Principal, raw: str) -> uuid.UUID:
    file_id = parse_id(raw)
    with get_engine().connect() as connection:
        require_project(principal, files.get_file(connection, file_id).project_id)
    return file_id


def _project(principal: Principal, raw: str) -> uuid.UUID:
    project_id = parse_id(raw)
    require_project(principal, project_id)
    return project_id


def _upload(
    principal: Principal, project_id: uuid.UUID, name: str, purpose: str, session_id: str | None, data: bytes
) -> FileOut:
    with get_engine().begin() as connection:
        stored = files.upload_file(
            connection, project_id, caller_id(connection, principal), name, purpose, session_id, data
        )
        return FileOut.model_validate(stored)


@router.post(
    "/projects/{project_id}/files",
    status_code=201,
    response_model=FileOut,
    summary="Upload a file: size and type, antivirus and text extraction before it is stored",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file", "purpose"],
                        "properties": {
                            "file": {"type": "string", "format": "binary"},
                            "purpose": {"type": "string", "enum": ["chat", "import"]},
                            "session_id": {"type": "string"},
                        },
                    }
                }
            },
        }
    },
)
async def upload(project_id: str, request: Request, principal: Principal = Depends(current_principal)) -> FileOut:
    found = await run_in_threadpool(_project, principal, project_id)
    values, name, data = await read_upload(request, {"purpose", "session_id"})
    purpose = values.get("purpose")
    if purpose is None:
        raise Problem(422, "Unprocessable Content", "Поле «purpose» должно быть chat или import.")
    session_id = values.get("session_id")
    return await run_in_threadpool(_upload, principal, found, name, purpose, session_id or None, data)


@router.get("/files/{file_id}", response_model=FileOut, summary="Metadata of a file")
def get_file(file_id: str, principal: Principal = Depends(current_principal)) -> FileOut:
    found = _file(principal, file_id)
    with get_engine().connect() as connection:
        return FileOut.model_validate(files.get_file(connection, found))


@router.get("/files/{file_id}/content", summary="The bytes of a file as uploaded")
def get_content(file_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _file(principal, file_id)
    with get_engine().connect() as connection:
        stored = files.get_file(connection, found)
        data = files.file_bytes(connection, found)
    disposition = f"attachment; filename*=UTF-8''{quote(stored.name)}"
    return Response(data, media_type=stored.media_type, headers={"Content-Disposition": disposition})


@router.delete("/files/{file_id}", status_code=204, summary="Delete a file for good")
def delete_file(file_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _file(principal, file_id)
    with get_engine().begin() as connection:
        files.delete_file(connection, found)
    return Response(status_code=204)

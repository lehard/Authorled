"""Stories, their drafts, documents, texts and trash: /api/v1 (openspec/specs/api/stories).

Every route first finds the story of the record and checks the caller's access to it through the auth
module; a missing and someone else's record both answer 404.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.body import (
    caller_id,
    if_match,
    is_multipart,
    parse_id,
    read_json,
    read_object,
    read_upload,
    require_project,
)
from app.api.problems import Problem
from app.api.schemas import (
    CreatedProject,
    DocumentOut,
    DraftOut,
    ListedProjectOut,
    ProjectOut,
    StoryTemplateOut,
    TextOut,
)
from app.auth import Principal, current_principal
from core import documents as docs
from core import drafts, imports, story_templates, texts, writing
from core import projects as stories
from core.engine import get_engine

router = APIRouter(prefix="/api/v1", tags=["Stories"])

# A broken templates file stops the API at startup (openspec/specs/api/stories, «Каркасы историй»).
story_templates.templates()


def _etag(response: Response, revision: int) -> None:
    response.headers["ETag"] = f'"{revision}"'


def _project_id(principal: Principal, raw: str) -> uuid.UUID:
    project_id = parse_id(raw)
    require_project(principal, project_id)
    return project_id


def _draft_id(principal: Principal, raw: str) -> uuid.UUID:
    draft_id = parse_id(raw)
    with get_engine().connect() as connection:
        project_id = drafts.project_of_draft(connection, draft_id)
    require_project(principal, project_id)
    return draft_id


def _document_id(principal: Principal, raw: str) -> uuid.UUID:
    document_id = parse_id(raw)
    with get_engine().connect() as connection:
        project_id = docs.project_of_document(connection, document_id)
    require_project(principal, project_id)
    return document_id


# --- stories


@router.get("/projects", response_model=list[ListedProjectOut], summary="The caller's stories, or their trash")
def list_projects(trash: bool = False, principal: Principal = Depends(current_principal)) -> list[ListedProjectOut]:
    with get_engine().connect() as connection:
        owner = caller_id(connection, principal)
        return [ListedProjectOut.model_validate(p) for p in stories.list_projects(connection, owner, trash)]


def _create_project(principal: Principal, body: dict[str, Any]) -> CreatedProject:
    unknown = set(body) - {"title", "description", "template"}
    if unknown:
        name = sorted(unknown)[0]
        raise Problem(422, "Unprocessable Content", f"Поле «{name}» нельзя задать при создании.")
    # Without a template the core writes one empty scene heading; with it, the text of the template.
    text = story_templates.screenplay(body["template"]) if "template" in body else None
    with get_engine().begin() as connection:
        owner = caller_id(connection, principal)
        project, draft_id, script_id = stories.create_project(
            connection, owner, body.get("title"), body.get("description", ""), text
        )
    return CreatedProject(project=ProjectOut.model_validate(project), draft_id=draft_id, script_id=script_id)


def _create_project_from_file(principal: Principal, title: str | None, name: str, data: bytes) -> CreatedProject:
    with get_engine().begin() as connection:
        owner = caller_id(connection, principal)
        project, draft_id, script_id = imports.create_project_from_file(connection, owner, title, name, data)
    return CreatedProject(project=ProjectOut.model_validate(project), draft_id=draft_id, script_id=script_id)


@router.post(
    "/projects",
    status_code=201,
    response_model=CreatedProject,
    summary="Create a story: JSON with a title, or multipart with a title and a manuscript file to import",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["title"],
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "template": {
                                "type": "string",
                                "description": "id of a structure template from GET /api/v1/story-templates",
                            },
                        },
                    }
                },
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["title", "file"],
                        "properties": {"title": {"type": "string"}, "file": {"type": "string", "format": "binary"}},
                    }
                },
            },
        }
    },
)
async def create_project(request: Request, principal: Principal = Depends(current_principal)) -> CreatedProject:
    if is_multipart(request):
        # `template` is read only to refuse it by name: a story from a manuscript starts from its text.
        values, name, data = await read_upload(request, {"title", "template"})
        if "template" in values:
            raise Problem(422, "Unprocessable Content", "Поле «template»: история из рукописи создаётся без каркаса.")
        return await run_in_threadpool(_create_project_from_file, principal, values.get("title"), name, data)
    body = await read_object(request)
    return await run_in_threadpool(_create_project, principal, body)


@router.get(
    "/story-templates",
    response_model=list[StoryTemplateOut],
    summary="Structure templates of a new story: acts and their points with hints",
)
def list_story_templates(principal: Principal = Depends(current_principal)) -> list[StoryTemplateOut]:
    return [StoryTemplateOut.model_validate(found) for found in story_templates.templates()]


def _update_project(project_id: uuid.UUID, body: dict[str, Any]) -> ProjectOut:
    with get_engine().begin() as connection:
        return ProjectOut.model_validate(stories.update_project(connection, project_id, body))


@router.patch(
    "/projects/{project_id}", response_model=ProjectOut, summary="Rename or describe a story, or set its goal in words"
)
async def update_project(
    project_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> ProjectOut:
    body = await read_object(request)
    found = await run_in_threadpool(_project_id, principal, project_id)
    return await run_in_threadpool(_update_project, found, body)


@router.post("/projects/{project_id}/trash", response_model=ProjectOut, summary="Move a story to the trash")
def trash_project(project_id: str, principal: Principal = Depends(current_principal)) -> ProjectOut:
    found = _project_id(principal, project_id)
    with get_engine().begin() as connection:
        return ProjectOut.model_validate(stories.trash_project(connection, found))


@router.post("/projects/{project_id}/restore", response_model=ProjectOut, summary="Restore a story from the trash")
def restore_project(project_id: str, principal: Principal = Depends(current_principal)) -> ProjectOut:
    found = _project_id(principal, project_id)
    with get_engine().begin() as connection:
        return ProjectOut.model_validate(stories.restore_project(connection, found))


@router.delete("/projects/{project_id}", status_code=204, summary="Delete a story from the trash for good")
def delete_project(project_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _project_id(principal, project_id)
    with get_engine().begin() as connection:
        stories.delete_project(connection, found)
    return Response(status_code=204)


# --- drafts of a story


@router.get(
    "/projects/{project_id}/drafts",
    response_model=list[DraftOut],
    summary="The drafts of a story, the trash included",
)
def list_drafts(project_id: str, principal: Principal = Depends(current_principal)) -> list[DraftOut]:
    found = _project_id(principal, project_id)
    with get_engine().connect() as connection:
        return [DraftOut.model_validate(d) for d in drafts.list_drafts(connection, found)]


def _create_draft(principal: Principal, project_id: uuid.UUID, body: dict[str, Any]) -> DraftOut:
    unknown = set(body) - {"name", "base_id"}
    if unknown:
        field = sorted(unknown)[0]
        raise Problem(422, "Unprocessable Content", f"Поле «{field}» нельзя задать при создании драфта.")
    base = body.get("base_id")
    if not isinstance(base, str):
        raise Problem(422, "Unprocessable Content", "Поле «base_id»: нужен id драфта-основы.")
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return DraftOut.model_validate(
            drafts.create_draft(connection, project_id, body.get("name"), parse_id(base), user)
        )


@router.post(
    "/projects/{project_id}/drafts",
    status_code=201,
    response_model=DraftOut,
    summary="Create a draft: an independent copy of another draft, without review and history",
)
async def create_draft(
    project_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> DraftOut:
    body = await read_object(request)
    found = await run_in_threadpool(_project_id, principal, project_id)
    return await run_in_threadpool(_create_draft, principal, found, body)


def _update_draft(draft_id: uuid.UUID, body: dict[str, Any]) -> DraftOut:
    with get_engine().begin() as connection:
        return DraftOut.model_validate(drafts.update_draft(connection, draft_id, body))


@router.patch("/drafts/{draft_id}", response_model=DraftOut, summary="Rename a draft or set its lock")
async def update_draft(draft_id: str, request: Request, principal: Principal = Depends(current_principal)) -> DraftOut:
    body = await read_object(request)
    found = await run_in_threadpool(_draft_id, principal, draft_id)
    return await run_in_threadpool(_update_draft, found, body)


@router.post("/drafts/{draft_id}/trash", response_model=DraftOut, summary="Move a draft to the trash of its story")
def trash_draft(draft_id: str, principal: Principal = Depends(current_principal)) -> DraftOut:
    found = _draft_id(principal, draft_id)
    with get_engine().begin() as connection:
        return DraftOut.model_validate(drafts.trash_draft(connection, found))


@router.post("/drafts/{draft_id}/restore", response_model=DraftOut, summary="Restore a draft from the trash")
def restore_draft(draft_id: str, principal: Principal = Depends(current_principal)) -> DraftOut:
    found = _draft_id(principal, draft_id)
    with get_engine().begin() as connection:
        return DraftOut.model_validate(drafts.restore_draft(connection, found))


@router.delete("/drafts/{draft_id}", status_code=204, summary="Delete a draft from the trash for good")
def delete_draft(draft_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _draft_id(principal, draft_id)
    with get_engine().begin() as connection:
        drafts.delete_draft(connection, found)
    return Response(status_code=204)


@router.post("/drafts/{draft_id}/open", status_code=204, summary="Remember the draft the caller opened last")
def open_draft(draft_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _draft_id(principal, draft_id)
    with get_engine().begin() as connection:
        drafts.open_draft(connection, found, caller_id(connection, principal))
    return Response(status_code=204)


# --- documents of a draft


@router.get(
    "/drafts/{draft_id}/documents",
    response_model=list[DocumentOut],
    summary="The navigator tree: all documents of a draft, the trash included, without texts",
)
def list_documents(draft_id: str, principal: Principal = Depends(current_principal)) -> list[DocumentOut]:
    found = _draft_id(principal, draft_id)
    with get_engine().connect() as connection:
        return [DocumentOut.model_validate(d) for d in docs.list_documents(connection, found)]


def _create_documents(principal: Principal, draft_id: uuid.UUID, items: list[Any]) -> list[DocumentOut]:
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return [DocumentOut.model_validate(d) for d in docs.create_documents(connection, draft_id, items, user)]


@router.post(
    "/drafts/{draft_id}/documents",
    status_code=201,
    response_model=list[DocumentOut],
    summary="Create characters, locations or worlds: one (object) or several (array), all or none",
)
async def create_documents(
    draft_id: str, request: Request, principal: Principal = Depends(current_principal)
) -> list[DocumentOut]:
    body = await read_json(request)
    items = body if isinstance(body, list) else [body]
    found = await run_in_threadpool(_draft_id, principal, draft_id)
    return await run_in_threadpool(_create_documents, principal, found, items)


def _import(principal: Principal, draft_id: uuid.UUID, revision: int, body: dict[str, Any]) -> TextOut:
    unknown = set(body) - {"file_id"}
    if unknown:
        raise Problem(422, "Unprocessable Content", f"Поле «{sorted(unknown)[0]}» здесь не принимается.")
    raw = body.get("file_id")
    if not isinstance(raw, str):
        raise Problem(422, "Unprocessable Content", "Поле «file_id»: нужен id загруженного файла.")
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return TextOut.model_validate(imports.import_into(connection, draft_id, parse_id(raw), revision, user))


@router.post(
    "/drafts/{draft_id}/import",
    response_model=TextOut,
    summary="Replace the screenplay text of a draft by an uploaded manuscript, based on the text revision (If-Match)",
)
async def import_file(
    draft_id: str, request: Request, response: Response, principal: Principal = Depends(current_principal)
) -> TextOut:
    body = await read_object(request)
    found = await run_in_threadpool(_draft_id, principal, draft_id)
    text = await run_in_threadpool(_import, principal, found, if_match(request), body)
    _etag(response, text.revision)
    return text


@router.post(
    "/drafts/{draft_id}/trash/empty",
    status_code=204,
    summary="Empty the trash: the documents of this draft and the drafts of the story",
)
def empty_trash(draft_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _draft_id(principal, draft_id)
    with get_engine().begin() as connection:
        drafts.empty_trash(connection, found)
    return Response(status_code=204)


# --- one document


@router.get("/documents/{document_id}", response_model=DocumentOut, summary="A document with its revision")
def get_document(
    document_id: str, response: Response, principal: Principal = Depends(current_principal)
) -> DocumentOut:
    found = _document_id(principal, document_id)
    with get_engine().connect() as connection:
        document = docs.document_row(connection, found)
    _etag(response, document.revision)
    return DocumentOut.model_validate(document)


def _update_document(principal: Principal, document_id: uuid.UUID, revision: int, body: dict[str, Any]) -> DocumentOut:
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return DocumentOut.model_validate(docs.update_document(connection, document_id, revision, body, user))


@router.patch(
    "/documents/{document_id}",
    response_model=DocumentOut,
    summary="Change a document based on its revision (If-Match)",
)
async def update_document(
    document_id: str, request: Request, response: Response, principal: Principal = Depends(current_principal)
) -> DocumentOut:
    body = await read_object(request)
    found = await run_in_threadpool(_document_id, principal, document_id)
    document = await run_in_threadpool(_update_document, principal, found, if_match(request), body)
    _etag(response, document.revision)
    return document


@router.post("/documents/{document_id}/trash", response_model=DocumentOut, summary="Move a document to the trash")
def trash_document(document_id: str, principal: Principal = Depends(current_principal)) -> DocumentOut:
    found = _document_id(principal, document_id)
    with get_engine().begin() as connection:
        return DocumentOut.model_validate(docs.trash_document(connection, found))


@router.post(
    "/documents/{document_id}/restore", response_model=DocumentOut, summary="Restore a document from the trash"
)
def restore_document(document_id: str, principal: Principal = Depends(current_principal)) -> DocumentOut:
    found = _document_id(principal, document_id)
    with get_engine().begin() as connection:
        return DocumentOut.model_validate(docs.restore_document(connection, found))


@router.delete("/documents/{document_id}", status_code=204, summary="Delete a document from the trash for good")
def delete_document(document_id: str, principal: Principal = Depends(current_principal)) -> Response:
    found = _document_id(principal, document_id)
    with get_engine().begin() as connection:
        docs.delete_document(connection, found)
    return Response(status_code=204)


@router.get("/documents/{document_id}/text", response_model=TextOut, summary="Text of the screenplay of a draft")
def get_text(document_id: str, response: Response, principal: Principal = Depends(current_principal)) -> TextOut:
    found = _document_id(principal, document_id)
    with get_engine().connect() as connection:
        text = texts.get_text(connection, found)
    _etag(response, text.revision)
    return TextOut.model_validate(text)


def _put_text(principal: Principal, document_id: uuid.UUID, revision: int, content: Any) -> TextOut:
    with get_engine().begin() as connection:
        user = caller_id(connection, principal)
        return TextOut.model_validate(writing.save_author_text(connection, document_id, revision, content, user))


@router.put(
    "/documents/{document_id}/text",
    response_model=TextOut,
    summary="Replace the whole text based on its revision (If-Match)",
)
async def put_text(
    document_id: str, request: Request, response: Response, principal: Principal = Depends(current_principal)
) -> TextOut:
    content = await read_json(request)
    found = await run_in_threadpool(_document_id, principal, document_id)
    text = await run_in_threadpool(_put_text, principal, found, if_match(request), content)
    _etag(response, text.revision)
    return text

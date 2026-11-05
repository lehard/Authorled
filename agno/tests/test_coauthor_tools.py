"""Tools of the co-author (openspec/specs/api/agents: «Инструменты соавтора», «Предложение правки соавтором»)."""

import json
import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from agno.run import RunContext

from agents.coauthor_tools import (
    STORY_NOT_FOUND,
    list_story_documents,
    read_chat_file,
    read_screenplay,
    read_story_document,
    suggest_edit,
)
from app.auth import run_principal

SCENE = {"type": "sceneHeading", "attrs": {"uid": "s3"}, "content": [{"type": "text", "text": "НАТ. ОЗЕРО — ДЕНЬ"}]}
ACTION = {"type": "action", "content": [{"type": "text", "text": "Вера молчит."}]}


def _run(subject: str, session_id: str, groups: list[str] | None = None) -> RunContext:
    claims = {"sub": subject, "groups": groups if groups is not None else ["screenwriters"]}
    authority = SimpleNamespace(context=SimpleNamespace(principal_id=subject, claims=claims))
    return RunContext(run_id="r1", session_id=session_id, user_id=subject, authorization=authority)


def _story_with_vera(author: Any) -> tuple[str, str, str]:
    """The project, the draft and the screenplay of a story with Vera and scene s3."""
    story = author.story("Тихая вода")
    project_id = story["project"]["id"]
    author.post(
        f"/api/v1/drafts/{story['draft_id']}/documents",
        json={"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "Что Аня узнает правду"}},
    )
    text = {"type": "doc", "content": [SCENE, ACTION]}
    assert (
        author.put(f"/api/v1/documents/{story['script_id']}/text", json=text, headers={"If-Match": "1"}).status_code
        == 200
    )
    return project_id, story["draft_id"], story["script_id"]


def test_run_principal() -> None:
    principal = run_principal(_run("s1", "x:1", ["editors"]))
    assert principal.user_id == "s1"
    assert "agents:coauthor:run" in principal.scopes


def test_run_without_caller_is_refused() -> None:
    with pytest.raises(RuntimeError, match="no verified caller"):
        run_principal(RunContext(run_id="r1", session_id="x:1", user_id="s1", authorization=None))


def test_run_of_another_user_is_refused() -> None:
    run = _run("s1", "x:1")
    run.user_id = "s2"
    with pytest.raises(RuntimeError, match="another user"):
        run_principal(run)


def test_read_the_story(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    listed = json.loads(list_story_documents(run))
    vera = next(d for d in listed if d["name"] == "Вера")
    assert json.loads(read_story_document(run, vera["id"]))["fields"] == {"fear": "Что Аня узнает правду"}
    whole = read_screenplay(run)
    assert "Сцена 1, uid s3" in whole and "[action] Вера молчит." in whole
    assert read_screenplay(run, "s3").splitlines()[0] == "Сцена 1, uid s3"
    assert read_screenplay(run, "s9").startswith("Отказ")


def test_foreign_story(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id, draft_id, _ = _story_with_vera(owner)
    run = _run(stranger.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert list_story_documents(run) == STORY_NOT_FOUND
    assert suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "") == STORY_NOT_FOUND


def test_conversation_without_story(authors: Any) -> None:
    author = authors()
    assert list_story_documents(_run(author.subject, "no-story")).startswith("Отказ")


def test_suggestion(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    run = _run(author.subject, session)
    refused = suggest_edit(run, "s3", "Вода холодная", "Вода тёплая", "")
    assert "Цитата не найдена в сцене" in refused
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []
    answer = suggest_edit(run, "s3", "Вера молчит", "Вера отворачивается", "Действие сильнее")
    assert "ждёт" in answer or "отправлено" in answer
    (suggestion,) = author.get(f"/api/v1/documents/{script_id}/suggestions?status=open").json()
    assert (suggestion["quote"], suggestion["session_id"]) == ("Вера молчит", session)
    assert author.get(f"/api/v1/documents/{script_id}/text").json()["revision"] == 2


def test_chat_file_of_this_conversation(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("заметки.txt", "Вера боится воды".encode())},
        data={"purpose": "chat", "session_id": session},
    ).json()
    assert "Вера боится воды" in read_chat_file(_run(author.subject, session), uploaded["id"])
    other = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert read_chat_file(other, uploaded["id"]).startswith("Отказ")


def _second_draft(author: Any, project_id: str, draft_id: str) -> str:
    created = author.post(f"/api/v1/projects/{project_id}/drafts", json={"name": "Драфт 2", "base_id": draft_id})
    assert created.status_code == 201, created.text
    second: str = created.json()["id"]
    return second


def test_conversation_sees_only_its_draft(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    tree = author.get(f"/api/v1/drafts/{second}/documents").json()
    copy_of_vera = next(d for d in tree if d["name"] == "Вера")
    author.post(f"/api/v1/drafts/{second}/documents", json={"kind": "character", "name": "Нина", "role": "main"})
    first = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert "Нина" not in list_story_documents(first)
    assert read_story_document(first, copy_of_vera["id"]) == "Отказ: документ не найден."


def test_suggestion_goes_to_the_draft_of_the_conversation(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    copy = next(d for d in author.get(f"/api/v1/drafts/{second}/documents").json() if d["kind"] == "script")
    run = _run(author.subject, f"{project_id}:{second}:{uuid.uuid4()}")
    suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "")
    assert len(author.get(f"/api/v1/documents/{copy['id']}/suggestions").json()) == 1
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []


def test_locked_draft_refuses_a_suggestion(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    author.patch(f"/api/v1/drafts/{draft_id}", json={"locked": True})
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "").startswith("Отказ")
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []


def test_draft_in_the_trash_is_refused(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    assert author.post(f"/api/v1/drafts/{second}/trash").status_code == 200
    run = _run(author.subject, f"{project_id}:{second}:{uuid.uuid4()}")
    assert list_story_documents(run).startswith("Отказ")


def test_old_conversation_is_refused(authors: Any) -> None:
    author = authors()
    project_id, _, _ = _story_with_vera(author)
    assert list_story_documents(_run(author.subject, f"{project_id}:{uuid.uuid4()}")).startswith("Отказ")


def test_draft_of_another_story_is_refused(authors: Any) -> None:
    author = authors()
    project_id, _, _ = _story_with_vera(author)
    _, other_draft, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{other_draft}:{uuid.uuid4()}")
    assert list_story_documents(run) == STORY_NOT_FOUND

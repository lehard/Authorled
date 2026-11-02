"""Routes of comments and suggestions (openspec/specs/api/review)."""

import uuid
from typing import Any

from sqlalchemy import Engine

from core.review import create_suggestion

SCENE = {"type": "sceneHeading", "attrs": {"uid": "s3"}, "content": [{"type": "text", "text": "НАТ. ОЗЕРО — ДЕНЬ"}]}
ACTION = {"type": "action", "content": [{"type": "text", "text": "Вера молчит."}]}


def _screenplay(author: Any) -> str:
    story = author.story()
    url = f"/api/v1/documents/{story['script_id']}/text"
    assert (
        author.put(url, json={"type": "doc", "content": [SCENE, ACTION]}, headers={"If-Match": "1"}).status_code == 200
    )
    script_id: str = story["script_id"]
    return script_id


def test_thread_reply_resolve(authors: Any) -> None:
    author = authors(groups=["editors"])
    script_id = _screenplay(author)
    thread_id = str(uuid.uuid4())
    created = author.post(
        f"/api/v1/documents/{script_id}/comments",
        json={"id": thread_id, "quote": "Вера молчит", "body": "Слишком прямо"},
    )
    assert created.status_code == 201
    message = created.json()["messages"][0]
    assert (message["own"], message["author_role"], message["author_name"]) == (True, "редактор", "Анна Петрова")
    again = author.post(f"/api/v1/documents/{script_id}/comments", json={"id": thread_id, "quote": "В", "body": "Ещё"})
    assert again.status_code == 409
    replied = author.post(f"/api/v1/comments/{thread_id}/replies", json={"body": "Согласна"})
    assert len(replied.json()["messages"]) == 2
    resolved = author.patch(f"/api/v1/comments/{thread_id}", json={"resolved": True})
    assert resolved.json()["resolved_at"] is not None
    reply_id = replied.json()["messages"][1]["id"]
    edited = author.patch(f"/api/v1/comments/{thread_id}/messages/{reply_id}", json={"body": "Согласна полностью"})
    assert edited.json()["messages"][1]["edited_at"] is not None
    first_id = replied.json()["messages"][0]["id"]
    assert author.delete(f"/api/v1/comments/{thread_id}/messages/{first_id}").status_code == 204
    assert author.get(f"/api/v1/documents/{script_id}/comments").json() == []


def test_empty_comment(authors: Any) -> None:
    author = authors()
    script_id = _screenplay(author)
    response = author.post(
        f"/api/v1/documents/{script_id}/comments", json={"id": str(uuid.uuid4()), "quote": "Вера", "body": " "}
    )
    assert response.status_code == 422


def test_foreign_thread_is_not_found(authors: Any) -> None:
    owner, stranger = authors(), authors()
    script_id = _screenplay(owner)
    thread_id = str(uuid.uuid4())
    owner.post(f"/api/v1/documents/{script_id}/comments", json={"id": thread_id, "quote": "Вера", "body": "Да"})
    assert stranger.post(f"/api/v1/comments/{thread_id}/replies", json={"body": "Нет"}).status_code == 404
    assert stranger.get(f"/api/v1/documents/{script_id}/comments").status_code == 404


def test_suggestions(authors: Any, engine: Engine) -> None:
    author = authors()
    script_id = _screenplay(author)
    with engine.begin() as connection:
        open_one = create_suggestion(
            connection, uuid.UUID(script_id), "s3", "Вера молчит", "Вера отворачивается", "", "x:1"
        )
        other = create_suggestion(connection, uuid.UUID(script_id), "s3", "молчит", "кричит", "", "x:1")
    rejected = author.patch(f"/api/v1/suggestions/{other.id}", json={"status": "rejected"})
    assert rejected.status_code == 200 and rejected.json()["decided_at"] is not None
    listed = author.get(f"/api/v1/documents/{script_id}/suggestions?status=open").json()
    assert [s["id"] for s in listed] == [str(open_one.id)]
    assert author.patch(f"/api/v1/suggestions/{other.id}", json={"status": "accepted"}).status_code == 409
    assert author.get(f"/api/v1/documents/{script_id}/suggestions?status=maybe").status_code == 422

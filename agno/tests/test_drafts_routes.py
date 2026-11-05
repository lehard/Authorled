"""Routes of drafts, history and points (openspec/specs/api/stories)."""

from typing import Any

import pytest

DOC = {"type": "doc", "content": [{"type": "sceneHeading", "attrs": {"uid": "s1"}}]}


def _second(author: Any, story: dict[str, Any]) -> dict[str, Any]:
    created = author.post(
        f"/api/v1/projects/{story['project']['id']}/drafts", json={"name": "Драфт 2", "base_id": story["draft_id"]}
    )
    assert created.status_code == 201, created.text
    second: dict[str, Any] = created.json()
    return second


def test_new_story_lists_its_draft(authors: Any) -> None:
    author = authors()
    story = author.story()
    (draft,) = author.get(f"/api/v1/projects/{story['project']['id']}/drafts").json()
    assert (draft["id"], draft["name"], draft["locked"]) == (story["draft_id"], "Драфт 1", False)
    (listed,) = author.get("/api/v1/projects").json()
    assert (listed["drafts_count"], listed["open_draft_id"]) == (1, story["draft_id"])


def test_rename_lock_and_open(authors: Any) -> None:
    author = authors()
    story = author.story()
    second = _second(author, story)
    renamed = author.patch(f"/api/v1/drafts/{second['id']}", json={"name": "Для продюсера", "locked": True})
    assert (renamed.json()["name"], renamed.json()["locked"]) == ("Для продюсера", True)
    assert author.post(f"/api/v1/drafts/{second['id']}/open").status_code == 204
    assert author.get("/api/v1/projects").json()[0]["open_draft_id"] == second["id"]
    assert author.patch(f"/api/v1/drafts/{second['id']}", json={"color": "red"}).status_code == 422


def test_base_is_required(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/projects/{story['project']['id']}/drafts"
    assert author.post(url, json={"name": "Драфт 2"}).status_code == 422
    assert author.post(url, json={"name": "Драфт 2", "base_id": story["draft_id"], "locked": True}).status_code == 422


def test_base_of_another_story_is_not_found(authors: Any) -> None:
    author = authors()
    first, second = author.story("Маяк"), author.story("Паром")
    response = author.post(
        f"/api/v1/projects/{first['project']['id']}/drafts", json={"name": "Драфт", "base_id": second["draft_id"]}
    )
    assert response.status_code == 404


def test_trash_restore_and_delete(authors: Any) -> None:
    author = authors()
    story = author.story()
    assert author.post(f"/api/v1/drafts/{story['draft_id']}/trash").status_code == 409
    second = _second(author, story)
    assert author.delete(f"/api/v1/drafts/{second['id']}").status_code == 409
    assert author.post(f"/api/v1/drafts/{second['id']}/trash").json()["deleted_at"] is not None
    assert author.post(f"/api/v1/drafts/{second['id']}/open").status_code == 409
    assert author.post(f"/api/v1/drafts/{second['id']}/restore").json()["deleted_at"] is None
    author.post(f"/api/v1/drafts/{second['id']}/trash")
    assert author.delete(f"/api/v1/drafts/{second['id']}").status_code == 204
    assert author.get(f"/api/v1/drafts/{second['id']}/documents").status_code == 404


def test_history_and_rollback(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/documents/{story['script_id']}/text"
    assert author.put(url, json=DOC, headers={"If-Match": "1"}).status_code == 200
    (version,) = author.get(f"/api/v1/documents/{story['script_id']}/versions?part=text").json()
    assert (version["reason"], version["saved_by_name"]) == ("auto", "Анна Петрова")
    detail = author.get(f"/api/v1/versions/{version['id']}").json()
    assert detail["document_id"] == story["script_id"] and detail["content"]["type"] == "doc"
    restore = f"/api/v1/versions/{version['id']}/restore"
    assert author.post(restore).status_code == 428
    assert author.post(restore, headers={"If-Match": "1"}).status_code == 409
    assert author.post(restore, headers={"If-Match": "2"}).json() == {"revision": 3}


def test_unknown_part_is_refused(authors: Any) -> None:
    author = authors()
    story = author.story()
    response = author.get(f"/api/v1/documents/{story['script_id']}/versions?part=cover")
    assert response.status_code == 422
    assert "part" in response.json()["detail"]


def test_points(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/drafts/{story['draft_id']}/points"
    assert author.post(url, json={"name": " "}).status_code == 422
    assert author.post(url, json={"name": "Точка", "kind": "auto"}).status_code == 422
    point = author.post(url, json={"name": "Точка"})
    assert point.status_code == 201
    assert point.json()["created_by_name"] == "Анна Петрова"
    saved = author.post(f"/api/v1/points/{point.json()['id']}/restore")
    assert saved.status_code == 200 and saved.json()["kind"] == "auto"
    assert [p["name"] for p in author.get(url).json()] == ["Перед откатом к «Точка»", "Точка"]


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/projects/{project}/drafts"),
        ("post", "/api/v1/projects/{project}/drafts"),
        ("patch", "/api/v1/drafts/{draft}"),
        ("post", "/api/v1/drafts/{draft}/trash"),
        ("post", "/api/v1/drafts/{draft}/restore"),
        ("delete", "/api/v1/drafts/{draft}"),
        ("post", "/api/v1/drafts/{draft}/open"),
        ("get", "/api/v1/drafts/{draft}/documents"),
        ("post", "/api/v1/drafts/{draft}/documents"),
        ("post", "/api/v1/drafts/{draft}/import"),
        ("post", "/api/v1/drafts/{draft}/trash/empty"),
        ("get", "/api/v1/drafts/{draft}/points"),
        ("post", "/api/v1/drafts/{draft}/points"),
        ("post", "/api/v1/points/{point}/restore"),
        ("get", "/api/v1/documents/{script}/versions?part=text"),
        ("get", "/api/v1/versions/{version}"),
        ("post", "/api/v1/versions/{version}/restore"),
    ],
)
def test_someone_elses_records_are_not_found(authors: Any, method: str, path: str) -> None:
    owner, stranger = authors(), authors()
    story = owner.story()
    owner.put(f"/api/v1/documents/{story['script_id']}/text", json=DOC, headers={"If-Match": "1"})
    (version,) = owner.get(f"/api/v1/documents/{story['script_id']}/versions?part=text").json()
    point = owner.post(f"/api/v1/drafts/{story['draft_id']}/points", json={"name": "Точка"}).json()
    url = path.format(
        project=story["project"]["id"],
        draft=story["draft_id"],
        script=story["script_id"],
        version=version["id"],
        point=point["id"],
    )
    kwargs: dict[str, Any] = {"headers": {"If-Match": "1"}}
    if method in ("post", "patch"):
        kwargs["json"] = {}
    assert getattr(stranger, method)(url, **kwargs).status_code == 404

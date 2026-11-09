"""GET /api/v1/drafts/{id}/search (openspec/specs/api/stories, «Поиск по драфту истории» … «Отказы поиска»)."""

import uuid
from typing import Any

from tests.routes import PROBLEM

TEXT = {
    "type": "doc",
    "content": [
        {"type": "sceneHeading", "attrs": {"uid": "s1"}, "content": [{"type": "text", "text": "ИНТ. ГАРАЖ — ДЕНЬ"}]},
        {"type": "action", "content": [{"type": "text", "text": "КОЛЯ протирает ключ ветошью."}]},
    ],
}


def _story(author: Any) -> dict[str, Any]:
    """A story with a scene, a character and a note that all say «ключ»."""
    story: dict[str, Any] = author.story("Тихая вода")
    response = author.put(f"/api/v1/documents/{story['script_id']}/text", json=TEXT, headers={"If-Match": "1"})
    assert response.status_code == 200, response.text
    response = author.post(
        f"/api/v1/drafts/{story['draft_id']}/documents",
        json={"kind": "character", "name": "Коля", "role": "secondary", "fields": {"habits": "Носит ключ на шее"}},
    )
    assert response.status_code == 201, response.text
    response = author.post(f"/api/v1/projects/{story['project']['id']}/notes", json={"title": "Ключ", "body": ""})
    assert response.status_code == 201, response.text
    return story


def test_groups(authors: Any) -> None:
    author = authors()
    story = _story(author)
    response = author.get(f"/api/v1/drafts/{story['draft_id']}/search", params={"q": "КЛЮЧ"})
    assert response.status_code == 200, response.text
    found = response.json()
    assert found["query"] == "КЛЮЧ"
    assert found["scenes"] == [
        {
            "uid": "s1",
            "number": 1,
            "heading": "ИНТ. ГАРАЖ — ДЕНЬ",
            "count": 1,
            "snippet": {"before": "КОЛЯ протирает ", "match": "ключ", "after": " ветошью."},
        }
    ]
    (kolya,) = found["documents"]
    assert (kolya["kind"], kolya["name"], kolya["field"], kolya["snippet"]["match"]) == (
        "character",
        "Коля",
        "habits",
        "ключ",
    )
    (note,) = found["notes"]
    assert (note["title"], note["field"], note["count"]) == ("Ключ", "title", 1)


def test_nothing_found(authors: Any) -> None:
    author = authors()
    story = author.story()
    response = author.get(f"/api/v1/drafts/{story['draft_id']}/search", params={"q": "дирижабль"})
    assert response.status_code == 200
    assert response.json() == {"query": "дирижабль", "scenes": [], "documents": [], "notes": []}


def test_refusals(authors: Any) -> None:
    author = authors()
    url = f"/api/v1/drafts/{author.story()['draft_id']}/search"
    for params, reason in (({"q": "а"}, "не меньше 2"), ({}, "Нет параметра q"), ({"q": "  "}, "Пустой запрос")):
        response = author.get(url, params=params)
        assert response.status_code == 422, params
        assert response.headers["content-type"] == PROBLEM
        assert response.headers["cache-control"] == "no-store"
        assert reason in response.json()["detail"]


def test_someone_elses_story(authors: Any) -> None:
    owner, stranger = authors(), authors()
    story = _story(owner)
    for draft_id in (story["draft_id"], str(uuid.uuid4()), "not-an-id"):
        response = stranger.get(f"/api/v1/drafts/{draft_id}/search", params={"q": "ключ"})
        assert response.status_code == 404, draft_id
        assert response.headers["content-type"] == PROBLEM
        assert "ключ" not in response.text

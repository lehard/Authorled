"""Route of the writing statistics (openspec/specs/api/writing)."""

from typing import Any

import pytest

from tests.routes import PROBLEM


def test_answer(authors: Any) -> None:
    author = authors()
    author.patch("/api/v1/me", json={"daily_word_goal": 500})
    story = author.story("Тихая вода")
    response = author.get(f"/api/v1/drafts/{story['draft_id']}/writing", params={"tz": "Europe/Moscow"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"today", "daily_goal", "days", "story"}
    assert body["daily_goal"] == 500
    assert len(body["days"]) == 30 and body["days"][-1]["date"] == body["today"]
    assert set(body["days"][0]) == {"date", "words", "met"}
    assert body["story"] == {"words": 0, "goal": None, "deadline": None, "days_left": None, "per_day": None}


def test_saved_words_show_today(authors: Any) -> None:
    author = authors()
    story = author.story()
    action = {"type": "action", "content": [{"type": "text", "text": "Вера идёт к воде"}]}
    heading = {"type": "sceneHeading", "attrs": {"uid": "s1"}}
    author.put(
        f"/api/v1/documents/{story['script_id']}/text",
        json={"type": "doc", "content": [heading, action]},
        headers={"If-Match": "1"},
    )
    body = author.get(f"/api/v1/drafts/{story['draft_id']}/writing", params={"tz": "Europe/Moscow"}).json()
    assert body["days"][-1] == {"date": body["today"], "words": 4, "met": None}
    assert body["story"]["words"] == 4


def test_someone_elses_draft(authors: Any) -> None:
    anna, boris = authors(), authors()
    story = anna.story()
    response = boris.get(f"/api/v1/drafts/{story['draft_id']}/writing", params={"tz": "Europe/Moscow"})
    assert response.status_code == 404 and response.headers["content-type"] == PROBLEM


@pytest.mark.parametrize("params", [{}, {"tz": "Mars/Base"}, {"tz": ""}])
def test_zone_is_required_and_known(authors: Any, params: dict[str, str]) -> None:
    author = authors()
    story = author.story()
    response = author.get(f"/api/v1/drafts/{story['draft_id']}/writing", params=params)
    assert response.status_code == 422 and response.headers["content-type"] == PROBLEM
    assert "tz" in response.json()["detail"]
    assert response.headers["Cache-Control"] == "no-store"

"""Routes of stories, documents, texts, drafts and trash (openspec/specs/api/stories)."""

from typing import Any

import pytest
from sqlalchemy import Engine, select

from core.tables import writing_progress
from tests.routes import PROBLEM

SCENE = {"type": "sceneHeading", "attrs": {"uid": "s1"}, "content": [{"type": "text", "text": "ИНТ. КУХНЯ — ДЕНЬ"}]}


def _doc(*blocks: dict[str, Any]) -> dict[str, Any]:
    return {"type": "doc", "content": list(blocks)}


def test_foreign_story_is_not_found(authors: Any) -> None:
    owner, stranger = authors(), authors()
    story = owner.story()
    response = stranger.get(f"/api/v1/drafts/{story['draft_id']}/documents")
    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM


def test_without_token(client: Any) -> None:
    assert client.get("/api/v1/projects").status_code == 401


def test_account_is_needed(authors: Any) -> None:
    response = authors(account=False).get("/api/v1/projects")
    assert response.status_code == 404
    assert "GET /api/v1/me" in response.json()["detail"]


def test_new_story_and_shelf(authors: Any) -> None:
    author = authors()
    lighthouse = author.story("Маяк")
    ferry = author.story("Паром")
    tree = author.get(f"/api/v1/drafts/{lighthouse['draft_id']}/documents").json()
    assert [(d["kind"], d["id"]) for d in tree] == [("script", lighthouse["script_id"])]
    assert author.post(f"/api/v1/projects/{ferry['project']['id']}/trash").status_code == 200
    assert [p["title"] for p in author.get("/api/v1/projects").json()] == ["Маяк"]
    assert [p["title"] for p in author.get("/api/v1/projects?trash=true").json()] == ["Паром"]


def test_empty_title(authors: Any) -> None:
    response = authors().post("/api/v1/projects", json={"title": "  "})
    assert response.status_code == 422


def test_unknown_field_is_named(authors: Any) -> None:
    author = authors()
    story = author.story()
    response = author.patch(f"/api/v1/projects/{story['project']['id']}", json={"color": "red"})
    assert response.status_code == 422
    assert "color" in response.json()["detail"]


def test_cover_colour_on_the_shelf(authors: Any) -> None:
    author = authors()
    created = author.post("/api/v1/projects", json={"title": "Маяк"}).json()["project"]
    assert created["cover_color"] == "blue"
    changed = author.patch(f"/api/v1/projects/{created['id']}", json={"cover_color": "amber"})
    assert changed.status_code == 200, changed.text
    assert (changed.json()["cover_color"], changed.json()["updated_at"]) == ("amber", created["updated_at"])
    assert [p["cover_color"] for p in author.get("/api/v1/projects").json()] == ["amber"]


def test_cover_colour_outside_the_palette(authors: Any) -> None:
    author = authors()
    story = author.story()
    response = author.patch(f"/api/v1/projects/{story['project']['id']}", json={"cover_color": "pink"})
    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM
    assert "cover_color" in response.json()["detail"]
    assert author.get("/api/v1/projects").json()[0]["cover_color"] == "blue"


def test_cover_colour_chosen_at_creation(authors: Any) -> None:
    author = authors()
    author.post("/api/v1/projects", json={"title": "Паром", "cover_color": "teal"})
    response = author.post("/api/v1/projects", json={"title": "Маяк", "cover_color": "plum"})
    assert response.status_code == 201, response.text
    assert response.json()["project"]["cover_color"] == "plum"


def test_cover_colour_outside_the_palette_at_creation(authors: Any) -> None:
    author = authors()
    for colour in ("pink", None):
        response = author.post("/api/v1/projects", json={"title": "Маяк", "cover_color": colour})
        assert response.status_code == 422
        assert response.headers["content-type"] == PROBLEM
        assert "cover_color" in response.json()["detail"]
    assert author.get("/api/v1/projects").json() == []


def test_next_cover_colour(authors: Any) -> None:
    author = authors()
    assert author.get("/api/v1/projects/next-cover-color").json() == {"cover_color": "blue"}
    story = author.post("/api/v1/projects", json={"title": "Паром", "cover_color": "teal"}).json()["project"]
    author.post(f"/api/v1/projects/{story['id']}/trash")
    response = author.get("/api/v1/projects/next-cover-color")
    assert response.status_code == 200, response.text
    assert response.json() == {"cover_color": "amber"}
    created = author.post("/api/v1/projects", json={"title": "Маяк"}).json()["project"]
    assert created["cover_color"] == "amber"


def test_story_without_a_goal(authors: Any) -> None:
    author = authors()
    author.story()
    (listed,) = author.get("/api/v1/projects").json()
    assert (listed["word_goal"], listed["goal_deadline"]) == (None, None)


def test_story_goal_with_a_deadline(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/projects/{story['project']['id']}"
    changed = author.patch(url, json={"word_goal": 20000, "goal_deadline": "2026-11-30"})
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert (body["word_goal"], body["goal_deadline"], body["title"]) == (20000, "2026-11-30", "Маяк")
    assert "drafts_count" not in body
    (listed,) = author.get("/api/v1/projects").json()
    assert (listed["word_goal"], listed["goal_deadline"]) == (20000, "2026-11-30")
    past = author.patch(url, json={"goal_deadline": "2020-01-01"})
    assert past.status_code == 200 and past.json()["goal_deadline"] == "2020-01-01"
    taken = author.patch(url, json={"word_goal": None, "goal_deadline": None}).json()
    assert (taken["word_goal"], taken["goal_deadline"]) == (None, None)


def test_deadline_without_a_goal(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/projects/{story['project']['id']}"
    refused = author.patch(url, json={"goal_deadline": "2026-11-30"})
    assert refused.status_code == 422 and refused.headers["content-type"] == PROBLEM
    assert "goal_deadline" in refused.json()["detail"]
    author.patch(url, json={"word_goal": 20000, "goal_deadline": "2026-11-30"})
    dropped = author.patch(url, json={"word_goal": None})
    assert dropped.status_code == 422 and "goal_deadline" in dropped.json()["detail"]
    (listed,) = author.get("/api/v1/projects").json()
    assert (listed["word_goal"], listed["goal_deadline"]) == (20000, "2026-11-30")


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"word_goal": 0}, "word_goal"),
        ({"word_goal": "500"}, "word_goal"),
        ({"word_goal": True}, "word_goal"),
        ({"word_goal": 2.5}, "word_goal"),
        ({"word_goal": 100, "goal_deadline": "30.11.2026"}, "goal_deadline"),
        ({"word_goal": 100, "goal_deadline": "2026-02-30"}, "goal_deadline"),
        ({"word_goal": 100, "goal_deadline": 20261130}, "goal_deadline"),
    ],
)
def test_bad_story_goal_is_named(authors: Any, body: dict[str, Any], field: str) -> None:
    author = authors()
    story = author.story()
    response = author.patch(f"/api/v1/projects/{story['project']['id']}", json=body)
    assert response.status_code == 422
    assert field in response.json()["detail"]


def test_body_must_be_json(authors: Any) -> None:
    response = authors().post("/api/v1/projects", content=b"title", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_delete_only_from_trash(authors: Any) -> None:
    author = authors()
    story = author.story()
    project_id, draft_id = story["project"]["id"], story["draft_id"]
    assert author.delete(f"/api/v1/projects/{project_id}").status_code == 409
    author.post(f"/api/v1/projects/{project_id}/trash")
    assert author.delete(f"/api/v1/projects/{project_id}").status_code == 204
    assert author.get(f"/api/v1/drafts/{draft_id}/documents").status_code == 404


def test_documents_with_revision(authors: Any) -> None:
    author = authors()
    story = author.story()
    draft_id = story["draft_id"]
    created = author.post(
        f"/api/v1/drafts/{draft_id}/documents",
        json={"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "вода", "habits": "курит"}},
    )
    assert created.status_code == 201
    vera = created.json()[0]
    url = f"/api/v1/documents/{vera['id']}"
    got = author.get(url)
    assert got.headers["ETag"] == f'"{vera["revision"]}"'
    assert author.patch(url, json={"name": "Вера Андреевна"}).status_code == 428
    first = author.patch(url, json={"fields": {"fear": "огонь"}}, headers={"If-Match": str(vera["revision"])})
    assert first.status_code == 200
    assert first.json()["fields"] == {"fear": "огонь", "habits": "курит"}
    second = author.patch(url, json={"fields": {"fear": "лёд"}}, headers={"If-Match": str(vera["revision"])})
    assert second.status_code == 409
    assert author.get(url).json()["fields"]["fear"] == "огонь"


def test_field_of_another_kind(authors: Any) -> None:
    author = authors()
    story = author.story()
    draft_id = story["draft_id"]
    response = author.post(
        f"/api/v1/drafts/{draft_id}/documents",
        json={"kind": "location", "name": "Пристань", "role": "main", "fields": {"age": "30"}},
    )
    assert response.status_code == 422
    assert "age" in response.json()["detail"]


def test_every_wrong_field_in_one_refusal(authors: Any) -> None:
    author = authors()
    draft_id = author.story()["draft_id"]
    response = author.post(
        f"/api/v1/drafts/{draft_id}/documents",
        json={
            "kind": "character",
            "name": "Василий",
            "role": "secondary",
            "fields": {"speech": {"value": "Бормочет"}, "age": 55, "appearance": "Худой"},
        },
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert all(name in detail for name in ("speech", "age", "appearance"))
    names = [d["name"] for d in author.get(f"/api/v1/drafts/{draft_id}/documents").json()]
    assert "Василий" not in names


def test_batch_all_or_nothing(authors: Any) -> None:
    author = authors()
    story = author.story()
    draft_id = story["draft_id"]
    response = author.post(
        f"/api/v1/drafts/{draft_id}/documents",
        json=[
            {"kind": "character", "name": "Нина", "role": "episodic"},
            {"kind": "character", "name": "", "role": "episodic"},
        ],
    )
    assert response.status_code == 422
    assert len(author.get(f"/api/v1/drafts/{draft_id}/documents").json()) == 1


def test_trash_of_the_story(authors: Any) -> None:
    author = authors()
    story = author.story()
    draft_id = story["draft_id"]
    assert author.post(f"/api/v1/documents/{story['script_id']}/trash").status_code == 409
    (misha,) = author.post(
        f"/api/v1/drafts/{draft_id}/documents", json={"kind": "character", "name": "Миша", "role": "episodic"}
    ).json()
    author.post(f"/api/v1/documents/{misha['id']}/trash")
    tree = author.get(f"/api/v1/drafts/{draft_id}/documents").json()
    assert [d["deleted_at"] is not None for d in tree if d["name"] == "Миша"] == [True]
    assert author.post(f"/api/v1/drafts/{draft_id}/trash/empty").status_code == 204
    assert author.get(f"/api/v1/documents/{misha['id']}").status_code == 404


def test_story_in_trash_refuses_changes(authors: Any) -> None:
    author = authors()
    story = author.story()
    (vera,) = author.post(
        f"/api/v1/drafts/{story['draft_id']}/documents",
        json={"kind": "character", "name": "Вера", "role": "main"},
    ).json()
    author.post(f"/api/v1/projects/{story['project']['id']}/trash")
    response = author.patch(f"/api/v1/documents/{vera['id']}", json={"name": "Вера А."}, headers={"If-Match": "1"})
    assert response.status_code == 409


def test_text_with_revision(authors: Any) -> None:
    author = authors()
    url = f"/api/v1/documents/{author.story()['script_id']}/text"
    text = author.get(url)
    revision = text.json()["revision"]
    assert text.headers["ETag"] == f'"{revision}"'
    saved = author.put(url, json=_doc(SCENE), headers={"If-Match": str(revision)})
    assert saved.status_code == 200 and saved.json()["revision"] == revision + 1
    stale = author.put(url, json=_doc(SCENE), headers={"If-Match": str(revision)})
    assert stale.status_code == 409
    assert author.put(url, json=_doc(SCENE)).status_code == 428


def test_text_checks(authors: Any) -> None:
    author = authors()
    url = f"/api/v1/documents/{author.story()['script_id']}/text"
    no_uid = author.put(url, json=_doc({"type": "sceneHeading"}), headers={"If-Match": "1"})
    assert no_uid.status_code == 422 and "uid" in no_uid.json()["detail"]
    unknown = author.put(url, json=_doc(SCENE, {"type": "chorus"}), headers={"If-Match": "1"})
    assert unknown.status_code == 422 and "chorus" in unknown.json()["detail"]


def test_character_has_no_text(authors: Any) -> None:
    author = authors()
    story = author.story()
    draft_id = story["draft_id"]
    (vera,) = author.post(
        f"/api/v1/drafts/{draft_id}/documents", json={"kind": "character", "name": "Вера", "role": "main"}
    ).json()
    assert author.get(f"/api/v1/documents/{vera['id']}/text").status_code == 404


def test_drafts(authors: Any) -> None:
    author = authors()
    story = author.story()
    project_id, draft_id = story["project"]["id"], story["draft_id"]
    marked = _doc(
        SCENE,
        {
            "type": "action",
            "content": [{"type": "text", "text": "Вера", "marks": [{"type": "comment", "attrs": {"id": "c1"}}]}],
        },
    )
    author.put(f"/api/v1/documents/{story['script_id']}/text", json=marked, headers={"If-Match": "1"})
    created = author.post(f"/api/v1/projects/{project_id}/drafts", json={"name": "Первый", "base_id": draft_id})
    assert created.status_code == 201
    draft = created.json()
    assert (draft["locked"], draft["forked_from_id"], draft["forked_from_name"]) == (False, draft_id, "Драфт 1")
    script = next(d for d in author.get(f"/api/v1/drafts/{draft['id']}/documents").json() if d["kind"] == "script")
    text = author.get(f"/api/v1/documents/{script['id']}/text").json()
    assert "marks" not in text["content"]["content"][1]["content"][0]
    author.patch(f"/api/v1/drafts/{draft['id']}", json={"locked": True})
    locked = author.put(f"/api/v1/documents/{script['id']}/text", json=marked, headers={"If-Match": "1"})
    assert locked.status_code == 409
    empty = author.post(f"/api/v1/projects/{project_id}/drafts", json={"name": " ", "base_id": draft_id})
    assert empty.status_code == 422


def test_saved_text_records_the_words(authors: Any, engine: Engine) -> None:
    """The author's save adds the difference in words (openspec/specs/api/stories, «Текст сценария»)."""
    author = authors()
    story = author.story()
    url = f"/api/v1/documents/{story['script_id']}/text"
    action = {"type": "action", "content": [{"type": "text", "text": "Вера идёт к воде"}]}
    saved = author.put(url, json=_doc(SCENE, action), headers={"If-Match": "1"})
    assert saved.status_code == 200 and set(saved.json()) == {"document_id", "content", "revision"}
    assert author.put(url, json=_doc(SCENE), headers={"If-Match": "1"}).status_code == 409
    with engine.connect() as connection:
        words = connection.execute(
            select(writing_progress.c.words).where(writing_progress.c.project_id == story["project"]["id"])
        ).scalar_one()
    assert words == 7  # «ИНТ. КУХНЯ — ДЕНЬ» and «Вера идёт к воде»; the new story starts with an empty heading


def _text(author: Any, story: dict[str, Any]) -> dict[str, Any]:
    response = author.get(f"/api/v1/documents/{story['script_id']}/text")
    assert response.status_code == 200, response.text
    content: dict[str, Any] = response.json()["content"]
    return content


def _block_text(block: dict[str, Any]) -> str:
    return "".join(node["text"] for node in block.get("content", []))


def test_story_templates(authors: Any) -> None:
    response = authors().get("/api/v1/story-templates")
    assert response.status_code == 200, response.text
    found = {t["id"]: t for t in response.json()}
    assert list(found) == ["three-acts", "hero-journey", "fifteen-points", "tv-episode"]
    three = found["three-acts"]
    assert three["name"] == "Три акта" and three["description"]
    first = three["acts"][0]
    assert first["name"] and set(first["points"][0]) == {"name", "hint"}


def test_story_templates_without_token(client: Any) -> None:
    assert client.get("/api/v1/story-templates").status_code == 401


def test_story_from_a_template(authors: Any) -> None:
    author = authors()
    three = next(t for t in author.get("/api/v1/story-templates").json() if t["id"] == "three-acts")
    response = author.post("/api/v1/projects", json={"title": "Маяк", "template": "three-acts"})
    assert response.status_code == 201, response.text
    blocks = _text(author, response.json())["content"]
    act, point = three["acts"][0], three["acts"][0]["points"][0]
    assert [b["type"] for b in blocks[:4]] == ["act", "sequence", "sceneHeading", "beat"]
    assert [_block_text(b) for b in blocks[:4]] == [act["name"], point["name"], "", point["hint"]]
    headings = [b for b in blocks if b["type"] == "sceneHeading"]
    assert len(headings) == sum(len(a["points"]) for a in three["acts"])
    assert len({b["attrs"]["uid"] for b in headings}) == len(headings)


def test_story_without_a_template(authors: Any) -> None:
    author = authors()
    blocks = _text(author, author.story())["content"]
    assert [(b["type"], _block_text(b)) for b in blocks] == [("sceneHeading", "")]


@pytest.mark.parametrize("value", ["save-the-dog", None, 7])
def test_unknown_template(authors: Any, value: Any) -> None:
    author = authors()
    response = author.post("/api/v1/projects", json={"title": "Маяк", "template": value})
    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM
    assert str(value) in response.json()["detail"]
    assert author.get("/api/v1/projects").json() == []


def test_template_with_a_manuscript(authors: Any) -> None:
    author = authors()
    response = author.post(
        "/api/v1/projects",
        data={"title": "Маяк", "template": "three-acts"},
        files={"file": ("маяк.fountain", "INT. КУХНЯ - ДЕНЬ\n".encode())},
    )
    assert response.status_code == 422
    assert "template" in response.json()["detail"]
    assert author.get("/api/v1/projects").json() == []

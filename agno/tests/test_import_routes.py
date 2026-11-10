"""Routes of manuscript import (openspec/specs/api/story-import)."""

from pathlib import Path
from typing import Any

from tests.starc_sample import SAMPLE as STARC
from tests.starc_sample import novel, with_text

SAMPLES = Path(__file__).parent / "fixtures" / "import"
BROKEN_FDX = b'<?xml version="1.0"?><FinalDraft><Content><Paragraph'


def test_story_from_fountain(authors: Any) -> None:
    author = authors()
    response = author.post(
        "/api/v1/projects",
        data={"title": "Паром"},
        files={"file": ("all-types.fountain", (SAMPLES / "all-types.fountain").read_bytes())},
    )
    assert response.status_code == 201, response.text
    created = response.json()
    text = author.get(f"/api/v1/documents/{created['script_id']}/text").json()["content"]
    uids = [b["attrs"]["uid"] for b in text["content"] if b["type"] == "sceneHeading"]
    assert len(uids) == 2 and len(set(uids)) == 2
    tree = author.get(f"/api/v1/drafts/{created['draft_id']}/documents").json()
    assert sorted(d["name"] for d in tree if d["kind"] == "character") == ["Вера", "Миша"]


def test_story_from_starc(authors: Any) -> None:
    author = authors()
    response = author.post(
        "/api/v1/projects", data={"title": "Тихая вода"}, files={"file": ("проект.starc", STARC.read_bytes())}
    )
    assert response.status_code == 201, response.text
    created = response.json()
    text = author.get(f"/api/v1/documents/{created['script_id']}/text").json()["content"]
    assert text["content"][0]["type"] == "sceneHeading"
    tree = author.get(f"/api/v1/drafts/{created['draft_id']}/documents").json()
    assert [d["name"] for d in tree if d["kind"] == "character"] == ["Вера", "Миша", "Олег", "Почтальон"]
    assert [d["name"] for d in tree if d["kind"] == "location"] == ["Кухня", "Озеро", "Маяк"]


def test_story_from_starc_keeps_scene_parameters(authors: Any) -> None:
    author = authors()
    scene = (
        '<scene uuid="{1}"><title>Завтрак</title><story_day>День 1</story_day><color>#2060e0</color>'
        "<tags><tag>дом</tag></tags><content><scene_heading><v>ИНТ. ДОМ - ДЕНЬ</v></scene_heading></content></scene>"
    )
    response = author.post(
        "/api/v1/projects", data={"title": "Тихая вода"}, files={"file": ("проект.starc", with_text(scene))}
    )
    assert response.status_code == 201, response.text
    text = author.get(f"/api/v1/documents/{response.json()['script_id']}/text").json()["content"]
    attrs = text["content"][0]["attrs"]
    assert (attrs["alt"], attrs["day"], attrs["color"], attrs["tags"]) == ("Завтрак", "День 1", "4", ["дом"])


def test_novel_creates_no_story(authors: Any) -> None:
    author = authors()
    response = author.post("/api/v1/projects", data={"title": "Роман"}, files={"file": ("роман.starc", novel())})
    assert response.status_code == 422
    assert "нет сценария" in response.json()["detail"]
    assert author.get("/api/v1/projects").json() == []


def test_broken_file_creates_no_story(authors: Any) -> None:
    author = authors()
    response = author.post("/api/v1/projects", data={"title": "Паром"}, files={"file": ("broken.fdx", BROKEN_FDX)})
    assert response.status_code == 422
    assert author.get("/api/v1/projects").json() == []


def test_story_from_file_needs_a_title(authors: Any) -> None:
    author = authors()
    response = author.post("/api/v1/projects", files={"file": ("m.txt", (SAMPLES / "manuscript.txt").read_bytes())})
    assert response.status_code == 422
    assert author.get("/api/v1/projects").json() == []


def test_import_into_a_story(authors: Any) -> None:
    author = authors()
    story = author.story()
    project_id, draft_id = story["project"]["id"], story["draft_id"]
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("manuscript.txt", (SAMPLES / "manuscript.txt").read_bytes())},
        data={"purpose": "import"},
    ).json()
    url = f"/api/v1/drafts/{draft_id}/import"
    assert author.post(url, json={"file_id": uploaded["id"]}).status_code == 428
    imported = author.post(url, json={"file_id": uploaded["id"]}, headers={"If-Match": "1"})
    assert imported.status_code == 200 and imported.json()["revision"] == 2
    again = author.post(url, json={"file_id": uploaded["id"]}, headers={"If-Match": "1"})
    assert again.status_code == 409


def test_chat_file_is_not_imported(authors: Any) -> None:
    author = authors()
    story = author.story()
    project_id, draft_id = story["project"]["id"], story["draft_id"]
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("notes.txt", b"text")},
        data={"purpose": "chat", "session_id": f"{project_id}:1"},
    ).json()
    response = author.post(
        f"/api/v1/drafts/{draft_id}/import", json={"file_id": uploaded["id"]}, headers={"If-Match": "1"}
    )
    assert response.status_code == 422
    assert (
        author.get(
            f"/api/v1/documents/{author.get(f'/api/v1/drafts/{draft_id}/documents').json()[0]['id']}/text"
        ).json()["revision"]
        == 1
    )


def test_story_from_a_file_takes_the_next_colour(authors: Any) -> None:
    author = authors()
    first = author.post("/api/v1/projects", json={"title": "Маяк"}).json()["project"]
    response = author.post(
        "/api/v1/projects",
        data={"title": "Паром"},
        files={"file": ("all-types.fountain", (SAMPLES / "all-types.fountain").read_bytes())},
    )
    assert response.status_code == 201, response.text
    assert (first["cover_color"], response.json()["project"]["cover_color"]) == ("blue", "teal")


def test_story_from_a_file_takes_the_chosen_colour(authors: Any) -> None:
    author = authors()
    response = author.post(
        "/api/v1/projects",
        data={"title": "Паром", "cover_color": "crimson"},
        files={"file": ("all-types.fountain", (SAMPLES / "all-types.fountain").read_bytes())},
    )
    assert response.status_code == 201, response.text
    assert response.json()["project"]["cover_color"] == "crimson"


def test_story_from_a_file_with_a_colour_outside_the_palette(authors: Any) -> None:
    author = authors()
    response = author.post(
        "/api/v1/projects",
        data={"title": "Паром", "cover_color": "pink"},
        files={"file": ("all-types.fountain", (SAMPLES / "all-types.fountain").read_bytes())},
    )
    assert response.status_code == 422
    assert "cover_color" in response.json()["detail"]
    assert author.get("/api/v1/projects").json() == []

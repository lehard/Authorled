"""Routes of manuscript import (openspec/specs/api/story-import)."""

from pathlib import Path
from typing import Any

from tests.starc_sample import SAMPLE as STARC
from tests.starc_sample import novel

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
    tree = author.get(f"/api/v1/projects/{created['project']['id']}/documents").json()
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
    tree = author.get(f"/api/v1/projects/{created['project']['id']}/documents").json()
    assert [d["name"] for d in tree if d["kind"] == "character"] == ["Вера", "Миша", "Олег", "Почтальон"]
    assert [d["name"] for d in tree if d["kind"] == "location"] == ["Кухня", "Озеро", "Маяк"]


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
    project_id = story["project"]["id"]
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("manuscript.txt", (SAMPLES / "manuscript.txt").read_bytes())},
        data={"purpose": "import"},
    ).json()
    url = f"/api/v1/projects/{project_id}/import"
    assert author.post(url, json={"file_id": uploaded["id"]}).status_code == 428
    imported = author.post(url, json={"file_id": uploaded["id"]}, headers={"If-Match": "1"})
    assert imported.status_code == 200 and imported.json()["revision"] == 2
    again = author.post(url, json={"file_id": uploaded["id"]}, headers={"If-Match": "1"})
    assert again.status_code == 409


def test_chat_file_is_not_imported(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("notes.txt", b"text")},
        data={"purpose": "chat", "session_id": f"{project_id}:1"},
    ).json()
    response = author.post(
        f"/api/v1/projects/{project_id}/import", json={"file_id": uploaded["id"]}, headers={"If-Match": "1"}
    )
    assert response.status_code == 422
    assert (
        author.get(
            f"/api/v1/documents/{author.get(f'/api/v1/projects/{project_id}/documents').json()[0]['id']}/text"
        ).json()["revision"]
        == 1
    )

"""Routes of notes (openspec/specs/api/stories: «Заметки истории» … «Заметки и драфты»)."""

from typing import Any

from tests.routes import PROBLEM


def _note(author: Any, story: dict[str, Any], title: str = "Финал") -> dict[str, Any]:
    created = author.post(f"/api/v1/projects/{story['project']['id']}/notes", json={"title": title})
    assert created.status_code == 201, created.text
    note: dict[str, Any] = created.json()
    return note


def test_create_and_list(authors: Any) -> None:
    author = authors()
    story = author.story()
    note = _note(author, story)
    assert (note["title"], note["body"], note["revision"], note["deleted_at"]) == ("Финал", "", 1, None)
    assert note["research"] is None
    assert author.get(f"/api/v1/projects/{story['project']['id']}/notes").json() == [note]


def test_create_checks(authors: Any) -> None:
    author = authors()
    url = f"/api/v1/projects/{author.story()['project']['id']}/notes"

    empty = author.post(url, json={"title": "   "})
    assert empty.status_code == 422
    assert empty.headers["content-type"] == PROBLEM
    assert "Название" in empty.json()["detail"]
    assert author.post(url, json={"title": "Финал", "body": 7}).status_code == 422
    unknown = author.post(url, json={"title": "Финал", "color": "red"})
    assert unknown.status_code == 422
    assert "color" in unknown.json()["detail"]
    assert author.post(url, json=["Финал"]).status_code == 422


def test_author_does_not_set_research(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/projects/{story['project']['id']}/notes"
    brief = {"screenplay": True, "note_ids": []}
    assert author.post(url, json={"title": "Исследование: паром", "research": brief}).status_code == 422
    note = _note(author, story)
    changed = author.patch(f"/api/v1/notes/{note['id']}", json={"research": brief}, headers={"If-Match": "1"})
    assert changed.status_code == 422
    assert author.get(url).json() == [note]


def test_edit_with_if_match(authors: Any) -> None:
    author = authors()
    note = _note(author, author.story())
    url = f"/api/v1/notes/{note['id']}"

    assert author.patch(url, json={"body": "Лодка"}).status_code == 428
    changed = author.patch(url, json={"body": "Лодка"}, headers={"If-Match": "1"})
    assert changed.status_code == 200
    assert changed.json()["revision"] == 2
    assert changed.headers["ETag"] == '"2"'

    old = author.patch(url, json={"body": "Старая правка"}, headers={"If-Match": "1"})
    assert old.status_code == 409
    assert author.patch(url, json={"color": "red"}, headers={"If-Match": "2"}).status_code == 422
    assert author.patch(url, json={}, headers={"If-Match": "2"}).status_code == 422
    assert author.patch(url, json={"title": ""}, headers={"If-Match": "2"}).status_code == 422


def test_trash_restore_delete(authors: Any) -> None:
    author = authors()
    story = author.story()
    note = _note(author, story)
    url = f"/api/v1/notes/{note['id']}"

    assert author.delete(url).status_code == 409
    assert author.post(f"{url}/restore").status_code == 409
    trashed = author.post(f"{url}/trash")
    assert trashed.status_code == 200
    assert trashed.json()["deleted_at"] is not None
    assert author.post(f"{url}/trash").status_code == 409
    assert author.patch(url, json={"body": "Лодка"}, headers={"If-Match": "1"}).status_code == 409
    assert author.post(f"{url}/restore").json()["deleted_at"] is None

    author.post(f"{url}/trash")
    assert author.delete(url).status_code == 204
    assert author.get(f"/api/v1/projects/{story['project']['id']}/notes").json() == []


def test_foreign_notes_are_not_found(authors: Any) -> None:
    owner, stranger = authors(), authors()
    story = owner.story()
    note = _note(owner, story)
    notes = f"/api/v1/projects/{story['project']['id']}/notes"
    url = f"/api/v1/notes/{note['id']}"

    answers = [
        stranger.get(notes),
        stranger.post(notes, json={"title": "Чужая"}),
        stranger.patch(url, json={"body": "Чужое"}, headers={"If-Match": "1"}),
        stranger.post(f"{url}/trash"),
        stranger.post(f"{url}/restore"),
        stranger.delete(url),
    ]

    assert [answer.status_code for answer in answers] == [404] * 6
    assert {answer.headers["content-type"] for answer in answers} == {PROBLEM}
    assert owner.get(notes).json() == [note]


def test_unknown_note_is_not_found(authors: Any) -> None:
    author = authors()
    assert author.post("/api/v1/notes/nobody/trash").status_code == 404
    assert author.delete("/api/v1/notes/4b8f9d62-3f7a-4c58-9b0e-2f1f2f7f7f7f").status_code == 404


def test_trash_empty_takes_notes_along(authors: Any) -> None:
    author = authors()
    story = author.story()
    kept, gone = _note(author, story), _note(author, story, "Вера")
    author.post(f"/api/v1/notes/{gone['id']}/trash")

    assert author.post(f"/api/v1/drafts/{story['draft_id']}/trash/empty").status_code == 204

    assert author.get(f"/api/v1/projects/{story['project']['id']}/notes").json() == [kept]


def test_story_in_trash_refuses_a_new_note(authors: Any) -> None:
    author = authors()
    story = author.story()
    author.post(f"/api/v1/projects/{story['project']['id']}/trash")
    created = author.post(f"/api/v1/projects/{story['project']['id']}/notes", json={"title": "Финал"})
    assert created.status_code == 409


def test_locked_draft_does_not_close_notes(authors: Any) -> None:
    author = authors()
    story = author.story()
    note = _note(author, story)
    locked = author.patch(f"/api/v1/drafts/{story['draft_id']}", json={"locked": True})
    assert locked.status_code == 200
    changed = author.patch(f"/api/v1/notes/{note['id']}", json={"body": "Лодка"}, headers={"If-Match": "1"})
    assert changed.status_code == 200

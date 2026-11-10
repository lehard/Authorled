"""Routes of notes from files (openspec/specs/api/stories: «Заметка из файла» … «Место для оригиналов заметок»).

The antivirus is the clamav service of ./scripts/dev.sh test.
"""

import io
from typing import Any

import pytest

from tests.routes import PROBLEM
from tests.test_clamav import EICAR
from tests.test_file_routes import _docx, _upload


def _to_notes(author: Any, project_id: str, name: str, data: bytes) -> Any:
    return author.post(f"/api/v1/projects/{project_id}/notes/files", files={"file": (name, data)})


def test_docx_becomes_a_note(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    data = _docx("Москва, 1913", "Трамваи и извозчики")

    response = _to_notes(author, project_id, "Эпоха.docx", data)

    assert response.status_code == 201, response.text
    note = response.json()
    assert (note["title"], note["revision"]) == ("Эпоха", 1)
    assert "Москва, 1913" in note["body"]
    assert (note["file"]["name"], note["file"]["size_bytes"]) == ("Эпоха.docx", len(data))
    assert author.get(f"/api/v1/projects/{project_id}/notes").json() == [note]
    assert author.get(f"/api/v1/files/{note['file']['id']}/content").content == data


def test_text_changes_and_the_original_stays(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    note = _to_notes(author, project_id, "Эпоха.txt", "Москва".encode()).json()

    changed = author.patch(f"/api/v1/notes/{note['id']}", json={"body": "Петербург"}, headers={"If-Match": "1"})

    assert changed.status_code == 200
    assert changed.json()["file"] == note["file"]
    assert author.get(f"/api/v1/files/{note['file']['id']}/content").content == "Москва".encode()


def _blank_pdf() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.mark.parametrize(
    ("name", "data", "reason"),
    [
        ("сканы.pdf", _blank_pdf(), "нет текста"),
        ("обложка.png", b"\x89PNG\r\n\x1a\n", "не поддерживается"),
        ("virus.txt", EICAR, "антивирусную"),
        ("длинный.txt", ("а" * 500_001).encode(), "500 000 знаков"),
    ],
)
def test_refused_files_leave_no_note(authors: Any, name: str, data: bytes, reason: str) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]

    response = _to_notes(author, project_id, name, data)

    assert response.status_code == 422
    assert response.headers["content-type"] == PROBLEM
    assert reason in response.json()["detail"]
    assert author.get(f"/api/v1/projects/{project_id}/notes").json() == []


def test_place_ends(authors: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    # Texts stay under the limit of 500 000 characters, so only the place refuses.
    monkeypatch.setattr("app.api.notes.billing.storage_limit", lambda user_id, at: 300 * 1024)
    assert _to_notes(author, project_id, "a.txt", b"a" * 200 * 1024).status_code == 201

    response = _to_notes(author, project_id, "b.txt", b"b" * 200 * 1024)

    assert response.status_code == 413
    assert "занято 0,2 МБ из 0,3 МБ" in response.json()["detail"]
    chat = _upload(author, project_id, "c.txt", b"c" * 200 * 1024)
    assert chat.status_code == 201
    assert author.post(f"/api/v1/files/{chat.json()['id']}/note").status_code == 413


def test_story_in_the_trash(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    assert author.post(f"/api/v1/projects/{project_id}/trash").status_code == 200

    assert _to_notes(author, project_id, "a.txt", b"text").status_code == 409


def test_chat_file_becomes_a_note(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    chat = _upload(author, project_id, "Эпоха.txt", "Москва".encode()).json()

    response = author.post(f"/api/v1/files/{chat['id']}/note")

    assert response.status_code == 201, response.text
    note = response.json()
    assert (note["title"], note["body"], note["file"]["name"]) == ("Эпоха", "Москва", "Эпоха.txt")
    assert note["file"]["id"] != chat["id"]
    assert author.get(f"/api/v1/files/{chat['id']}").json()["purpose"] == "chat"


def test_only_chat_files_go_to_notes(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    imported = _upload(author, project_id, "manuscript.txt", b"text", "import").json()
    note = _to_notes(author, project_id, "a.txt", b"text").json()

    assert author.post(f"/api/v1/files/{imported['id']}/note").status_code == 422
    assert author.post(f"/api/v1/files/{note['file']['id']}/note").status_code == 422


def test_original_goes_only_with_its_note(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    note = _to_notes(author, project_id, "a.txt", b"text").json()
    original = f"/api/v1/files/{note['file']['id']}"

    refused = author.delete(original)
    assert refused.status_code == 409
    assert "вместе с заметкой" in refused.json()["detail"]

    assert author.post(f"/api/v1/notes/{note['id']}/trash").status_code == 200
    assert author.get(f"{original}/content").content == b"text"
    assert author.delete(f"/api/v1/notes/{note['id']}").status_code == 204
    assert author.get(original).status_code == 404


def test_foreign_story_and_file(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id = owner.story()["project"]["id"]
    chat = _upload(owner, project_id, "a.txt", b"text").json()

    assert _to_notes(stranger, project_id, "a.txt", b"text").status_code == 404
    assert stranger.post(f"/api/v1/files/{chat['id']}/note").status_code == 404
    assert owner.get(f"/api/v1/projects/{project_id}/notes").json() == []


def test_removing_the_original_keeps_the_text(authors: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    monkeypatch.setattr("app.api.notes.billing.storage_limit", lambda user_id, at: 300 * 1024)
    note = _to_notes(author, project_id, "Эпоха.txt", b"a" * 200 * 1024).json()
    assert _to_notes(author, project_id, "b.txt", b"b" * 200 * 1024).status_code == 413

    response = author.delete(f"/api/v1/notes/{note['id']}/file", headers={"If-Match": "1"})

    assert response.status_code == 200, response.text
    changed = response.json()
    assert (changed["title"], changed["body"], changed["revision"], changed["file"]) == (
        "Эпоха",
        note["body"],
        2,
        None,
    )
    assert response.headers["ETag"] == '"2"'
    assert author.get(f"/api/v1/files/{note['file']['id']}").status_code == 404
    assert _to_notes(author, project_id, "b.txt", b"b" * 200 * 1024).status_code == 201


def test_removing_the_original_is_refused(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    plain = author.post(f"/api/v1/projects/{project_id}/notes", json={"title": "Финал"}).json()
    note = _to_notes(author, project_id, "a.txt", b"text").json()
    path = f"/api/v1/notes/{note['id']}/file"

    assert author.delete(f"/api/v1/notes/{plain['id']}/file", headers={"If-Match": "1"}).status_code == 409
    assert author.delete(path).status_code == 428
    assert author.delete(path, headers={"If-Match": "2"}).status_code == 409
    assert author.post(f"/api/v1/notes/{note['id']}/trash").status_code == 200
    refused = author.delete(path, headers={"If-Match": "1"})
    assert refused.status_code == 409
    assert refused.headers["content-type"] == PROBLEM
    assert author.get(f"/api/v1/files/{note['file']['id']}").status_code == 200


def test_text_comes_back_from_the_original(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    note = _to_notes(author, project_id, "Эпоха.txt", "Москва, 1913".encode()).json()
    author.patch(f"/api/v1/notes/{note['id']}", json={"body": "черновик"}, headers={"If-Match": "1"})
    path = f"/api/v1/notes/{note['id']}/text-from-file"

    assert author.post(path).status_code == 428
    assert author.post(path, headers={"If-Match": "1"}).status_code == 409
    response = author.post(path, headers={"If-Match": "2"})

    assert response.status_code == 200, response.text
    assert (response.json()["body"], response.json()["revision"]) == ("Москва, 1913", 3)
    assert response.headers["ETag"] == '"3"'
    assert author.get(f"/api/v1/files/{note['file']['id']}/content").content == "Москва, 1913".encode()


def test_text_from_the_original_is_refused(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    plain = author.post(f"/api/v1/projects/{project_id}/notes", json={"title": "Финал"}).json()

    response = author.post(f"/api/v1/notes/{plain['id']}/text-from-file", headers={"If-Match": "1"})

    assert response.status_code == 409
    assert "нет оригинала" in response.json()["detail"]


def test_too_long_text_from_the_original(authors: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    note = _to_notes(author, project_id, "a.txt", b"text").json()
    monkeypatch.setattr("core.notes.MAX_FILE_TEXT_CHARS", 3)

    response = author.post(f"/api/v1/notes/{note['id']}/text-from-file", headers={"If-Match": "1"})

    assert response.status_code == 422
    assert author.get(f"/api/v1/projects/{project_id}/notes").json()[0]["body"] == "text"


def test_foreign_note_original(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id = owner.story()["project"]["id"]
    note = _to_notes(owner, project_id, "a.txt", b"text").json()

    assert stranger.delete(f"/api/v1/notes/{note['id']}/file", headers={"If-Match": "1"}).status_code == 404
    assert stranger.post(f"/api/v1/notes/{note['id']}/text-from-file", headers={"If-Match": "1"}).status_code == 404
    assert owner.get(f"/api/v1/files/{note['file']['id']}").status_code == 200

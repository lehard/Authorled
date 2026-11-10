"""Routes of files (openspec/specs/api/files); the antivirus is the clamav service of the stand."""

import io
from pathlib import Path
from typing import Any

import pytest
from docx import Document as DocxDocument

from tests.starc_sample import SAMPLE as STARC
from tests.test_clamav import EICAR

IMPORT = Path(__file__).parent / "fixtures" / "import"


def _docx(*paragraphs: str) -> bytes:
    document = DocxDocument()
    for text in paragraphs:
        document.add_paragraph(text)
    out = io.BytesIO()
    document.save(out)
    return out.getvalue()


def _upload(
    author: Any, project_id: str, name: str, data: bytes, purpose: str = "chat", session: str | None = None
) -> Any:
    fields = {"purpose": purpose}
    if purpose == "chat":
        fields["session_id"] = session if session is not None else f"{project_id}:1"
    return author.post(f"/api/v1/projects/{project_id}/files", files={"file": (name, data)}, data=fields)


def test_docx_in_chat(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    data = _docx("Заметки к сцене", "Вера боится воды")
    response = _upload(author, project_id, "заметки.docx", data)
    assert response.status_code == 201, response.text
    stored = response.json()
    assert (stored["name"], stored["size_bytes"], stored["purpose"]) == ("заметки.docx", len(data), "chat")
    content = author.get(f"/api/v1/files/{stored['id']}/content")
    assert content.content == data
    assert "attachment" in content.headers["Content-Disposition"]
    assert author.delete(f"/api/v1/files/{stored['id']}").status_code == 204
    assert author.get(f"/api/v1/files/{stored['id']}").status_code == 404


def test_session_of_another_story(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    assert _upload(author, project_id, "a.txt", b"text", session="other:1").status_code == 422


def test_too_large(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    assert _upload(author, project_id, "big.txt", b"a" * (25 * 1024 * 1024)).status_code == 413


@pytest.mark.parametrize(
    ("name", "data", "purpose"),
    [
        ("обложка.png", b"\x89PNG\r\n\x1a\n", "chat"),
        ("сценарий.pdf", b"%PDF-1.4", "import"),
        ("fake.docx", b"not a zip", "chat"),
        ("empty.txt", b"", "chat"),
        ("cp1251.txt", "Вера".encode("cp1251"), "chat"),
        ("проект.starc", b"just some text", "chat"),
        ("проект.starc", b"just some text", "import"),
    ],
)
def test_refused_files(authors: Any, name: str, data: bytes, purpose: str) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    assert _upload(author, project_id, name, data, purpose).status_code == 422


def test_pdf_without_text(authors: Any) -> None:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    out = io.BytesIO()
    writer.write(out)
    author = authors()
    project_id = author.story()["project"]["id"]
    response = _upload(author, project_id, "сканы.pdf", out.getvalue())
    assert response.status_code == 422
    assert "нет текста" in response.json()["detail"]


def test_eicar_is_not_stored(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    response = _upload(author, project_id, "virus.txt", EICAR)
    assert response.status_code == 422
    assert "антивирусную" in response.json()["detail"]


def test_scanner_down(authors: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    monkeypatch.setenv("CLAMAV_PORT", "1")
    assert _upload(author, project_id, "a.txt", b"text").status_code == 503


def test_import_formats_are_accepted(authors: Any) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    for name in ("all-types.fountain", "all-types.fdx", "manuscript.txt"):
        response = _upload(author, project_id, name, (IMPORT / name).read_bytes(), "import")
        assert response.status_code == 201, (name, response.text)


@pytest.mark.parametrize("purpose", ["chat", "import"])
def test_starc_is_accepted(authors: Any, purpose: str) -> None:
    author = authors()
    project_id = author.story()["project"]["id"]
    response = _upload(author, project_id, "проект.starc", STARC.read_bytes(), purpose)
    assert response.status_code == 201, response.text
    assert response.json()["media_type"] == "application/x-starc"


def test_foreign_file(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id = owner.story()["project"]["id"]
    file_id = _upload(owner, project_id, "a.txt", b"text").json()["id"]
    assert stranger.get(f"/api/v1/files/{file_id}").status_code == 404

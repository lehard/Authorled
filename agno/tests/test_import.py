"""Import of manuscripts (openspec/specs/api/story-import) on samples exported by the editor."""

import io
import json
from pathlib import Path

import pytest
from docx import Document as DocxDocument
from sqlalchemy import Connection

from core.documents import create_documents, list_documents
from core.errors import Conflict, Invalid
from core.files import upload_file
from core.importers.fdx import parse_fdx
from core.importers.fountain import parse_fountain
from core.importers.screenplay import cast_from_text, places_from_text
from core.imports import import_into, parse_manuscript
from core.projects import create_project
from core.texts import ELEMENT_NAMES, get_text
from core.users import get_or_create_user

SAMPLES = Path(__file__).parent / "fixtures" / "import"


def _types(doc: dict) -> list[str]:  # type: ignore[type-arg]
    return [block["type"] for block in doc["content"]]


def test_fountain_matches_the_editor_importer() -> None:
    expected = json.loads((SAMPLES / "fountain-expected.json").read_text())["files"]
    for name, paragraphs in expected.items():
        got = [
            {"type": p.kind, "text": "".join(r.text for r in p.runs)}
            for p in parse_fountain((SAMPLES / name).read_text())
        ]
        assert got == paragraphs, name


def test_round_trip_through_our_fountain() -> None:
    doc = parse_manuscript(".fountain", (SAMPLES / "all-types.fountain").read_bytes())
    assert set(ELEMENT_NAMES) <= set(_types(doc))


def test_fdx_keeps_every_type_and_drops_brackets() -> None:
    doc = parse_manuscript(".fdx", (SAMPLES / "all-types.fdx").read_bytes())
    assert set(ELEMENT_NAMES) <= set(_types(doc))
    parenthetical = next(b for b in doc["content"] if b["type"] == "parenthetical")
    assert parenthetical["content"][0]["text"] == "тихо"


def test_fdx_marks() -> None:
    xml = (
        '<?xml version="1.0"?><FinalDraft><Content><Paragraph Type="Action">'
        '<Text Style="Bold+Italic">Вера</Text><Text> молчит</Text></Paragraph></Content></FinalDraft>'
    ).encode()
    (paragraph,) = parse_fdx(xml)
    assert [(r.text, r.marks) for r in paragraph.runs] == [("Вера", ("bold", "italic")), (" молчит", ())]


@pytest.mark.parametrize(
    ("data", "reason"),
    [
        (b"<FinalDraft><Content><Paragraph", "XML"),
        (b"<Script/>", "Final Draft"),
        (b'<FinalDraft><Content><Paragraph Type="Chorus"/></Content></FinalDraft>', "Chorus"),
        (b"<FinalDraft><Content/></FinalDraft>", "нет абзацев"),
    ],
)
def test_broken_fdx(data: bytes, reason: str) -> None:
    with pytest.raises(Invalid, match=reason):
        parse_fdx(data)


def test_russian_txt() -> None:
    doc = parse_manuscript(".txt", (SAMPLES / "manuscript.txt").read_bytes())
    assert _types(doc)[:5] == ["sceneHeading", "action", "character", "parenthetical", "dialogue"]
    uids = [b["attrs"]["uid"] for b in doc["content"] if b["type"] == "sceneHeading"]
    assert len(uids) == 2 and len(set(uids)) == 2


def test_docx_reads_like_txt() -> None:
    document = DocxDocument()
    lines = ("ИНТ. КУХНЯ — ДЕНЬ", "Вера ставит чайник.", "ВЕРА", "(тихо)", "Ты опять ходил к воде?", "Миша молчит.")
    for line in lines:
        document.add_paragraph(line)
    out = io.BytesIO()
    document.save(out)
    doc = parse_manuscript(".docx", out.getvalue())
    assert _types(doc) == ["sceneHeading", "action", "character", "parenthetical", "dialogue", "action"]


def test_names_from_the_text() -> None:
    doc = parse_manuscript(".fountain", (SAMPLES / "all-types.fountain").read_bytes())
    assert cast_from_text(doc) == ["Вера", "Миша"]
    assert places_from_text(doc) == ["Озеро, Мостки", "Дом Веры"]


def test_import_into_a_story(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, script_id = create_project(connection, owner, "Тихая вода")
    create_documents(connection, project.id, [{"kind": "character", "name": "Вера", "role": "main"}])
    stored = upload_file(
        connection, project.id, owner, "manuscript.txt", "import", None, (SAMPLES / "manuscript.txt").read_bytes()
    )
    text = import_into(connection, project.id, stored.id, 1)
    assert text.revision == 2
    assert _types(get_text(connection, script_id).content)[0] == "sceneHeading"
    names = sorted((d.kind, d.name) for d in list_documents(connection, project.id) if d.kind != "script")
    assert names == [("character", "Вера"), ("character", "Миша"), ("location", "Кухня"), ("location", "Озеро")]
    with pytest.raises(Conflict):
        import_into(connection, project.id, stored.id, 1)


def test_chat_file_is_not_imported(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, _ = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "notes.txt", "chat", f"{project.id}:1", b"text")
    with pytest.raises(Invalid):
        import_into(connection, project.id, stored.id, 1)

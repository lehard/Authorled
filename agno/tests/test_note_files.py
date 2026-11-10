"""Notes made from files (openspec/specs/api/stories: «Заметка из файла» … «Место для оригиналов заметок»)."""

import uuid

import pytest
from sqlalchemy import Connection, func, select

from core.drafts import empty_trash
from core.errors import Conflict, Invalid, NotFound, TooLarge
from core.files import FORMATS, CheckedFile, delete_file, file_bytes, file_text, get_file, store_file
from core.notes import (
    MAX_FILE_TEXT_CHARS,
    create_note,
    create_note_from_chat_file,
    create_note_from_file,
    delete_note,
    list_notes,
    note_text_from_file,
    remove_note_file,
    restore_note,
    trash_note,
    update_note,
)
from core.projects import create_project, trash_project
from core.tables import files
from core.users import get_or_create_user

MIB = 1024 * 1024
LIMIT = 500 * MIB


@pytest.fixture
def owner(connection: Connection) -> uuid.UUID:
    return get_or_create_user(connection, "materials-owner", "materials@authorled.test", "Автор").id


@pytest.fixture
def story(connection: Connection, owner: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    project, draft_id, _ = create_project(connection, owner, "Маяк")
    return project.id, draft_id


def _checked(name: str = "Эпоха.txt", text: str = "Москва, 1913", data: bytes | None = None) -> CheckedFile:
    return CheckedFile(name, FORMATS[".txt"], data if data is not None else text.encode(), text)


def _chat_file(connection: Connection, story: uuid.UUID, owner: uuid.UUID, purpose: str = "chat") -> uuid.UUID:
    session = f"{story}:1" if purpose == "chat" else None
    return store_file(connection, story, owner, purpose, session, _checked()).id


def test_note_from_a_file(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)

    assert (note.title, note.body, note.revision) == ("Эпоха", "Москва, 1913", 1)
    assert note.file is not None
    assert (note.file.name, note.file.size_bytes) == ("Эпоха.txt", len("Москва, 1913".encode()))
    assert get_file(connection, note.file.id).purpose == "note"
    assert [n.file for n in list_notes(connection, story[0])] == [note.file]


def test_text_changes_and_the_original_stays(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None

    changed = update_note(connection, note.id, 1, {"body": "Петербург"}, owner)

    assert changed.body == "Петербург"
    assert changed.file == note.file
    assert file_bytes(connection, note.file.id) == "Москва, 1913".encode()


def test_too_long_text_leaves_nothing(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    with pytest.raises(Invalid, match="500 000 знаков"):
        create_note_from_file(connection, story[0], owner, _checked(text="а" * (MAX_FILE_TEXT_CHARS + 1)), LIMIT)

    assert list_notes(connection, story[0]) == []
    assert connection.execute(select(func.count()).select_from(files)).scalar_one() == 0


def test_name_without_a_stem_is_refused(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    with pytest.raises(Invalid, match="названи"):
        create_note_from_file(connection, story[0], owner, _checked(name=".txt"), LIMIT)


def test_story_in_the_trash(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    trash_project(connection, story[0])

    with pytest.raises(Conflict):
        create_note_from_file(connection, story[0], owner, _checked(), LIMIT)


def test_place_ends(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), LIMIT)

    with pytest.raises(TooLarge, match="занято 3 МБ из 5 МБ"):
        create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), 5 * MIB)

    assert len(list_notes(connection, story[0])) == 1


def test_place_counts_the_trash_and_frees_on_delete(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), LIMIT)
    trash_note(connection, note.id)
    with pytest.raises(TooLarge):
        create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), 5 * MIB)

    delete_note(connection, note.id)

    assert create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), 5 * MIB).file


def test_files_of_conversations_take_no_place(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    store_file(connection, story[0], owner, "chat", f"{story[0]}:1", _checked(data=b"x" * 4 * MIB))

    assert create_note_from_file(connection, story[0], owner, _checked(data=b"x" * MIB), 2 * MIB).file


def test_place_is_the_users_across_stories(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    other, _, _ = create_project(connection, owner, "Паром")
    create_note_from_file(connection, other.id, owner, _checked(data=b"x" * 3 * MIB), LIMIT)

    with pytest.raises(TooLarge):
        create_note_from_file(connection, story[0], owner, _checked(data=b"x" * 3 * MIB), 5 * MIB)


def test_trash_keeps_the_original_and_delete_removes_it(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None

    trashed = trash_note(connection, note.id)
    assert trashed.file == note.file
    assert file_bytes(connection, note.file.id) == "Москва, 1913".encode()
    assert restore_note(connection, note.id).file == note.file

    trash_note(connection, note.id)
    delete_note(connection, note.id)
    with pytest.raises(NotFound):
        get_file(connection, note.file.id)


def test_emptied_trash_removes_originals(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None
    trash_note(connection, note.id)

    empty_trash(connection, story[1])

    assert list_notes(connection, story[0]) == []
    with pytest.raises(NotFound):
        get_file(connection, note.file.id)


def test_original_is_not_deleted_alone(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None

    with pytest.raises(Conflict, match="вместе с заметкой"):
        delete_file(connection, note.file.id)

    assert get_file(connection, note.file.id).purpose == "note"


def test_note_from_a_chat_file_is_a_copy(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    chat = _chat_file(connection, story[0], owner)

    note = create_note_from_chat_file(connection, chat, owner, LIMIT)

    assert note.file is not None
    assert note.file.id != chat
    assert (note.title, note.body) == ("Эпоха", "Москва, 1913")
    assert file_bytes(connection, note.file.id) == file_bytes(connection, chat)
    assert get_file(connection, chat).purpose == "chat"
    delete_file(connection, chat)
    assert get_file(connection, note.file.id).purpose == "note"


@pytest.mark.parametrize("purpose", ["import", "note"])
def test_only_a_chat_file_goes_to_notes(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID], purpose: str
) -> None:
    if purpose == "note":
        made = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
        assert made.file is not None
        source = made.file.id
    else:
        source = _chat_file(connection, story[0], owner, purpose)

    with pytest.raises(Invalid, match="только файл беседы"):
        create_note_from_chat_file(connection, source, owner, LIMIT)


def pdf_of_lines(lines: list[str]) -> bytes:
    """A one-page PDF with each line of Latin text on its own line of the page."""
    shown = " ".join(f"({line}) Tj 0 -14 Td" for line in lines)
    stream = f"BT /F1 12 Tf 72 720 Td {shown} ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R"
        b" /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    start = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    return out


def test_removing_the_original_keeps_the_text_and_frees_the_place(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    small = 2 * MIB
    note = create_note_from_file(connection, story[0], owner, _checked(data=b"x" * MIB), small)
    assert note.file is not None
    with pytest.raises(TooLarge):
        create_note_from_file(connection, story[0], owner, _checked(data=b"y" * (MIB + 1)), small)

    changed = remove_note_file(connection, note.id, 1, owner)

    assert (changed.title, changed.body, changed.revision, changed.file) == ("Эпоха", "Москва, 1913", 2, None)
    with pytest.raises(NotFound):
        get_file(connection, note.file.id)
    assert create_note_from_file(connection, story[0], owner, _checked(data=b"y" * (MIB + 1)), small).file


def test_removing_the_original_is_refused_without_a_change(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    plain = create_note(connection, story[0], "Финал", "", owner)
    with pytest.raises(Conflict, match="нет оригинала"):
        remove_note_file(connection, plain.id, 1, owner)

    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None
    with pytest.raises(Conflict, match="ревизия"):
        remove_note_file(connection, note.id, 2, owner)
    trash_note(connection, note.id)
    with pytest.raises(Conflict, match="в корзине"):
        remove_note_file(connection, note.id, 1, owner)
    restore_note(connection, note.id)
    trash_project(connection, story[0])
    with pytest.raises(Conflict):
        remove_note_file(connection, note.id, 1, owner)

    assert get_file(connection, note.file.id).purpose == "note"


def test_text_comes_back_from_the_original(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    assert note.file is not None
    update_note(connection, note.id, 1, {"body": "черновик"}, owner)

    back = note_text_from_file(connection, note.id, 2, owner)

    assert (back.body, back.revision) == ("Москва, 1913", 3)
    assert file_bytes(connection, note.file.id) == "Москва, 1913".encode()


def test_old_pdf_note_gets_paragraphs(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    data = pdf_of_lines(["The author writes", "about the sea.", "Bank 044525823"])
    old_text = "The author writes\nabout the sea.\nBank 044525823"
    note = create_note_from_file(
        connection, story[0], owner, CheckedFile("Sea.pdf", FORMATS[".pdf"], data, old_text), LIMIT
    )
    assert note.file is not None

    back = note_text_from_file(connection, note.id, 1, owner)

    assert back.body == "The author writes about the sea.\nBank 044525823"
    assert file_text(connection, note.file.id) == old_text


def test_text_from_the_original_is_refused_without_a_change(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    plain = create_note(connection, story[0], "Финал", "свой", owner)
    with pytest.raises(Conflict, match="нет оригинала"):
        note_text_from_file(connection, plain.id, 1, owner)

    note = create_note_from_file(connection, story[0], owner, _checked(), LIMIT)
    update_note(connection, note.id, 1, {"body": "черновик"}, owner)
    trash_note(connection, note.id)
    with pytest.raises(Conflict, match="в корзине"):
        note_text_from_file(connection, note.id, 2, owner)
    assert [n.body for n in list_notes(connection, story[0]) if n.id == note.id] == ["черновик"]

"""Search of a draft and its story (openspec/specs/api/stories: «Поиск по драфту истории» … «Отказы поиска»)."""

import time
import uuid
from typing import Any

import pytest
from sqlalchemy import Connection

from core.documents import create_documents, list_documents, trash_document, update_document
from core.drafts import update_draft
from core.errors import Invalid
from core.notes import create_note, trash_note
from core.projects import create_project
from core.review import create_suggestion
from core.search import fold, search_draft
from core.texts import get_text, heading, put_text, screenplay_id
from core.users import get_or_create_user


def _block(kind: str, text: str, marks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return {"type": kind, "content": [node]}


TEXT = {
    "type": "doc",
    "content": [
        _block("act", "Акт первый. Вера"),
        heading("s1", "НАТ. ОЗЕРО — УТРО"),
        _block("action", "Туман над водой."),
        heading("s2", "ИНТ. ДОМ ВЕРЫ — ДЕНЬ"),
        _block("action", "Вера кладёт нож."),
        {"type": "pageBreak"},
        _block("dialogue", "Вера, ты где?", [{"type": "comment", "attrs": {"id": "c1"}}]),
        heading("s3", "ИНТ. ГАРАЖ — ДЕНЬ"),
        _block("action", "Разобранный мотор на верстаке. КОЛЯ протирает ключ ветошью."),
        _block("beat", "Коля ждёт вопроса"),
    ],
}


@pytest.fixture
def owner(connection: Connection) -> uuid.UUID:
    return get_or_create_user(connection, "search-owner", "search@authorled.test", "Автор").id


@pytest.fixture
def story(connection: Connection, owner: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """The story «Тихая вода»: the text above, Vera, Kolya, a lake, a logline and two notes."""
    project, draft, script = create_project(connection, owner, "Тихая вода")
    put_text(connection, script, 1, TEXT, owner)
    create_documents(
        connection,
        draft,
        [
            {"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "Что Аня уйдёт"}},
            {
                "kind": "character",
                "name": "Коля",
                "role": "secondary",
                "summary": "Сосед",
                "fields": {"description": "Сорок лет чинит моторы и лодки посёлка.", "gender": "m"},
            },
            {"kind": "location", "name": "Озеро", "role": "main", "fields": {"smell": "Тина и бензин"}},
        ],
        owner,
    )
    (script_document,) = [d for d in list_documents(connection, draft) if d.kind == "script"]
    update_document(
        connection, script_document.id, script_document.revision, {"fields": {"logline": "Посёлок у озера."}}, owner
    )
    create_note(connection, project.id, "Финал", "Вера наконец говорит.", owner)
    create_note(connection, project.id, "Музыка", "Без песен.", owner)
    return project.id, draft


def test_a_name_across_the_story(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    found = search_draft(connection, story[1], "вера")
    assert [(s.uid, s.number) for s in found.scenes] == [(None, 0), ("s2", 2)]
    assert [(d.name, d.field) for d in found.documents] == [("Вера", "name")]
    assert [(n.title, n.field) for n in found.notes] == [("Финал", "body")]
    # The action and the commented line: the comment mark does not hide the text; «ВЕРЫ» is not «вера».
    assert found.scenes[1].count == 2
    assert found.scenes[1].snippet.match == "Вера"


def test_outside_scenes_comes_first(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    (outside,) = search_draft(connection, story[1], "акт перв").scenes
    assert (outside.uid, outside.number, outside.heading, outside.snippet.match) == (None, 0, "", "Акт перв")


def test_yo_and_ye(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    found = search_draft(connection, story[1], "ПОСЕЛОК")
    logline = next(d for d in found.documents if d.field == "logline")
    assert logline.kind == "script" and logline.snippet.match == "Посёлок"
    assert search_draft(connection, story[1], "кладет нож").scenes[0].snippet.match == "кладёт нож"


def test_logline_and_synopsis_apart(
    connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]
) -> None:
    (script,) = [d for d in list_documents(connection, story[1]) if d.kind == "script"]
    update_document(connection, script.id, script.revision, {"fields": {"synopsis": "Аня едет в посёлок."}}, owner)
    found = search_draft(connection, story[1], "поселок")
    assert [(d.kind, d.field) for d in found.documents if d.kind == "script"] == [
        ("script", "logline"),
        ("script", "synopsis"),
    ]


def test_snippet_around_the_match(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    (scene,) = search_draft(connection, story[1], "КЛЮЧ").scenes
    assert (scene.number, scene.heading, scene.count) == (3, "ИНТ. ГАРАЖ — ДЕНЬ", 1)
    assert scene.snippet.match == "ключ"
    assert scene.snippet.before == "…мотор на верстаке. КОЛЯ протирает "
    assert scene.snippet.after == " ветошью."


def test_long_text_is_cut_on_words(connection: Connection, owner: uuid.UUID) -> None:
    project, draft, _ = create_project(connection, owner, "Маяк")
    body = (
        "раз два три четыре пять шесть семь восемь девять\nМАЯК\nдесять одиннадцать двенадцать тринадцать четырнадцать"
    )
    create_note(connection, project.id, "Свет", body, owner)
    (note,) = search_draft(connection, draft, "маяк").notes
    assert note.snippet.before == "…четыре пять шесть семь восемь девять "
    assert note.snippet.after == " десять одиннадцать двенадцать…"


def test_a_profile_field(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    (kolya,) = search_draft(connection, story[1], "моторы").documents
    assert (kolya.name, kolya.kind, kolya.field) == ("Коля", "character", "description")
    (lake,) = search_draft(connection, story[1], "бензин").documents
    assert (lake.kind, lake.field) == ("location", "smell")


def test_order_of_the_navigator(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    found = search_draft(connection, story[1], "озер")
    assert [(d.kind, d.field) for d in found.documents] == [("location", "name"), ("script", "logline")]
    assert [s.number for s in found.scenes] == [1]


def test_trash_is_not_searched(connection: Connection, owner: uuid.UUID, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    lake = next(d for d in list_documents(connection, story[1]) if d.name == "Озеро")
    trash_document(connection, lake.id)
    assert [d.kind for d in search_draft(connection, story[1], "бензин").documents] == []
    music = create_note(connection, story[0], "Песня", "Колыбельная", owner)
    trash_note(connection, music.id)
    assert search_draft(connection, story[1], "колыбельн").notes == ()


def test_a_locked_draft_is_searched_and_left(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    update_draft(connection, story[1], {"locked": True})
    script = screenplay_id(connection, story[1])
    before = get_text(connection, script).revision
    assert search_draft(connection, story[1], "вера").scenes
    assert get_text(connection, script).revision == before


def test_suggested_text_is_not_searched(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    create_suggestion(
        connection, screenplay_id(connection, story[1]), "s2", "Вера кладёт нож.", "Нина режет хлеб.", "", "x:y:z"
    )
    assert search_draft(connection, story[1], "режет хлеб").scenes == ()


def test_nothing_found(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    found = search_draft(connection, story[1], "дирижабль")
    assert (found.query, found.scenes, found.documents, found.notes) == ("дирижабль", (), (), ())


@pytest.mark.parametrize(
    ("query", "reason"),
    [
        ("", "Пустой запрос"),
        ("   ", "Пустой запрос"),
        ("а", "не меньше 2"),
        (" а ", "не меньше 2"),
        ("я" * 201, "не больше 200"),
    ],
)
def test_refusals(connection: Connection, story: tuple[uuid.UUID, uuid.UUID], query: str, reason: str) -> None:
    with pytest.raises(Invalid, match=reason):
        search_draft(connection, story[1], query)


def test_query_is_stripped(connection: Connection, story: tuple[uuid.UUID, uuid.UUID]) -> None:
    assert search_draft(connection, story[1], "  ключ  ").query == "ключ"
    assert len(search_draft(connection, story[1], "я" * 200).query) == 200


def test_fold_keeps_every_character_in_place() -> None:
    assert fold("ЁжИк") == "ежик"
    # «İ».lower() is two characters: it stays, so the positions after it do not move.
    assert fold("İВЕРА") == "İвера"
    assert len(fold("İВЕРА")) == len("İВЕРА")


def test_a_long_screenplay(connection: Connection, owner: uuid.UUID) -> None:
    _, draft, script = create_project(connection, owner, "Длинная")
    blocks: list[dict[str, Any]] = []
    for number in range(1, 301):
        blocks += [
            heading(f"s{number}", f"ИНТ. КОМНАТА {number} — ДЕНЬ"),
            _block("action", "Вера смотрит в окно и молчит. " * 5),
            _block("character", "ВЕРА"),
            _block("dialogue", "Я не знаю, что сказать тебе сегодня."),
        ]
    put_text(connection, script, 1, {"type": "doc", "content": blocks}, owner)
    started = time.perf_counter()
    found = search_draft(connection, draft, "вера")
    elapsed = time.perf_counter() - started
    assert len(found.scenes) == 300 and found.scenes[0].count == 6
    print(f"search of 300 scenes: {elapsed * 1000:.1f} ms")

"""Import of STARC projects (openspec/specs/api/story-import) on the sample and its spoiled copies."""

import pytest
from sqlalchemy import Connection

from core.documents import list_documents
from core.errors import Invalid
from core.files import file_text, upload_file
from core.importers.starc import parse_starc
from core.imports import import_into, parse_manuscript
from core.projects import create_project
from core.texts import get_text
from core.users import get_or_create_user
from tests.starc_sample import SAMPLE, STRUCTURE, TEXT, edited, novel, run_sql

TRASH_END = 'type="application/x-starc/document/recycle-bin" name="Корзина"'
SECOND_SCREENPLAY = (
    '<item uuid="{00000000-0000-0000-0000-000000000001}" type="application/x-starc/document/screenplay"/>'
)


def test_paragraphs_of_the_sample() -> None:
    project = parse_starc(SAMPLE.read_bytes())
    assert [(p.kind, "".join(r.text for r in p.runs)) for p in project.paragraphs[:5]] == [
        ("sceneHeading", "ИНТ. КУХНЯ - ДЕНЬ"),
        ("action", "Вера ставит чайник. "),
        ("character", "ВЕРА"),
        ("parenthetical", "тихо"),
        ("dialogue", "Ты опять ходил к воде?"),
    ]


def test_names_of_the_project() -> None:
    project = parse_starc(SAMPLE.read_bytes())
    assert project.characters == ["Вера", "Миша", "Олег"]
    assert project.locations == ["Кухня", "Озеро", "Маяк"]


def test_a_name_with_lower_case_stays() -> None:
    project = parse_starc(edited(STRUCTURE, 'name="ОЛЕГ"', 'name="Олег де Ниро"'))
    assert project.characters[-1] == "Олег де Ниро"


def test_every_scene_gets_a_new_uid() -> None:
    first = parse_manuscript(".starc", SAMPLE.read_bytes()).doc
    second = parse_manuscript(".starc", SAMPLE.read_bytes()).doc
    uids = [b["attrs"]["uid"] for doc in (first, second) for b in doc["content"] if b["type"] == "sceneHeading"]
    assert len(uids) == 4 and len(set(uids)) == 4


def test_the_trash_is_not_imported() -> None:
    inside = (
        f'{TRASH_END} draft_name="" color="" draft_color="" visible="true">{SECOND_SCREENPLAY}'
        '<item uuid="{00000000-0000-0000-0000-000000000002}" type="application/x-starc/document/character" '
        'name="УДАЛЁННЫЙ"/></item'
    )
    old = f'{TRASH_END} draft_name="Текущий драфт" color="" draft_color="" visible="true"/'
    project = parse_starc(edited(STRUCTURE, old, inside))
    assert project.characters == ["Вера", "Миша", "Олег"]


@pytest.mark.parametrize(
    ("data", "reason"),
    [
        (b"not a database", "не читается"),
        (SAMPLE.read_bytes()[:3000], "не читается"),
        (run_sql("DROP TABLE documents"), "таблицы документов"),
        (run_sql("DELETE FROM documents WHERE type = 1"), "документ структуры"),
        (run_sql("DELETE FROM documents WHERE type = 10104"), "нет текста сценария"),
        (run_sql("UPDATE documents SET content = NULL WHERE type = 10104"), "пуст"),
        (run_sql("UPDATE documents SET content = CAST('<document' AS BLOB) WHERE type = 10104"), "XML"),
        (novel(), "нет сценария"),
        (
            edited(STRUCTURE, '<item uuid="{d88395d6', f'{SECOND_SCREENPLAY}<item uuid="{{d88395d6'),
            "несколько сценариев",
        ),
        (edited(STRUCTURE, 'document/screenplay/text"', 'document/screenplay/other"'), "ровно один текст"),
        (edited(STRUCTURE, 'name="ОЛЕГ"', 'name=" "'), "без имени"),
        (edited(TEXT, "<action><v><![CDATA[Стук в дверь.]]></v></action>", "<chorus><v/></chorus>"), "chorus"),
        (edited(TEXT, "</scene>", "</scene><act/>"), "Группа STARC «act»"),
        (edited(TEXT, "<content>", "<title>Первая</title><content>"), "Параметр сцены STARC «title»"),
        (edited(TEXT, "</v></dialogue>", '</v><fms><fm from="0" length="1" bold="true"/></fms></dialogue>'), "fms"),
    ],
)
def test_refused_files(data: bytes, reason: str) -> None:
    with pytest.raises(Invalid, match=reason):
        parse_starc(data)


def test_text_for_the_coauthor(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, _ = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "p.starc", "chat", f"{project.id}:1", SAMPLE.read_bytes())
    assert stored.media_type == "application/x-starc"
    assert "Ты опять ходил к воде?" in file_text(connection, stored.id)


def test_import_into_a_story(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, script_id = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "p.starc", "import", None, SAMPLE.read_bytes())
    import_into(connection, project.id, stored.id, 1)
    assert get_text(connection, script_id).content["content"][0]["type"] == "sceneHeading"
    found = [(d.kind, d.name, d.role) for d in list_documents(connection, project.id) if d.kind != "script"]
    assert found == [
        ("character", "Вера", "episodic"),
        ("character", "Миша", "episodic"),
        ("character", "Олег", "episodic"),
        ("character", "Почтальон", "episodic"),
        ("location", "Кухня", "episodic"),
        ("location", "Озеро", "episodic"),
        ("location", "Маяк", "episodic"),
    ]

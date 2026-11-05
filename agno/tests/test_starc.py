"""Import of STARC projects (openspec/specs/api/story-import) on the sample and its spoiled copies."""

import pytest
from sqlalchemy import Connection

from core.documents import list_documents
from core.errors import Invalid
from core.files import file_text, upload_file
from core.importers.starc import parse_starc
from core.imports import import_into, parse_manuscript
from core.projects import create_project
from core.texts import ELEMENT_NAMES, get_text
from core.users import get_or_create_user
from tests.starc_sample import SAMPLE, STRUCTURE, TEXT, edited, novel, run_sql, with_role, with_text

TRASH_END = 'type="application/x-starc/document/recycle-bin" name="Корзина"'
SECOND_SCREENPLAY = (
    '<item uuid="{00000000-0000-0000-0000-000000000001}" type="application/x-starc/document/screenplay"/>'
)


HEADING = "<scene_heading><v><![CDATA[ИНТ. ДОМ - ДЕНЬ]]></v></scene_heading>"


def _action(extra: str) -> str:
    return f'<scene uuid="{{1}}"><content><action><v>Вера</v>{extra}</action></content></scene>'


FULL_TEXT = f"""
<act uuid="{{1}}"><color><![CDATA[#ff0000]]></color><content>
<act_heading><v><![CDATA[Акт первый]]></v></act_heading>
<sequence uuid="{{2}}"><content>
<sequence_heading><v><![CDATA[Дом]]></v></sequence_heading>
<scene uuid="{{3}}" plots="" >
<number value="7" custom="true"/>
<color><![CDATA[#e0a030]]></color>
<title><![CDATA[Завтрак &amp; ссора]]></title>
<story_day><![CDATA[День 1]]></story_day>
<stamp><![CDATA[черновик]]></stamp>
<tags><tag color="#ff0000"><![CDATA[ключевая]]></tag><tag color="#00ff00"><![CDATA[дом]]></tag></tags>
<content>
{HEADING}
<scene_characters><v><![CDATA[ВЕРА, МИША]]></v></scene_characters>
<beat uuid="{{4}}" plots="" ><title><![CDATA[Бит]]></title><content>
<beat_heading><v><![CDATA[Вера решается]]></v></beat_heading>
<action><params align="left"/>
<bm color="#ff0000"><![CDATA[закладка]]></bm><v><![CDATA[Вера 😀 ждёт &quot;письмо&quot;.]]></v>
<rms><rm from="0" length="1"/></rms>
<fms><fm from="0" length="4" bold="true"/><fm from="5" length="2" italic="true"/><fm from="8" length="1"/></fms>
<rss><rs from="0" length="1" uuid="{{5}}"/></rss></action>
</content></beat>
<splitter type="start"/>
<character><v><![CDATA[ВЕРА]]></v></character>
<parenthetical><v><![CDATA[тихо]]></v></parenthetical>
<dialogue><v><![CDATA[Да.]]></v></dialogue>
<page_splitter><v><![CDATA[]]></v></page_splitter>
<splitter type="end"/>
<lyrics><v><![CDATA[Ля-ля]]></v></lyrics>
<shot><v><![CDATA[Крупно]]></v></shot>
<unformatted_text><v><![CDATA[Текст]]></v></unformatted_text>
<inline_note><v><![CDATA[Заметка]]></v></inline_note>
<transition><v><![CDATA[CUT TO:]]></v></transition>
</content></scene>
<sequence_footer><v><![CDATA[]]></v></sequence_footer>
</content></sequence>
<act_footer><v><![CDATA[]]></v></act_footer>
</content></act>
<scene uuid="{{6}}" plots="" >
<content><scene_heading><v><![CDATA[НАТ. ОЗЕРО - ВЕЧЕР]]></v></scene_heading></content></scene>
"""


def test_every_paragraph_type_of_a_full_text() -> None:
    doc = parse_manuscript(".starc", with_text(FULL_TEXT)).doc
    assert set(ELEMENT_NAMES) <= {block["type"] for block in doc["content"]}
    kinds = [block["type"] for block in doc["content"]]
    assert kinds[:6] == ["act", "sequence", "sceneHeading", "sceneCharacters", "beat", "action"]
    assert kinds[-1] == "sceneHeading"


def test_scene_parameters_go_to_the_heading() -> None:
    doc = parse_manuscript(".starc", with_text(FULL_TEXT)).doc
    first, second = (block["attrs"] for block in doc["content"] if block["type"] == "sceneHeading")
    assert (first["alt"], first["day"], first["color"], first["tags"]) == (
        "Завтрак & ссора",
        "День 1",
        "2",
        ["ключевая", "дом"],
    )
    assert (second["alt"], second["day"], second["color"], second["tags"]) == ("", "", None, [])


def test_inline_formats_count_utf16_units() -> None:
    doc = parse_manuscript(".starc", with_text(FULL_TEXT)).doc
    action = next(block for block in doc["content"] if block["type"] == "action")
    assert [(node["text"], [mark["type"] for mark in node.get("marks", [])]) for node in action["content"]] == [
        ("Вера", ["bold"]),
        (" ", []),
        ("😀", ["italic"]),
        (' ждёт "письмо".', []),
    ]


@pytest.mark.parametrize(
    ("color", "mark"),
    [
        ("#e0115f", "1"),
        ("#ffa000", "2"),
        ("#00a090", "3"),
        ("#2060e0", "4"),
        ("#808080", None),
    ],
)
def test_scene_color_is_the_nearest_label(color: str, mark: str | None) -> None:
    text = f'<scene uuid="{{1}}"><color><![CDATA[{color}]]></color><content>{HEADING}</content></scene>'
    assert parse_starc(with_text(text)).paragraphs[0].scene["color"] == mark


@pytest.mark.parametrize(("value", "role"), [("0", "main"), ("1", "secondary"), ("2", "episodic"), ("3", "episodic")])
def test_roles_of_characters_and_locations(value: str, role: str) -> None:
    assert parse_starc(with_role("ОЛЕГ", value)).characters[-1].role == role
    assert parse_starc(with_role("МАЯК", value)).locations[-1].role == role


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
    assert [c.name for c in project.characters] == ["Вера", "Миша", "Олег"]
    assert [location.name for location in project.locations] == ["Кухня", "Озеро", "Маяк"]
    assert {c.role for c in project.characters + project.locations} == {"episodic"}


def test_a_name_with_lower_case_stays() -> None:
    project = parse_starc(edited(STRUCTURE, 'name="ОЛЕГ"', 'name="Олег де Ниро"'))
    assert project.characters[-1].name == "Олег де Ниро"


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
    assert [c.name for c in project.characters] == ["Вера", "Миша", "Олег"]


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
        (with_text('<part uuid="{1}"><content/></part>'), "«part»"),
        (with_text('<act uuid="{1}"/>'), "нет содержимого"),
        (with_text(f'<act uuid="{{1}}"><mystery/><content>{HEADING}</content></act>'), "«mystery» в «act»"),
        (with_text(f'<scene uuid="{{1}}"><mystery/><content>{HEADING}</content></scene>'), "«mystery» в «scene»"),
        (with_text('<scene uuid="{1}"><content><action><zzz/><v>а</v></action></content></scene>'), "«zzz»"),
        (with_text('<scene uuid="{1}"><content><action/></content></scene>'), "нет текста"),
        (with_text('<scene uuid="{1}"><title>Без заголовка</title><content/></scene>'), "нет заголовка"),
        (with_text(f'<scene uuid="{{1}}"><color>red</color><content>{HEADING}</content></scene>'), "цвет STARC «red»"),
        (with_text(_action('<fms><fm from="0" length="9"/></fms>')), "за пределы"),
        (with_text(_action('<fms><fm from="x" length="1"/></fms>')), "«from»"),
        (with_text(_action("<fms><b/></fms>")), "«b»"),
        (with_text(""), "нет абзацев"),
        (with_role("ОЛЕГ", "7"), "роль STARC «7» у «ОЛЕГ»"),
    ],
)
def test_refused_files(data: bytes, reason: str) -> None:
    with pytest.raises(Invalid, match=reason):
        parse_starc(data)


def test_text_for_the_coauthor(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, draft, _ = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "p.starc", "chat", f"{project.id}:1", SAMPLE.read_bytes())
    assert stored.media_type == "application/x-starc"
    assert "Ты опять ходил к воде?" in file_text(connection, stored.id)


def test_import_into_a_story(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, draft, script_id = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "p.starc", "import", None, SAMPLE.read_bytes())
    import_into(connection, draft, stored.id, 1, owner)
    assert get_text(connection, script_id).content["content"][0]["type"] == "sceneHeading"
    found = [(d.kind, d.name, d.role) for d in list_documents(connection, draft) if d.kind != "script"]
    assert found == [
        ("character", "Вера", "episodic"),
        ("character", "Миша", "episodic"),
        ("character", "Олег", "episodic"),
        ("character", "Почтальон", "episodic"),
        ("location", "Кухня", "episodic"),
        ("location", "Озеро", "episodic"),
        ("location", "Маяк", "episodic"),
    ]


def test_main_character_who_does_not_speak(connection: Connection) -> None:
    owner = get_or_create_user(connection, "s1", "writer@authorled.test", "Сценарист").id
    project, draft, _ = create_project(connection, owner, "Тихая вода")
    stored = upload_file(connection, project.id, owner, "p.starc", "import", None, with_role("ОЛЕГ", "0"))
    import_into(connection, draft, stored.id, 1, owner)
    roles = {d.name: d.role for d in list_documents(connection, draft) if d.kind == "character"}
    assert roles["Олег"] == "main"

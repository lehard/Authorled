"""Stories and documents in the core (openspec/specs/api/stories): fields, trash, revisions, positions, access."""

import ast
import uuid
from pathlib import Path

import pytest
from sqlalchemy import Connection, Engine, delete, select, update

from core.documents import (
    create_documents,
    delete_document,
    list_documents,
    restore_document,
    trash_document,
    update_document,
    update_document_by_coauthor,
)
from core.drafts import empty_trash
from core.errors import Conflict, Invalid, Locked
from core.fields import FIELD_HINTS, FIELDS, field_guide, merge_fields, validate_fields
from core.projects import (
    ProjectAccess,
    create_project,
    delete_project,
    list_projects,
    owns_project,
    restore_project,
    trash_project,
    update_project,
    user_id_of,
)
from core.tables import document_versions, drafts, projects, subscriptions, user_settings, users
from core.texts import get_text
from core.users import AccountNotFound, get_or_create_user


def _owner(connection: Connection, subject: str = "s1") -> uuid.UUID:
    return get_or_create_user(connection, subject, f"{subject}@authorled.test", "Сценарист").id


# --- fields of the kinds


def test_field_of_another_kind_is_named() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("location", {"age": "30"})
    assert error.value.field == "fields.age"


def test_screenplay_has_no_tagline() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("script", {"tagline": "Фраза"})
    assert error.value.field == "fields.tagline"


def test_parts_need_the_logline() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("script", {"show": {"title": True, "synopsis": True, "treatment": True, "text": True}})
    assert error.value.field == "fields.show.logline"


def test_wrong_type_is_named() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("world", {"overview": 5})
    assert error.value.field == "fields.overview"


def test_every_wrong_field_is_named_at_once() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("character", {"speech": {"value": "Бормочет"}, "age": 55, "appearance": "Худой"})
    detail = str(error.value)
    assert error.value.field == "fields.speech"
    assert "«speech»: ожидается строка" in detail
    assert "«age»: ожидается строка" in detail
    assert "«appearance» нет у документа этого вида" in detail
    assert "Поля персонажа: " in detail and "personality" in detail
    assert detail.index("speech") < detail.index("«age»") < detail.index("appearance")


def test_gender_outside_the_list() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("character", {"gender": "male"})
    assert str(error.value) == "Поле «gender»: допустимые значения — f, m, o или пусто."


def test_screenplay_parts_name_what_is_expected() -> None:
    with pytest.raises(Invalid) as error:
        validate_fields("script", {"show": {"title": 1}, "title_page": "Маяк"})
    detail = str(error.value)
    assert "«show.title»: ожидается да или нет" in detail
    assert "«show.logline» обязательно" in detail
    assert "«title_page»: ожидается объект" in detail


@pytest.mark.parametrize("kind", sorted(FIELDS))
def test_every_field_has_wording_for_a_wrong_value(kind: str) -> None:
    for name in FIELDS[kind].model_fields:
        with pytest.raises(Invalid) as error:
            validate_fields(kind, {name: 5})
        assert f"«{name}" in str(error.value)


def test_field_guide_names_every_field_the_coauthor_may_set() -> None:
    guide = field_guide(("character", "location", "world", "script"))
    for kind in ("character", "location", "world"):
        for name in FIELDS[kind].model_fields:
            assert f"{name} — " in guide
    assert set(FIELD_HINTS["script"]) == {"logline", "synopsis"}
    assert "show" not in guide and "title_page" not in guide
    assert "gender — пол, f женский, m мужской, o другой (f, m, o или пусто)" in guide


def test_partial_profile_change_keeps_other_fields() -> None:
    assert merge_fields("character", {"fear": "вода", "habits": "курит"}, {"fear": "огонь"}) == {
        "fear": "огонь",
        "habits": "курит",
    }


def test_null_removes_a_field() -> None:
    assert merge_fields("character", {"fear": "вода"}, {"fear": None}) == {}


# --- stories


def test_new_story_has_one_screenplay_with_a_scene(connection: Connection) -> None:
    project, draft, script_id = create_project(connection, _owner(connection), "  Маяк ")
    assert project.title == "Маяк"
    tree = list_documents(connection, draft)
    assert [(d.kind, d.name) for d in tree] == [("script", "Сценарий")]
    blocks = get_text(connection, script_id).content["content"]
    assert blocks[0]["type"] == "sceneHeading" and blocks[0]["attrs"]["uid"]


def test_empty_title_is_refused(connection: Connection) -> None:
    with pytest.raises(Invalid):
        create_project(connection, _owner(connection), "  ")


def test_shelf_and_trash(connection: Connection) -> None:
    owner = _owner(connection)
    lighthouse, _, _ = create_project(connection, owner, "Маяк")
    ferry, _, _ = create_project(connection, owner, "Паром")
    trash_project(connection, ferry.id)
    assert [p.title for p in list_projects(connection, owner, trash=False)] == ["Маяк"]
    assert [p.title for p in list_projects(connection, owner, trash=True)] == ["Паром"]
    restore_project(connection, ferry.id)
    assert {p.id for p in list_projects(connection, owner, trash=False)} == {lighthouse.id, ferry.id}


def test_story_outside_trash_is_not_deleted(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Conflict):
        delete_project(connection, project.id)


def test_story_in_trash_refuses_changes(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    (vera,) = create_documents(
        connection, draft, [{"kind": "character", "name": "Вера", "role": "main"}], _owner(connection)
    )
    trash_project(connection, project.id)
    with pytest.raises(Conflict):
        update_project(connection, project.id, {"title": "Новое"})
    with pytest.raises(Conflict):
        update_document(connection, vera.id, vera.revision, {"name": "Вера Андреевна"}, _owner(connection))


def test_unknown_story_field_is_named(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Invalid) as error:
        update_project(connection, project.id, {"color": "red"})
    assert error.value.field == "color"


# --- documents


def test_batch_is_all_or_nothing(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Invalid):
        create_documents(
            connection,
            draft,
            [
                {"kind": "character", "name": "Нина", "role": "episodic"},
                {"kind": "character", "name": " ", "role": "episodic"},
            ],
            _owner(connection),
        )
    assert [d.kind for d in list_documents(connection, draft)] == ["script"]


def test_screenplay_has_one_name(connection: Connection) -> None:
    owner = _owner(connection)
    _, draft, script = create_project(connection, owner, "Маяк")
    assert [d.name for d in list_documents(connection, draft)] == ["Сценарий"]
    with pytest.raises(Invalid) as error:
        update_document(connection, script, 1, {"name": "Маяк"}, owner)
    assert error.value.field == "name"


def test_screenplay_is_not_created_by_hand(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Invalid):
        create_documents(connection, draft, [{"kind": "script", "name": "Второй"}], _owner(connection))


def test_world_has_no_role(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Invalid) as error:
        create_documents(connection, draft, [{"kind": "world", "name": "Деревня", "role": "main"}], _owner(connection))
    assert error.value.field == "role"


def test_old_revision_is_refused(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    (vera,) = create_documents(
        connection, draft, [{"kind": "character", "name": "Вера", "role": "main"}], _owner(connection)
    )
    first = update_document(connection, vera.id, vera.revision, {"fields": {"fear": "вода"}}, _owner(connection))
    assert first.revision == vera.revision + 1
    with pytest.raises(Conflict):
        update_document(connection, vera.id, vera.revision, {"fields": {"fear": "огонь"}}, _owner(connection))


def test_coauthor_change_keeps_a_snapshot_every_time(connection: Connection) -> None:
    """A change of the co-author is always preceded by a snapshot `coauthor`, even right after another one."""
    owner = _owner(connection)
    project, draft, _ = create_project(connection, owner, "Маяк")
    (vera,) = create_documents(connection, draft, [{"kind": "character", "name": "Вера", "role": "main"}], owner)
    update_document(connection, vera.id, vera.revision, {"fields": {"fear": "Остаться одной"}}, owner)
    changed = update_document_by_coauthor(connection, vera.id, {"fields": {"fear": "Что Аня узнает правду"}}, owner)
    assert changed.fields["fear"] == "Что Аня узнает правду"
    assert changed.revision == vera.revision + 2
    kept = connection.execute(
        select(document_versions.c.reason, document_versions.c.content)
        .where(document_versions.c.document_id == vera.id)
        .order_by(document_versions.c.created_at)
    ).all()
    assert kept[-1].reason == "coauthor"
    assert kept[-1].content["fields"]["fear"] == "Остаться одной"


def test_coauthor_does_not_reorder(connection: Connection) -> None:
    owner = _owner(connection)
    project, draft, _ = create_project(connection, owner, "Маяк")
    (vera,) = create_documents(connection, draft, [{"kind": "character", "name": "Вера", "role": "main"}], owner)
    with pytest.raises(Invalid) as error:
        update_document_by_coauthor(connection, vera.id, {"position": 0}, owner)
    assert error.value.field == "position"


def test_coauthor_change_in_a_locked_draft_or_the_trash(connection: Connection) -> None:
    owner = _owner(connection)
    project, draft, _ = create_project(connection, owner, "Маяк")
    vera, anna = create_documents(
        connection,
        draft,
        [{"kind": "character", "name": "Вера", "role": "main"}, {"kind": "character", "name": "Аня", "role": "main"}],
        owner,
    )
    trash_document(connection, anna.id)
    with pytest.raises(Conflict):
        update_document_by_coauthor(connection, anna.id, {"summary": "Сестра"}, owner)
    with pytest.raises(Invalid) as error:
        update_document_by_coauthor(connection, vera.id, {"fields": {"wings": "две"}}, owner)
    assert error.value.field == "fields.wings"
    connection.execute(update(drafts).where(drafts.c.id == draft).values(locked=True))
    with pytest.raises(Locked):
        update_document_by_coauthor(connection, vera.id, {"summary": "Сестра"}, owner)


def test_positions_stay_without_gaps(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    names = ["Вера", "Аня", "Олег"]
    created = create_documents(
        connection, draft, [{"kind": "character", "name": n, "role": "main"} for n in names], _owner(connection)
    )
    by_name = {d.name: d for d in created}
    update_document(connection, by_name["Олег"].id, by_name["Олег"].revision, {"position": 0}, _owner(connection))
    trash_document(connection, by_name["Аня"].id)
    characters = [d for d in list_documents(connection, draft) if d.kind == "character" and not d.deleted_at]
    assert [(d.name, d.position) for d in characters] == [("Олег", 0), ("Вера", 1)]
    restore_document(connection, by_name["Аня"].id)
    characters = [d for d in list_documents(connection, draft) if d.kind == "character"]
    assert [(d.name, d.position) for d in characters] == [("Олег", 0), ("Вера", 1), ("Аня", 2)]


def test_screenplay_is_not_trashed(connection: Connection) -> None:
    project, draft, script_id = create_project(connection, _owner(connection), "Маяк")
    with pytest.raises(Conflict):
        trash_document(connection, script_id)


def test_trash_of_the_story(connection: Connection) -> None:
    project, draft, _ = create_project(connection, _owner(connection), "Маяк")
    misha, pier, vera = create_documents(
        connection,
        draft,
        [
            {"kind": "character", "name": "Миша", "role": "episodic", "fields": {"fear": "темнота"}},
            {"kind": "location", "name": "Пристань", "role": "main"},
            {"kind": "character", "name": "Вера", "role": "main"},
        ],
        _owner(connection),
    )
    trash_document(connection, misha.id)
    trashed = {d.name: d for d in list_documents(connection, draft)}["Миша"]
    assert trashed.deleted_at is not None
    with pytest.raises(Conflict):
        delete_document(connection, vera.id)
    trash_document(connection, pier.id)
    empty_trash(connection, draft)
    assert sorted(d.name for d in list_documents(connection, draft)) == ["Вера", "Сценарий"]


# --- access


def test_owner_only(connection: Connection) -> None:
    project, _, _ = create_project(connection, _owner(connection, "a"), "Маяк")
    _owner(connection, "b")
    assert owns_project(connection, "a", project.id)
    assert not owns_project(connection, "b", project.id)
    assert not owns_project(connection, "a", uuid.uuid4())


def test_account_is_needed(connection: Connection) -> None:
    with pytest.raises(AccountNotFound):
        user_id_of(connection, "nobody")


def test_access_source_reads_committed_stories(engine: Engine) -> None:
    class Caller:
        def __init__(self, subject: str) -> None:
            self.user_id = subject

    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        project, _, _ = create_project(connection, _owner(connection, subject), "Маяк")
    try:
        access = ProjectAccess()
        assert access.can_access(Caller(subject), str(project.id))
        assert not access.can_access(Caller("someone-else"), str(project.id))
        assert not access.can_access(Caller(subject), "not-a-uuid")
    finally:
        with engine.begin() as connection:
            connection.execute(delete(projects).where(projects.c.id == project.id))
            owner = user_id_of(connection, subject)
            connection.execute(delete(subscriptions).where(subscriptions.c.user_id == owner))
            connection.execute(delete(user_settings).where(user_settings.c.user_id == owner))
            connection.execute(delete(users).where(users.c.id == owner))


def test_main_registers_the_access_source() -> None:
    main = ast.parse((Path(__file__).resolve().parents[1] / "app" / "main.py").read_text())
    calls = [
        node
        for node in ast.walk(main)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "set_project_access_source"
    ]
    assert len(calls) == 1
    (argument,) = calls[0].args
    assert (
        isinstance(argument, ast.Call) and isinstance(argument.func, ast.Name) and argument.func.id == "ProjectAccess"
    )

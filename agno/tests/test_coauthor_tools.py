"""Tools of the co-author (openspec/specs/api/agents: «Инструменты соавтора», «Предложение правки соавтором»,
«Действия соавтора», «Режим соавтора», «Комментарий соавтором»)."""

import json
import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from agno.run import RunContext
from agno.tools.function import Function

from agents import coauthor_tools as tools
from agents.coauthor_tools import (
    CHANGING_TOOLS,
    COAUTHOR_TOOLS,
    READING_TOOLS,
    STORY_NOT_FOUND,
    comment_on_screenplay,
    create_story_document,
    create_story_note,
    list_story_documents,
    list_story_notes,
    read_chat_file,
    read_screenplay,
    read_story_document,
    read_story_note,
    save_chat_file_to_notes,
    search_story,
    suggest_edit,
    update_story_document,
    update_story_note,
)
from app.auth import run_principal
from core.fields import FIELD_HINTS

SCENE = {"type": "sceneHeading", "attrs": {"uid": "s3"}, "content": [{"type": "text", "text": "НАТ. ОЗЕРО — ДЕНЬ"}]}
ACTION = {"type": "action", "content": [{"type": "text", "text": "Вера молчит."}]}


def _run(subject: str, session_id: str, groups: list[str] | None = None) -> RunContext:
    claims = {"sub": subject, "groups": groups if groups is not None else ["screenwriters"]}
    authority = SimpleNamespace(context=SimpleNamespace(principal_id=subject, claims=claims))
    return RunContext(run_id="r1", session_id=session_id, user_id=subject, authorization=authority)


def _story_with_vera(author: Any) -> tuple[str, str, str]:
    """The project, the draft and the screenplay of a story with Vera and scene s3."""
    story = author.story("Тихая вода")
    project_id = story["project"]["id"]
    author.post(
        f"/api/v1/drafts/{story['draft_id']}/documents",
        json={"kind": "character", "name": "Вера", "role": "main", "fields": {"fear": "Что Аня узнает правду"}},
    )
    text = {"type": "doc", "content": [SCENE, ACTION]}
    assert (
        author.put(f"/api/v1/documents/{story['script_id']}/text", json=text, headers={"If-Match": "1"}).status_code
        == 200
    )
    return project_id, story["draft_id"], story["script_id"]


def test_run_principal() -> None:
    principal = run_principal(_run("s1", "x:1", ["editors"]))
    assert principal.user_id == "s1"
    assert "agents:coauthor:run" in principal.scopes


def test_run_without_caller_is_refused() -> None:
    with pytest.raises(RuntimeError, match="no verified caller"):
        run_principal(RunContext(run_id="r1", session_id="x:1", user_id="s1", authorization=None))


def test_run_of_another_user_is_refused() -> None:
    run = _run("s1", "x:1")
    run.user_id = "s2"
    with pytest.raises(RuntimeError, match="another user"):
        run_principal(run)


def test_read_the_story(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    listed = json.loads(list_story_documents(run))
    vera = next(d for d in listed if d["name"] == "Вера")
    assert json.loads(read_story_document(run, vera["id"]))["fields"] == {"fear": "Что Аня узнает правду"}
    whole = read_screenplay(run)
    assert "Сцена 1, uid s3" in whole and "[action] Вера молчит." in whole
    assert read_screenplay(run, "s3").splitlines()[0] == "Сцена 1, uid s3"
    assert read_screenplay(run, "s9").startswith("Отказ")


def test_search_the_story(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    note = author.post(f"/api/v1/projects/{project_id}/notes", json={"title": "Финал", "body": "Вера молчит до конца."})
    assert note.status_code == 201
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    vera = next(d for d in json.loads(list_story_documents(run)) if d["name"] == "Вера")
    found = search_story(run, "ВЕРА").splitlines()
    assert found[0] == "Найдено по запросу «ВЕРА» (регистр и ё/е не различаются):"
    assert "- Сцена 1, uid s3 (совпадений 1): «Вера» молчит." in found
    assert f"- персонаж «Вера», id {vera['id']}, поле «имя или название» (совпадений 1): «Вера»" in found
    assert f"- «Финал», id {note.json()['id']}, в тексте (совпадений 1): «Вера» молчит до конца." in found
    fear = search_story(run, "правду")
    assert "поле «главный страх»" in fear and "Сцены:" not in fear
    assert search_story(run, "дирижабль") == "Ничего не нашлось по запросу «дирижабль»."
    assert search_story(run, "в") == "Отказ: Запрос слишком короткий: нужно не меньше 2 символов."


def test_foreign_story(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id, draft_id, _ = _story_with_vera(owner)
    run = _run(stranger.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert list_story_documents(run) == STORY_NOT_FOUND
    assert search_story(run, "Вера") == STORY_NOT_FOUND
    assert suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "") == STORY_NOT_FOUND


def test_conversation_without_story(authors: Any) -> None:
    author = authors()
    assert list_story_documents(_run(author.subject, "no-story")).startswith("Отказ")


def test_suggestion(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    run = _run(author.subject, session)
    refused = suggest_edit(run, "s3", "Вода холодная", "Вода тёплая", "")
    assert "Цитата не найдена в сцене" in refused
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []
    answer = suggest_edit(run, "s3", "Вера молчит", "Вера отворачивается", "Действие сильнее")
    assert "ждёт" in answer or "отправлено" in answer
    (suggestion,) = author.get(f"/api/v1/documents/{script_id}/suggestions?status=open").json()
    assert (suggestion["quote"], suggestion["session_id"]) == ("Вера молчит", session)
    assert author.get(f"/api/v1/documents/{script_id}/text").json()["revision"] == 2


def test_chat_file_of_this_conversation(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("заметки.txt", "Вера боится воды".encode())},
        data={"purpose": "chat", "session_id": session},
    ).json()
    assert "Вера боится воды" in read_chat_file(_run(author.subject, session), uploaded["id"])
    other = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert read_chat_file(other, uploaded["id"]).startswith("Отказ")


def _second_draft(author: Any, project_id: str, draft_id: str) -> str:
    created = author.post(f"/api/v1/projects/{project_id}/drafts", json={"name": "Драфт 2", "base_id": draft_id})
    assert created.status_code == 201, created.text
    second: str = created.json()["id"]
    return second


def test_conversation_sees_only_its_draft(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    tree = author.get(f"/api/v1/drafts/{second}/documents").json()
    copy_of_vera = next(d for d in tree if d["name"] == "Вера")
    author.post(f"/api/v1/drafts/{second}/documents", json={"kind": "character", "name": "Нина", "role": "main"})
    first = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert "Нина" not in list_story_documents(first)
    assert read_story_document(first, copy_of_vera["id"]) == "Отказ: документ не найден."


def test_suggestion_goes_to_the_draft_of_the_conversation(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    copy = next(d for d in author.get(f"/api/v1/drafts/{second}/documents").json() if d["kind"] == "script")
    run = _run(author.subject, f"{project_id}:{second}:{uuid.uuid4()}")
    suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "")
    assert len(author.get(f"/api/v1/documents/{copy['id']}/suggestions").json()) == 1
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []


def test_locked_draft_refuses_a_suggestion(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    author.patch(f"/api/v1/drafts/{draft_id}", json={"locked": True})
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert suggest_edit(run, "s3", "Вера молчит", "Вера плачет", "").startswith("Отказ")
    assert author.get(f"/api/v1/documents/{script_id}/suggestions").json() == []


def test_draft_in_the_trash_is_refused(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    assert author.post(f"/api/v1/drafts/{second}/trash").status_code == 200
    run = _run(author.subject, f"{project_id}:{second}:{uuid.uuid4()}")
    assert list_story_documents(run).startswith("Отказ")


def test_old_conversation_is_refused(authors: Any) -> None:
    author = authors()
    project_id, _, _ = _story_with_vera(author)
    assert list_story_documents(_run(author.subject, f"{project_id}:{uuid.uuid4()}")).startswith("Отказ")


def test_draft_of_another_story_is_refused(authors: Any) -> None:
    author = authors()
    project_id, _, _ = _story_with_vera(author)
    _, other_draft, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{other_draft}:{uuid.uuid4()}")
    assert list_story_documents(run) == STORY_NOT_FOUND


# --- actions of the co-author


def _done(answer: str) -> dict[str, Any]:
    assert not answer.startswith("Отказ"), answer
    found: dict[str, Any] = json.loads(answer)
    return found


def test_notes_of_the_story(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    created = _done(create_story_note(run, "Финал", "Вера уходит к воде."))
    assert created["target"]["type"] == "note"
    note_id = created["target"]["id"]
    assert [n["title"] for n in json.loads(list_story_notes(run))] == ["Финал"]
    _done(update_story_note(run, note_id, append="Аня идёт за ней."))
    assert json.loads(read_story_note(run, note_id))["body"] == "Вера уходит к воде.\nАня идёт за ней."
    assert update_story_note(run, note_id, body="Другое", append="Ещё").startswith("Отказ")
    (note,) = author.get(f"/api/v1/projects/{project_id}/notes").json()
    assert note["body"] == "Вера уходит к воде.\nАня идёт за ней."


def test_long_note_is_read_in_parts(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    body = "а" * 20_000 + "б" * 20_000 + "в" * 5_000
    note_id = _done(create_story_note(run, "Эпоха", body))["target"]["id"]

    (listed,) = json.loads(list_story_notes(run))
    assert (listed["length"], listed["file"]) == (45_000, None)
    third = json.loads(read_story_note(run, note_id, part=3))
    assert (third["part"], third["parts"], third["body"]) == (3, 3, "в" * 5_000)
    assert json.loads(read_story_note(run, note_id))["body"] == "а" * 20_000
    assert read_story_note(run, note_id, part=4) == "Отказ: в заметке 3 частей, части 4 нет."
    short = _done(create_story_note(run, "Финал"))["target"]["id"]
    assert json.loads(read_story_note(run, short))["parts"] == 1


def _chat_file(author: Any, project_id: str, session: str, name: str = "Эпоха.txt") -> str:
    uploaded = author.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": (name, "Москва, 1913".encode())},
        data={"purpose": "chat", "session_id": session},
    )
    assert uploaded.status_code == 201, uploaded.text
    file_id: str = uploaded.json()["id"]
    return file_id


def test_chat_file_goes_to_notes(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    file_id = _chat_file(author, project_id, session)
    run = _run(author.subject, session)

    saved = _done(save_chat_file_to_notes(run, file_id))

    assert saved["target"]["type"] == "note"
    (note,) = author.get(f"/api/v1/projects/{project_id}/notes").json()
    assert (note["title"], note["body"], note["file"]["name"]) == ("Эпоха", "Москва, 1913", "Эпоха.txt")
    (listed,) = json.loads(list_story_notes(run))
    assert listed["file"] == "Эпоха.txt"


def test_chat_file_of_another_conversation_is_not_saved(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    file_id = _chat_file(author, project_id, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")

    assert save_chat_file_to_notes(run, file_id) == "Отказ: файл не найден в этой беседе."
    assert save_chat_file_to_notes(run, "not-an-id") == "Отказ: файл не найден в этой беседе."
    assert author.get(f"/api/v1/projects/{project_id}/notes").json() == []


def test_chat_file_without_place(authors: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    session = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    file_id = _chat_file(author, project_id, session)
    monkeypatch.setattr(tools.billing, "storage_limit", lambda user_id, at: 1)

    refused = save_chat_file_to_notes(_run(author.subject, session), file_id)

    assert refused.startswith("Отказ: Место для файлов заметок кончилось")
    assert author.get(f"/api/v1/projects/{project_id}/notes").json() == []


def test_note_of_another_story_is_not_found(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    other_project, other_draft, _ = _story_with_vera(author)
    other = _run(author.subject, f"{other_project}:{other_draft}:{uuid.uuid4()}")
    note_id = _done(create_story_note(other, "Чужая"))["target"]["id"]
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert read_story_note(run, note_id) == "Отказ: заметка не найдена."
    assert update_story_note(run, note_id, append="Вода") == "Отказ: заметка не найдена."
    assert read_story_note(run, "not-an-id") == "Отказ: заметка не найдена."


def test_new_character_and_its_fields(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    created = _done(create_story_document(run, "character", "Пётр", role="secondary", summary="Брат Веры"))
    assert created["target"]["kind"] == "character"
    tree = author.get(f"/api/v1/drafts/{draft_id}/documents").json()
    characters = [d["name"] for d in tree if d["kind"] == "character"]
    assert characters[-1] == "Пётр"
    vera = next(d for d in tree if d["name"] == "Вера")
    _done(update_story_document(run, vera["id"], fields={"fear": "Остаться одной"}))
    assert author.get(f"/api/v1/documents/{vera['id']}").json()["fields"]["fear"] == "Остаться одной"
    versions = author.get(f"/api/v1/documents/{vera['id']}/versions?part=fields").json()
    assert any(v["reason"] == "coauthor" for v in versions)
    refused = update_story_document(run, vera["id"], fields={"wings": "две"})
    assert refused.startswith("Отказ") and "wings" in refused


def test_document_of_another_draft_is_not_changed(authors: Any) -> None:
    author = authors()
    project_id, draft_id, _ = _story_with_vera(author)
    second = _second_draft(author, project_id, draft_id)
    copy = next(d for d in author.get(f"/api/v1/drafts/{second}/documents").json() if d["name"] == "Вера")
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert update_story_document(run, copy["id"], summary="Сестра") == "Отказ: документ не найден."


def test_comment_of_the_coauthor(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert "Цитата не найдена в сцене" in comment_on_screenplay(run, "s3", "Вода холодная", "Холодно")
    created = _done(comment_on_screenplay(run, "s3", "Вера молчит", "Здесь пауза важнее реплики"))
    assert created["target"]["type"] == "comment"
    (thread,) = author.get(f"/api/v1/documents/{script_id}/comments").json()
    assert (thread["id"], thread["scene_uid"], thread["messages"][0]["author_kind"]) == (
        created["target"]["id"],
        "s3",
        "coauthor",
    )
    assert author.get(f"/api/v1/documents/{script_id}/text").json()["revision"] == 2


def test_locked_draft_refuses_every_change(authors: Any) -> None:
    author = authors()
    project_id, draft_id, script_id = _story_with_vera(author)
    vera = next(d for d in author.get(f"/api/v1/drafts/{draft_id}/documents").json() if d["name"] == "Вера")
    author.patch(f"/api/v1/drafts/{draft_id}", json={"locked": True})
    run = _run(author.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert create_story_document(run, "character", "Пётр", role="main").startswith("Отказ")
    assert update_story_document(run, vera["id"], summary="Сестра").startswith("Отказ")
    assert comment_on_screenplay(run, "s3", "Вера молчит", "Пауза").startswith("Отказ")
    names = [d["name"] for d in author.get(f"/api/v1/drafts/{draft_id}/documents").json()]
    assert "Пётр" not in names
    assert author.get(f"/api/v1/documents/{script_id}/comments").json() == []


def test_foreign_story_is_not_changed(authors: Any) -> None:
    owner, stranger = authors(), authors()
    project_id, draft_id, _ = _story_with_vera(owner)
    run = _run(stranger.subject, f"{project_id}:{draft_id}:{uuid.uuid4()}")
    assert create_story_note(run, "Чужая") == STORY_NOT_FOUND
    assert create_story_document(run, "character", "Пётр", role="main") == STORY_NOT_FOUND
    assert owner.get(f"/api/v1/projects/{project_id}/notes").json() == []


def test_no_tool_deletes_trashes_or_decides() -> None:
    names = {tool.__name__ for tool in READING_TOOLS + CHANGING_TOOLS}
    assert not {n for n in names if any(word in n for word in ("delete", "trash", "restore", "decide", "resolve"))}
    assert {tool.__name__ for tool in CHANGING_TOOLS} == {
        "create_story_note",
        "save_chat_file_to_notes",
        "update_story_note",
        "create_story_document",
        "update_story_document",
        "comment_on_screenplay",
    }
    assert tools.suggest_edit in READING_TOOLS and tools.search_story in READING_TOOLS


# --- the pause before every change


def test_every_change_waits_for_an_answer() -> None:
    """Changing tools pause the run in every mode; reading ones and suggestions never do (design, decision 1)."""
    waits = {
        (tool.name if isinstance(tool, Function) else tool.__name__): isinstance(tool, Function)
        and tool.requires_confirmation is True
        for tool in COAUTHOR_TOOLS
    }
    assert {name for name, waiting in waits.items() if waiting} == {tool.__name__ for tool in CHANGING_TOOLS}
    assert waits["suggest_edit"] is False and waits["read_screenplay"] is False and waits["search_story"] is False
    assert len(waits) == len(READING_TOOLS) + len(CHANGING_TOOLS)


def test_document_tools_describe_fields_as_the_core_checks_them() -> None:
    """The schema the model gets: strings for profile fields, the roles as an enum, every field of the kinds named."""
    for tool, nullable, kinds in (
        (create_story_document, False, ("character", "location", "world")),
        (update_story_document, True, ("character", "location", "world", "script")),
    ):
        described = Function.from_callable(tool).to_dict()
        properties = described["parameters"]["properties"]
        values = properties["fields"]["additionalProperties"]
        assert values == ({"anyOf": [{"type": "string"}, {"type": "null"}]} if nullable else {"type": "string"})
        assert properties["role"]["enum"] == ["main", "secondary", "episodic"]
        # The core requires the role of a new character or location and refuses one for a world (core/documents.py).
        assert "у мира роли нет" in properties["role"]["description"]
        if not nullable:
            assert "обязательна" in properties["role"]["description"]
        for kind in kinds:
            for name in FIELD_HINTS[kind]:
                assert f"{name} — {FIELD_HINTS[kind][name]}" in described["description"]
        assert "title_page" not in described["description"]

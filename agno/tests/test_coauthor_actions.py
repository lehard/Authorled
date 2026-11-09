"""The measurement of actions without a model: its set and its checks on hand-made records of calls."""

import json
from pathlib import Path
from typing import Any

import pytest

from evals.coauthor.actions import (
    ACTION_TOOLS,
    ActionRun,
    ActionSetError,
    Card,
    Changes,
    Request,
    check,
    load_set,
    parse_set,
    summarize,
)
from evals.coauthor.records import Call

VASILY = Path(__file__).parent / "fixtures" / "coauthor_actions_vasily.json"


def _row(**own: Any) -> dict[str, Any]:
    """A request of the set; a key given as None is left out."""
    row: dict[str, Any] = {
        "id": "r1",
        "place": "tihaya-voda",
        "message": "Заведи Петра",
        "expect": "create_story_document",
        "kind": "character",
        "fields": ["fear"],
    }
    return {key: value for key, value in (row | own).items() if value is not None}


def test_release_set_loads() -> None:
    requests = load_set()
    assert 55 <= len(requests) <= 70
    assert {r.expect for r in requests} == {*ACTION_TOOLS, "none"}
    assert {r.kind for r in requests if r.expect == "create_story_document"} == {"character", "location", "world"}
    assert any(r.id == "character-vasily" for r in requests)


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"expect": "delete_story_document"}, "r1: tool 'delete_story_document' is not a changing tool"),
        ({"fields": ["appearance"]}, "r1: field 'appearance' is not a text field of character"),
        ({"fields": ["fear|motivation"]}, "r1: field 'motivation'"),
        ({"kind": "script"}, "r1: kind 'script'"),
        ({"place": "moscow"}, "r1: place 'moscow'"),
        ({"target": "Вера"}, "r1: target do not belong"),
        ({"expect": "update_story_document", "target": "Василий", "kind": None}, "no card «Василий»"),
        ({"expect": "update_story_note", "target": "Нет такой", "kind": None, "fields": None}, "no note «Нет такой»"),
        ({"expect": "none", "kind": None}, "r1: fields do not belong"),
        ({"surprise": 1}, "r1: unknown keys surprise"),
        ({"expect": "update_story_document", "target": "Сценарий", "kind": None, "fields": ["show"]}, "field 'show'"),
        ({"expect": "none", "kind": None, "fields": None, "max_words": 35}, "r1: max_words do not belong"),
        ({"max_words": 35}, "r1: max_words do not belong to a request for create_story_document"),
        (
            {
                "expect": "update_story_document",
                "target": "Сценарий",
                "kind": None,
                "fields": ["logline"],
                "max_words": 0,
            },
            "max_words must be a positive whole number",
        ),
    ],
)
def test_set_refused(change: dict[str, Any], reason: str) -> None:
    with pytest.raises(ActionSetError, match=reason):
        parse_set([_row(**change)])


def test_repeated_id_refused() -> None:
    with pytest.raises(ActionSetError, match="r1: the id is repeated"):
        parse_set([_row(), _row()])


def test_update_takes_the_kind_of_the_card() -> None:
    (request,) = parse_set([_row(expect="update_story_document", target="Озеро, мостки", kind=None, fields=["smell"])])
    assert request.kind == "location"


def _card(**own: Any) -> Card:
    return Card(**({"id": "d1", "kind": "character", "name": "Пётр", "role": None, "summary": "", "fields": {}} | own))


def _created(card: Card) -> Changes:
    return Changes(created=(card,))


def _call(result: str, **args: Any) -> Call:
    return Call("create_story_document", {"kind": "character", "name": "Пётр", **args}, False, result)


DONE = '{"done": "Создан документ: персонаж «Пётр»"}'
PETR = Request("r1", "tihaya-voda", "Заведи Петра", "create_story_document", "character", fields=(("fear",),))


def test_production_trace_of_vasily() -> None:
    trace = json.loads(VASILY.read_text(encoding="utf-8"))
    calls = tuple(Call(c["name"], c["args"], False, c["result"]) for c in trace["calls"])
    last = calls[-1].args
    card = _card(name="Василий", role=last["role"], summary=last["summary"], fields=last.get("fields", {}))
    request = Request(
        "character-vasily",
        "tihaya-voda",
        trace["message"],
        "create_story_document",
        "character",
        fields=(("personality",),),
    )
    verdict = check(request, ActionRun(request.id, "done", "Создал.", 1.0, calls, _created(card)))
    assert len(verdict.refusals) == 4
    assert verdict.attempts == 5
    assert verdict.action_ok
    assert verdict.missing == ("personality",)
    assert verdict.summary_dump
    assert not verdict.passed


def test_one_refusal_then_success() -> None:
    calls = (
        _call("Отказ: Поле «speech»: ожидается строка.", fields={"speech": {"value": "…"}}),
        _call(DONE, fields={"fear": "Воды"}),
    )
    verdict = check(PETR, ActionRun("r1", "done", "Готово.", 1.0, calls, _created(_card(fields={"fear": "Воды"}))))
    assert verdict.refusals == ("create_story_document: Отказ: Поле «speech»: ожидается строка.",)
    assert verdict.attempts == 2
    assert verdict.passed


def test_profile_in_the_description() -> None:
    summary = "Брат Веры. " * 40
    run = ActionRun("r1", "done", "Готово.", 1.0, (_call(DONE),), _created(_card(summary=summary)))
    verdict = check(PETR, run)
    assert verdict.missing == ("fear",)
    assert verdict.summary_dump
    assert not verdict.passed


def test_advice_without_action() -> None:
    request = Request("none-1", "tihaya-voda", "Каким мог бы быть брат Веры?", "none")
    reading = Call("list_story_documents", {}, False, "[]")
    verdict = check(request, ActionRun("none-1", "done", "Варианты: …", 1.0, (reading,)))
    assert verdict.action_ok
    assert verdict.passed


def test_change_nobody_asked_for() -> None:
    request = Request("none-1", "tihaya-voda", "Каким мог бы быть брат Веры?", "none")
    call = Call("create_story_note", {"title": "Брат"}, False, '{"done": "Создана заметка «Брат»"}')
    verdict = check(request, ActionRun("none-1", "done", "Записал.", 1.0, (call,), Changes(notes_created=("Брат",))))
    assert not verdict.action_ok
    assert verdict.extra == ("создана заметка «Брат»",)
    assert not verdict.passed


def test_open_draft_must_not_change() -> None:
    changes = Changes(created=(_card(fields={"fear": "Воды"}),), open_draft=("Вера",))
    verdict = check(PETR, ActionRun("r1", "done", "Готово.", 1.0, (_call(DONE),), changes))
    assert verdict.extra == ("изменён открытый драфт: «Вера»",)
    assert not verdict.passed


def test_update_checks_role_and_name_of_the_target() -> None:
    request = Request(
        "u1", "posledniy-parom", "Лиду в главные", "update_story_document", "character", "Лида", role="main"
    )
    call = Call("update_story_document", {"document_id": "d1", "role": "main"}, False, '{"done": "Изменён"}')
    after = _card(name="Лида", role="secondary")
    verdict = check(request, ActionRun("u1", "done", "Готово.", 1.0, (call,), Changes(updated=(("Лида", after),))))
    assert verdict.missing == ("role=main",)


def test_failed_run_is_a_failure() -> None:
    verdict = check(PETR, ActionRun("r1", "error", "", 1.0, error="RuntimeError: paused more than 6 times"))
    assert not verdict.action_ok
    assert not verdict.passed
    summary = summarize([verdict])
    assert summary.errors == 1
    assert summary.failures == ("r1",)


# The logline and the synopsis (openspec/changes/logline-synopsis-generation, design, decision 6).

LOGLINE = Request(
    "logline-write",
    "tihaya-voda",
    "Замени логлайн",
    "update_story_document",
    "script",
    "Сценарий",
    (("logline",),),
    max_words=35,
)


def _script(logline: str) -> Card:
    return _card(name="Сценарий", kind="script", fields={"logline": logline, "synopsis": "Синопсис."})


def _logline_call() -> Call:
    return Call("update_story_document", {"document_id": "d1"}, False, '{"done": "Изменён документ «Сценарий»"}')


def test_script_is_a_target() -> None:
    (request,) = parse_set(
        [_row(expect="update_story_document", target="Сценарий", kind=None, fields=["logline"], max_words=35)]
    )
    assert (request.kind, request.fields, request.max_words) == ("script", (("logline",),), 35)


def test_long_logline_fails() -> None:
    long = " ".join(["слово"] * 48)
    changes = Changes(updated=(("Сценарий", _script(long)),))
    verdict = check(LOGLINE, ActionRun("logline-write", "done", "Записал.", 1.0, (_logline_call(),), changes))
    assert verdict.action_ok and not verdict.missing
    assert verdict.too_long == ("logline: 48 слов, предел 35",)
    assert not verdict.passed
    short = Changes(updated=(("Сценарий", _script("Аня ищет правду о гибели дяди.")),))
    assert check(LOGLINE, ActionRun("logline-write", "done", "Записал.", 1.0, (_logline_call(),), short)).passed


def test_long_note_fails() -> None:
    request = Request("viewer", "tihaya-voda", "Сохрани аннотацию", "create_story_note", max_words=100)
    call = Call("create_story_note", {"title": "Синопсис: для зрителя"}, False, '{"done": "Создана заметка"}')
    changes = Changes(notes_created=("Синопсис: для зрителя",), notes_created_text=(" ".join(["слово"] * 120),))
    verdict = check(request, ActionRun("viewer", "done", "Сохранил.", 1.0, (call,), changes))
    assert verdict.too_long == ("заметка «Синопсис: для зрителя»: 120 слов, предел 100",)

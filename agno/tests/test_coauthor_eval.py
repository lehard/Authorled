"""The co-author measurement without model calls: the sample and the scoring (openspec/specs/coauthor-eval)."""

from decimal import Decimal
from typing import Any

import pytest

from agents.coauthor_tools import CHANGING_TOOLS
from evals.coauthor.compare import CompareError, Entry, Report, compare
from evals.coauthor.demo_set import check_parts, demo_stories, parse_demo_case, parse_demo_part
from evals.coauthor.judge import criteria
from evals.coauthor.records import CHANGING, Call, CaseRun, Expectation, Ref, Usage
from evals.coauthor.sample import SampleError, load_sample, parse_sample
from evals.coauthor.score import (
    ALLOWED,
    Judged,
    Result,
    action_problem,
    foreign_changes,
    missing_mentions,
    noise,
    review_pick,
    summarize,
)
from evals.routing.cases import SECTIONS, WITH_HISTORY, Case, load_parts
from evals.routing.components import DOMAIN_SETS

WIDE = DOMAIN_SETS["wide"]


def _case(case_id: str, expect: tuple[str, ...], section: str = "single") -> Case:
    return Case(id=case_id, section=section, message="…", expect=expect, history=())


def _run(case_id: str, *calls: Call, outcome: str = "answered") -> CaseRun:
    usage = Usage(2, 1000, 0, 100, Decimal("0.1"))
    return CaseRun(case_id, outcome, "ответ", 1.0, calls, usage)


def test_changing_tools_match_the_agent() -> None:
    assert CHANGING == {tool.__name__ for tool in CHANGING_TOOLS} | {"suggest_edit"}
    assert set(ALLOWED) == set(WIDE)
    assert all(tools <= CHANGING for tools in ALLOWED.values())


def test_release_sample_loads() -> None:
    sampled = load_sample()
    assert len(sampled) == 150
    assert {d for s in sampled for d in s.case.expect} == set(WIDE)


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ("unknown", "is not in wide-work.toml"),
        ("holdout", "belongs to the held-out part"),
        ("place", "place 'moon' is not one of"),
        ("repeat", "repeats"),
        ("domain", "has no case of domain"),
    ],
)
def test_sample_refused(change: str, reason: str) -> None:
    parts = load_parts("wide")
    work, holdout = parts["work"], parts["holdout"]
    # One case of every domain and section: a valid sample to break.
    rows: list[dict[str, str]] = []
    covered: set[str] = set()
    sections: set[str] = set()
    for case in work:
        if set(case.expect) - covered or case.section not in sections:
            rows.append({"id": case.id, "place": "tihaya-voda"})
            covered |= set(case.expect)
            sections.add(case.section)
    parse_sample({"case": rows}, work, holdout)
    if change == "unknown":
        rows.append({"id": "no-such-case", "place": "tihaya-voda"})
    elif change == "holdout":
        rows.append({"id": holdout[0].id, "place": "tihaya-voda"})
    elif change == "place":
        rows[0] = {"id": rows[0]["id"], "place": "moon"}
    elif change == "repeat":
        rows.append(rows[0])
    else:
        rows = [r for r in rows if "wide-help" not in next(c for c in work if c.id == r["id"]).expect]
    with pytest.raises(SampleError, match=reason):
        parse_sample({"case": rows}, work, holdout)


def test_foreign_change() -> None:
    craft = _case("a", ("wide-craft",))
    assert foreign_changes(craft, _run("a", Call("update_story_document", {}, True))) == ("update_story_document",)
    notes = _case("b", ("wide-notes",))
    assert foreign_changes(notes, _run("b", Call("create_story_note", {}, True))) == ()
    # Reading is never a foreign change.
    assert foreign_changes(craft, _run("a", Call("read_screenplay", {}, False))) == ()
    # Several domains: the union of what they allow.
    both = _case("c", ("wide-notes", "wide-dialogue"), "multi")
    assert foreign_changes(both, _run("c", Call("suggest_edit", {}, False), Call("create_story_note", {}, True))) == ()


def test_summarize() -> None:
    results = [
        Result(_case("a", ("wide-craft",)), "tihaya-voda", _run("a"), Judged(True, "ok")),
        Result(
            _case("b", ("wide-craft",)),
            "tihaya-voda",
            _run("b", Call("update_story_document", {}, True), outcome="paused"),
            Judged(False, "не просили"),
        ),
        Result(_case("c", ("wide-notes",)), "tihaya-voda", _run("c"), Judged(None, "", error="Судья не вернул оценку")),
        Result(
            _case("d", ("wide-notes",)),
            "tihaya-voda",
            CaseRun("d", "error", "", 0.1, error="BadRequestError: Insufficient Balance"),
            None,
        ),
    ]
    summary = summarize(results)
    assert (summary.cases, summary.run_errors, summary.judge_errors, summary.paused) == (4, 1, 1, 1)
    craft = summary.domains["wide-craft"]
    assert (craft.cases, craft.ran, craft.clean, craft.judged, craft.good) == (2, 2, 1, 2, 1)
    notes = summary.domains["wide-notes"]
    assert (notes.cases, notes.ran, notes.judged) == (2, 1, 0)
    assert [r.case.id for r in summary.failures] == ["b", "c", "d"]


def test_review_pick_is_deterministic() -> None:
    results = [
        Result(_case(f"{domain}-{n}", (domain,)), "tihaya-voda", _run(f"{domain}-{n}"), Judged(True, "ok"))
        for domain in WIDE
        for n in range(4)
    ]
    picked = review_pick(results)
    assert len(picked) == 30
    assert picked == review_pick(list(reversed(results)))
    assert all(sum(domain in r.case.expect for r in picked) <= 3 for domain in WIDE)


# The demo set (design, decisions 10–13).


STORIES = demo_stories()
HISTORY = [{"role": "author", "text": "Привет"}, {"role": "coauthor", "text": "Здравствуйте"}]


def _row(case_id: str, domain: str, section: str = "single", **own: Any) -> dict[str, object]:
    row: dict[str, object] = {
        "id": case_id,
        "section": section,
        "message": "…",
        "expect": [domain],
        "place": "tihaya-voda",
        "action": "none",
    }
    if section in WITH_HISTORY:
        row["history"] = HISTORY
    return row | own


def _part(prefix: str) -> list[dict[str, object]]:
    rows = [_row(f"{prefix}-{domain}", domain) for domain in WIDE]
    return rows + [_row(f"{prefix}-{s}", "wide-craft", s) for s in SECTIONS if s != "single"]


def test_demo_stories_follow_the_open_draft() -> None:
    water, ferry = STORIES["tihaya-voda"], STORIES["posledniy-parom"]
    assert (water.scenes, ferry.scenes) == (7, 6)
    # Нина is in the trash of the first draft: the co-author cannot find her.
    assert not water.has(Ref("character", "Нина")) and water.has(Ref("character", "Вера"))
    assert ferry.has(Ref("document", "Будка паромщика")) and not water.has(Ref("note", "Соседка"))


@pytest.mark.parametrize(
    ("own", "reason"),
    [
        ({"refs": [{"kind": "scene", "name": 11}]}, "has no scene '11'"),
        ({"place": "posledniy-parom", "absent": [{"kind": "character", "name": "Ефим"}]}, "absent character 'Ефим'"),
        ({"action": ["delete_story"]}, "is not a changing tool"),
        ({"action": []}, "action must be"),
        ({"mention": [[]]}, "mention\\[0\\]"),
        ({"refs": [{"kind": "scene", "name": "6"}]}, "named by its number"),
    ],
)
def test_demo_case_refused(own: dict[str, Any], reason: str) -> None:
    with pytest.raises(SampleError, match=reason):
        parse_demo_case("demo-work.toml", 0, _row("x", "wide-scenes", **own), STORIES)


def test_demo_case_loads() -> None:
    item = parse_demo_case(
        "demo-work.toml",
        0,
        _row(
            "x",
            "wide-notes",
            action=["create_story_note"],
            mention=[["Ефим"]],
            refs=[{"kind": "scene", "name": 6}, {"kind": "note", "name": "Что знает Аня"}],
            absent=[{"kind": "character", "name": "Нина"}],
        ),
        STORIES,
    )
    assert item.expected == Expectation(
        ("create_story_note",),
        (("ефим",),),
        (Ref("scene", "6"), Ref("note", "Что знает Аня")),
        (Ref("character", "Нина"),),
    )


def test_demo_parts_refused() -> None:
    work = parse_demo_part("demo-work.toml", {"case": _part("w")}, STORIES, covered=True)
    with pytest.raises(SampleError, match="in both work and holdout"):
        check_parts(
            {"work": work, "holdout": parse_demo_part("demo-holdout.toml", {"case": _part("w")}, STORIES, covered=True)}
        )
    without = [r for r in _part("h") if r["expect"] != ["wide-research"]]
    with pytest.raises(SampleError, match="demo-holdout.toml has no case of domain\\(s\\) wide-research"):
        parse_demo_part("demo-holdout.toml", {"case": without}, STORIES, covered=True)


def test_expected_action_and_facts() -> None:
    note = Expectation(("create_story_note",), (("ефим",), ("сцен 6", "шест")))
    assert action_problem(note, _run("a")) == "нет ожидаемого действия (create_story_note)"
    assert action_problem(note, _run("a", Call("create_story_note", {}, True))) is None
    calm = Expectation(())
    assert action_problem(calm, _run("a", Call("suggest_edit", {}, False))) == "лишнее действие suggest_edit"
    assert missing_mentions(note, "У ЕФИМА в шестой сцене") == ()
    assert missing_mentions(note, "Ефим молчит") == ("сцен 6 / шест",)
    # A good answer without the expected action is not a good case.
    case = _case("a", ("wide-notes",))
    result = Result(case, "tihaya-voda", _run("a"), Judged(True, "ok"), Expectation(("create_story_note",)))
    assert result.verdict is False


def test_noise_of_repeats() -> None:
    case = _case("a", ("wide-craft",))
    first = Result(case, "tihaya-voda", _run("a"), Judged(True, "ok"), Expectation(()), 1)
    second = Result(case, "tihaya-voda", _run("a"), Judged(False, "нет"), Expectation(()), 2)
    unknown = Result(case, "tihaya-voda", _run("a"), Judged(None, "", error="…"), Expectation(()), 3)
    assert noise([first, second]) == ("a",)
    assert noise([first, unknown]) == ()
    summary = summarize([first, second])
    assert (summary.repeats, summary.noise, summary.total.good_cases, summary.total.verdicts) == (2, ("a",), 1, 2)


def test_judge_gets_the_expectation() -> None:
    text = criteria(_case("a", ("wide-characters",)), Expectation((), (("вера",),), (), (Ref("character", "Нина"),)))
    assert "историю менять не нужно" in text and "ответ должен назвать: вера" in text
    assert "в истории нет персонажа «Нина»" in text


def _report(name: str, *entries: tuple[str, bool | None], set_name: str = "demo") -> Report:
    return Report(name, set_name, "work", tuple(Entry(c, ("wide-craft",), "single", v) for c, v in entries))


def test_compare() -> None:
    before = _report("a", ("x", False), ("x", False), ("y", True), ("y", False), ("z", True), ("z", True))
    after = _report("b", ("x", True), ("x", True), ("y", True), ("y", True), ("z", False), ("z", False))
    result = compare(before, after)
    assert (result.became_good, result.became_bad) == (("x",), ("z",))
    craft = next(row for row in result.domains if row.group == "wide-craft")
    # 3/6 → 4/6 over 3 cases is one case of difference, and one case (y) is noisy: noise, not a change.
    assert (craft.before, craft.after, craft.noisy, craft.mark) == ((3, 6), (4, 6), 1, "шум")
    with pytest.raises(CompareError, match="different sets"):
        compare(before, _report("c", ("x", True), set_name="wide"))


def test_release_demo_set_loads() -> None:
    from evals.coauthor.demo_set import load_demo_part

    work, holdout = load_demo_part("work"), load_demo_part("holdout")
    assert (len(work), len(holdout)) == (70, 30)
    assert 15 <= sum(bool(s.expected and s.expected.absent) for s in work + holdout) <= 25


# Checks of the mentor (openspec/changes/coauthor-mentor-checks, design, decision 9).


@pytest.mark.parametrize(
    ("opened", "reason"),
    [
        ({"scene": 9}, "has no scene 9 to open"),
        ({"scene": "6"}, "named by its number"),
        ({"uid": "water-6"}, "must be a table"),
    ],
)
def test_open_refused(opened: dict[str, object], reason: str) -> None:
    with pytest.raises(SampleError, match=reason):
        parse_demo_case("demo-checks.toml", 0, _row("x", "wide-review", open=opened), STORIES)


def test_open_reaches_the_judge() -> None:
    item = parse_demo_case("demo-checks.toml", 0, _row("x", "wide-review", open={"scene": 6}), STORIES)
    assert item.expected == Expectation((), open=6)
    text = criteria(item.case, item.expected)
    assert "выделил сцену 6" in text and "с точной цитатой из выделенной сцены" in text
    assert "выделил сцену" not in criteria(item.case, Expectation(()))


def test_checks_part_is_not_covered() -> None:
    rows = [_row(f"c-{i}", "wide-review", open={"scene": 6}) for i in range(2)]
    assert len(parse_demo_part("demo-checks.toml", {"case": rows}, STORIES, covered=False)) == 2
    with pytest.raises(SampleError, match="has no case of domain"):
        parse_demo_part("demo-checks.toml", {"case": rows}, STORIES, covered=True)


def test_release_checks_part_loads() -> None:
    import re
    from pathlib import Path

    from evals.coauthor.demo_set import load_demo_part

    checks = load_demo_part("checks")
    web = Path(__file__).parents[2] / "web/src/screens/project/chat/checks.ts"
    requests = re.findall(r'request: "([^"]+)"', re.sub(r"\s+", " ", web.read_text(encoding="utf-8")))
    assert [s.case.message for s in checks] == requests and len(requests) == 8
    assert all(s.place == "tihaya-voda" and s.expected == Expectation((), open=6) for s in checks)
    assert all(s.case.expect == ("wide-review",) for s in checks)


def test_context_of_an_opened_scene() -> None:
    import uuid

    from demo.load import read_demo
    from evals.coauthor.context import CONTEXT_DESCRIPTION, chat_context, opened_scene
    from evals.coauthor.user import Place

    demo = read_demo()
    project = next(p for p in demo["projects"] if p["title"] == "Тихая вода")
    draft = next(d for d in demo["drafts"] if d["projectId"] == project["id"])
    text = next(s for s in demo["scripts"] if s["draftId"] == draft["id"])["text"]
    place = Place("Тихая вода", "…", uuid.uuid4(), uuid.uuid4(), draft["name"])
    value = chat_context(place, opened_scene(text, 6))[CONTEXT_DESCRIPTION]
    assert "Открыт документ: Текст сценария.\nСодержимое документа:\n[Акт] Акт первый\n" in value
    assert "\n[Реплика] Мам, ты опять не спишь?\n" in value
    assert value.endswith(
        "\n\nАвтор выделил фрагмент:\nИНТ. ДОМ ВЕРЫ, КУХНЯ — НОЧЬ\nВера не спит и ждёт\n"
        "Свет только над раковиной. ВЕРА моет чашку. Чашка давно чистая. Она всё равно трёт её губкой.\n"
        "Аня (З.К.)\nМам, ты опять не спишь?\nАня приносит слова дяди\n"
        "Входит АНЯ, в куртке, с рюкзаком. Ставит рюкзак на стул.\nВера\nне оборачиваясь\n"
        "Я же просила звонить, когда едешь так поздно.\nАня\n"
        "Я была у дяди Коли. Он сказал, что Миша утонул не случайно.\nВода продолжает течь. Вера закрывает кран."
    )
    assert "Открыт документ: История." in chat_context(place)[CONTEXT_DESCRIPTION]
    with pytest.raises(RuntimeError, match="no scene 9"):
        opened_scene(text, 9)

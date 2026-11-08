"""Scoring of the routing exam (openspec/specs/orchestrator, «Отчёт о качестве выбора», «Отчёт о цене и задержке»)."""

from decimal import Decimal

import pytest

from evals.routing.cases import Case
from evals.routing.components import DOMAIN_SETS, check_skills, tools_of
from evals.routing.score import NO_CHOICE, CaseResult, Usage, cost, percentile, quality, tool_quality
from evals.routing.tools import tool_domains

BASE = DOMAIN_SETS["base"]


def _case(case_id: str, expect: tuple[str, ...], section: str = "single") -> Case:
    return Case(id=case_id, section=section, message="…", expect=expect, history=())


def _usage(calls: int = 3, rub: str = "0.1") -> Usage:
    return Usage(calls, 1000, 200, 100, Decimal(rub))


def _chosen(case: Case, *domains: str, seconds: float = 1.0) -> CaseResult:
    return CaseResult(case, "chosen", domains, seconds, usage=_usage())


RESULTS = [
    _chosen(_case("a", ("domain-documents",)), "domain-documents"),
    _chosen(_case("b", ("domain-structure",)), "domain-craft"),
    CaseResult(_case("c", ("domain-none",)), "no-domain", (), 2.0, usage=_usage(1, "0.02")),
    _chosen(_case("d", ("domain-documents", "domain-structure"), "multi"), "domain-documents"),
    CaseResult(_case("e", ("domain-craft",)), "error", (), 0.5, error="TimeoutError: …"),
]


def test_quality() -> None:
    result = quality(RESULTS, BASE)
    assert (result.scored, result.exact, result.no_domain, result.errors) == (4, 1, 1, 1)
    documents = result.domains["domain-documents"]
    assert (documents.true_positive, documents.false_positive, documents.false_negative) == (2, 0, 0)
    structure = result.domains["domain-structure"]
    assert (structure.true_positive, structure.false_negative) == (0, 2)
    assert structure.recall == 0 and structure.precision is None
    craft = result.domains["domain-craft"]
    assert (craft.false_positive, craft.precision) == (1, 0)
    assert result.domains["domain-none"].false_negative == 1
    assert result.confusion == {
        ("domain-documents", "domain-documents"): 1,
        ("domain-structure", "domain-craft"): 1,
        ("domain-none", NO_CHOICE): 1,
    }
    assert result.multi_found == {"domain-documents": (1, 1), "domain-structure": (0, 1)}
    assert result.sections["single"].cases == 4 and result.sections["single"].exact == 1
    assert result.sections["single"].errors == 1
    assert result.sections["multi"].exact == 0
    assert [r.case.id for r in result.wrong] == ["b", "c", "d"]


def test_unknown_chosen_domain_is_wrong() -> None:
    result = quality([_chosen(_case("a", ("domain-craft",)), "domain-weather")], BASE)
    assert result.exact == 0
    assert result.domains["domain-weather"].false_positive == 1
    assert result.confusion == {("domain-craft", "domain-weather"): 1}


def test_cost() -> None:
    spent = cost(RESULTS)
    assert spent.cases == 4
    assert spent.model_calls == 10
    assert spent.cost_rub == Decimal("0.32")
    assert spent.rub_per_case == Decimal("0.08")
    assert (spent.median_seconds, spent.p95_seconds) == (1.0, 2.0)


def test_cost_without_runs_refused() -> None:
    with pytest.raises(ValueError, match="No case of the run has usage"):
        cost([RESULTS[-1]])


def test_percentile_nearest_rank() -> None:
    assert percentile([5.0, 1.0, 3.0, 2.0, 4.0], 0.5) == 3.0
    assert percentile([float(i) for i in range(1, 21)], 0.95) == 19.0


@pytest.mark.parametrize(
    ("outcome", "chosen", "error"),
    [("chosen", (), None), ("no-domain", ("domain-none",), None), ("error", (), None), ("chosen", ("x",), "e")],
)
def test_inconsistent_result_refused(outcome: str, chosen: tuple[str, ...], error: str | None) -> None:
    with pytest.raises(ValueError):
        CaseResult(_case("a", ("domain-none",)), outcome, chosen, 1.0, error=error)


def _acted(case: Case, chosen: tuple[str, ...], tools: tuple[str, ...]) -> CaseResult:
    return CaseResult(case, "chosen", chosen, 1.0, usage=_usage(), tools=tools)


def test_tool_quality() -> None:
    tools = tools_of("wide")
    results = [
        # Right domain, its tool: clean.
        _acted(_case("a", ("wide-characters",)), ("wide-characters",), ("find_character",)),
        # Line of dialogue, but the skills agent used the text domain's edit tool without loading that skill.
        _acted(_case("b", ("wide-dialogue",)), ("wide-dialogue",), ("suggest_line_edit",)),
        # Expected and chosen, no tool ran.
        _acted(_case("c", ("wide-scenes",)), ("wide-scenes",), ()),
        # domain-none has no tools: never idle.
        _acted(_case("d", ("domain-none",)), ("domain-none",), ()),
        CaseResult(_case("e", ("wide-help",)), "error", (), 0.5, error="TimeoutError: …", tools=("search_help",)),
    ]
    result = tool_quality(results, tools)
    assert (result.calls, result.cases_with_calls) == (2, 2)
    assert [(i.case_id, i.domain, i.tool) for i in result.foreign] == [("b", "wide-text", "suggest_line_edit")]
    assert [(i.case_id, i.domain) for i in result.unloaded] == [("b", "wide-text")]
    assert [(i.case_id, i.domain, i.tool) for i in result.idle] == [
        ("b", "wide-dialogue", None),
        ("c", "wide-scenes", None),
    ]


def test_unknown_tool_refused() -> None:
    with pytest.raises(ValueError, match="not stub tools"):
        tool_quality([_acted(_case("a", ("wide-text",)), ("wide-text",), ("rm_rf",))], tools_of("wide"))


def test_repeated_tool_name_refused() -> None:
    def find_character(name: str) -> str:
        return name

    def read_scene(scene: str) -> str:
        return scene

    with pytest.raises(RuntimeError, match="'find_character' is in both 'wide-characters' and 'wide-text'"):
        tool_domains({"wide-characters": (find_character, read_scene), "wide-text": (find_character, read_scene)})


@pytest.mark.parametrize("set_name", ["base", "wide"])
def test_sets_check(set_name: str) -> None:
    check_skills(set_name)

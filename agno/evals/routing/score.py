"""Scoring of the routing exam: pure functions over (expected, chosen, outcome), no model calls.

openspec/specs/orchestrator, «Отчёт о качестве выбора» and «Отчёт о цене и задержке». Outcomes:
- `chosen` — the orchestrator delegated to (or loaded the skill of) at least one domain;
- `no-domain` — it answered without choosing any, an error distinct from choosing `domain-none`;
- `error` — the run failed; such a case is neither right nor wrong and is only counted.

In a domain set with stub tools `tool_quality` adds what the domains did: a «foreign» tool belongs to a domain that
was not expected, an «idle» domain was expected and chosen but none of its tools ran, an «unloaded» tool ran without
its domain being chosen (the skills agent acting without the domain's instructions).
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal

from evals.routing.cases import SECTIONS, Case

OUTCOMES = ("chosen", "no-domain", "error")
NO_CHOICE = "(не выбран)"


@dataclass(frozen=True)
class Usage:
    model_calls: int
    input_tokens: int
    cache_read_tokens: int
    output_tokens: int
    cost_rub: Decimal


@dataclass(frozen=True)
class CaseResult:
    case: Case
    outcome: str
    chosen: tuple[str, ...]
    seconds: float
    usage: Usage | None = None
    error: str | None = None
    tools: tuple[str, ...] = ()  # stub tools that ran, in call order; a set without tools has none

    def __post_init__(self) -> None:
        if self.outcome not in OUTCOMES:
            raise ValueError(f"Outcome {self.outcome!r} is not one of {', '.join(OUTCOMES)}")
        if (self.outcome == "chosen") != bool(self.chosen):
            raise ValueError(f"Case {self.case.id!r}: outcome {self.outcome!r} does not match chosen {self.chosen}")
        if (self.outcome == "error") != (self.error is not None):
            raise ValueError(f"Case {self.case.id!r}: only an error outcome carries an error")

    @property
    def exact(self) -> bool:
        return self.outcome != "error" and set(self.chosen) == set(self.case.expect)


@dataclass(frozen=True)
class DomainScore:
    true_positive: int
    false_positive: int
    false_negative: int

    @property
    def precision(self) -> float | None:
        chosen = self.true_positive + self.false_positive
        return None if chosen == 0 else self.true_positive / chosen

    @property
    def recall(self) -> float | None:
        expected = self.true_positive + self.false_negative
        return None if expected == 0 else self.true_positive / expected


@dataclass(frozen=True)
class SectionScore:
    cases: int
    exact: int
    errors: int


@dataclass(frozen=True)
class Quality:
    scored: int
    exact: int
    no_domain: int
    errors: int
    domains: dict[str, DomainScore]
    # (expected, chosen) for cases with one expected domain; NO_CHOICE when nothing was chosen.
    confusion: dict[tuple[str, str], int]
    multi_found: dict[str, tuple[int, int]]  # domain -> (found, expected) in cases with several requests
    sections: dict[str, SectionScore]
    wrong: tuple[CaseResult, ...] = field(default_factory=tuple)


def quality(results: list[CaseResult], domains: tuple[str, ...]) -> Quality:
    scored = [r for r in results if r.outcome != "error"]
    counts = {domain: [0, 0, 0] for domain in domains}
    confusion: Counter[tuple[str, str]] = Counter()
    multi: dict[str, list[int]] = {domain: [0, 0] for domain in domains}
    for result in scored:
        expected, chosen = set(result.case.expect), set(result.chosen)
        for domain in expected | chosen:
            score = counts.setdefault(domain, [0, 0, 0])
            if domain in expected and domain in chosen:
                score[0] += 1
            elif domain in chosen:
                score[1] += 1
            else:
                score[2] += 1
        if len(expected) == 1:
            (want,) = expected
            for domain in chosen or {NO_CHOICE}:
                confusion[(want, domain)] += 1
        else:
            for domain in expected:
                multi[domain][1] += 1
                multi[domain][0] += domain in chosen
    sections = {
        section: SectionScore(
            cases=sum(r.case.section == section for r in results),
            exact=sum(r.case.section == section and r.exact for r in results),
            errors=sum(r.case.section == section and r.outcome == "error" for r in results),
        )
        for section in SECTIONS
    }
    return Quality(
        scored=len(scored),
        exact=sum(r.exact for r in scored),
        no_domain=sum(r.outcome == "no-domain" for r in results),
        errors=len(results) - len(scored),
        domains={domain: DomainScore(*values) for domain, values in counts.items()},
        confusion=dict(confusion),
        multi_found={domain: (found, total) for domain, (found, total) in multi.items() if total},
        sections={name: score for name, score in sections.items() if score.cases},
        wrong=tuple(r for r in scored if not r.exact),
    )


@dataclass(frozen=True)
class ToolIssue:
    case_id: str
    section: str
    domain: str
    tool: str | None  # None for an idle domain


@dataclass(frozen=True)
class ToolQuality:
    calls: int
    cases_with_calls: int
    foreign: tuple[ToolIssue, ...]
    idle: tuple[ToolIssue, ...]
    unloaded: tuple[ToolIssue, ...]


def tool_quality(results: list[CaseResult], tool_domains: dict[str, str]) -> ToolQuality:
    """What the chosen domains did with their stub tools, over the cases that ran."""
    with_tools = set(tool_domains.values())
    foreign: list[ToolIssue] = []
    idle: list[ToolIssue] = []
    unloaded: list[ToolIssue] = []
    scored = [r for r in results if r.outcome != "error"]
    for result in scored:
        unknown = [tool for tool in result.tools if tool not in tool_domains]
        if unknown:
            raise ValueError(f"Case {result.case.id!r}: tools {unknown} are not stub tools of the set")
        expected, chosen = set(result.case.expect), set(result.chosen)
        acted = {tool_domains[tool] for tool in result.tools}
        for tool in dict.fromkeys(result.tools):
            domain = tool_domains[tool]
            if domain not in expected:
                foreign.append(ToolIssue(result.case.id, result.case.section, domain, tool))
            if domain not in chosen:
                unloaded.append(ToolIssue(result.case.id, result.case.section, domain, tool))
        for domain in sorted(expected & chosen & with_tools - acted):
            idle.append(ToolIssue(result.case.id, result.case.section, domain, None))
    return ToolQuality(
        calls=sum(len(r.tools) for r in scored),
        cases_with_calls=sum(bool(r.tools) for r in scored),
        foreign=tuple(foreign),
        idle=tuple(idle),
        unloaded=tuple(unloaded),
    )


def percentile(values: list[float], share: float) -> float:
    """Nearest-rank percentile of a non-empty list."""
    if not values:
        raise ValueError("No values for a percentile")
    ordered = sorted(values)
    return ordered[max(0, math.ceil(share * len(ordered)) - 1)]


@dataclass(frozen=True)
class Cost:
    cases: int
    model_calls: int
    input_tokens: int
    cache_read_tokens: int
    output_tokens: int
    cost_rub: Decimal
    median_seconds: float
    p95_seconds: float

    @property
    def calls_per_case(self) -> float:
        return self.model_calls / self.cases

    @property
    def rub_per_case(self) -> Decimal:
        return self.cost_rub / self.cases


def cost(results: list[CaseResult]) -> Cost:
    """Calls, tokens, rubles and latency over the cases that ran; an errored run has no usage."""
    ran = [r for r in results if r.usage is not None]
    if not ran:
        raise ValueError("No case of the run has usage")
    usages = [r.usage for r in ran if r.usage is not None]
    seconds = [r.seconds for r in ran]
    return Cost(
        cases=len(ran),
        model_calls=sum(u.model_calls for u in usages),
        input_tokens=sum(u.input_tokens for u in usages),
        cache_read_tokens=sum(u.cache_read_tokens for u in usages),
        output_tokens=sum(u.output_tokens for u in usages),
        cost_rub=sum((u.cost_rub for u in usages), Decimal(0)),
        median_seconds=percentile(seconds, 0.5),
        p95_seconds=percentile(seconds, 0.95),
    )

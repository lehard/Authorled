"""Scoring of the measurement: pure functions, no model calls (openspec/specs/coauthor-eval).

A changing tool of the co-author is allowed for some domains of the wide set; a case gets a «foreign change» when the
co-author ran or proposed a changing tool allowed for none of its expected domains. Reading tools are recorded and
never an error. A case of the demo set also has its expected action and facts, checked here by code (design,
decision 11); a good case there passes the action, the facts and the judge. Repeats of a case whose verdicts differ
are the noise of a run (decision 12).
"""

from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal

from evals.coauthor.records import CHANGING, CaseRun, Expectation, Usage
from evals.routing.cases import SECTIONS, Case
from evals.routing.components import DOMAIN_SETS

ALLOWED: dict[str, frozenset[str]] = {
    "wide-characters": frozenset({"create_story_document", "update_story_document"}),
    "wide-world": frozenset({"create_story_document", "update_story_document"}),
    "wide-notes": frozenset({"create_story_note", "update_story_note"}),
    "wide-text": frozenset({"suggest_edit"}),
    "wide-dialogue": frozenset({"suggest_edit"}),
    "wide-review": frozenset({"comment_on_screenplay", "suggest_edit"}),
    "wide-structure": frozenset({"update_story_document", "create_story_note"}),
    "wide-scenes": frozenset({"update_story_document"}),
    "wide-craft": frozenset(),
    "wide-help": frozenset(),
    "wide-research": frozenset(),
    "domain-none": frozenset(),
}


@dataclass(frozen=True)
class Judged:
    passed: bool | None  # None: the judge gave no verdict
    reason: str
    usage: Usage | None = None
    error: str | None = None


@dataclass(frozen=True)
class Result:
    case: Case
    place: str
    run: CaseRun
    judged: Judged | None  # None when the co-author's run failed and nothing was judged
    expected: Expectation | None = None  # a case of the demo set
    repeat: int = 1

    @property
    def foreign(self) -> tuple[str, ...]:
        return foreign_changes(self.case, self.run)

    @property
    def action_problem(self) -> str | None:
        return None if self.expected is None else action_problem(self.expected, self.run)

    @property
    def missing(self) -> tuple[str, ...]:
        return () if self.expected is None else missing_mentions(self.expected, self.run.answer)

    @property
    def verdict(self) -> bool | None:
        """The case is good; None when the judge gave no verdict and the case is not already bad."""
        if self.run.outcome == "error" or self.foreign or self.action_problem or self.missing:
            return False
        if self.judged is None or self.judged.passed is None:
            return None
        return self.judged.passed


def foreign_changes(case: Case, run: CaseRun) -> tuple[str, ...]:
    allowed = frozenset().union(*(ALLOWED[domain] for domain in case.expect))
    names = [call.name for call in run.calls if call.name in CHANGING and call.name not in allowed]
    return tuple(dict.fromkeys(names))


def action_problem(expected: Expectation, run: CaseRun) -> str | None:
    """«лишнее действие X» when no change is expected, «нет ожидаемого действия» when none of the expected ran."""
    made = [call.name for call in run.changes]
    if not expected.action:
        return f"лишнее действие {', '.join(dict.fromkeys(made))}" if made else None
    if not set(made) & set(expected.action):
        return f"нет ожидаемого действия ({' или '.join(expected.action)})"
    return None


def missing_mentions(expected: Expectation, answer: str) -> tuple[str, ...]:
    """Groups of stems of which the answer has none, named by their stems; case does not matter."""
    text = answer.lower()
    return tuple(" / ".join(group) for group in expected.mention if not any(stem in text for stem in group))


def noise(results: list[Result]) -> tuple[str, ...]:
    """Ids of cases whose repeats got different verdicts; repeats without a verdict are left out."""
    verdicts: dict[str, set[bool]] = {}
    for result in results:
        if result.verdict is not None:
            verdicts.setdefault(result.case.id, set()).add(result.verdict)
    return tuple(sorted(case_id for case_id, seen in verdicts.items() if len(seen) > 1))


@dataclass(frozen=True)
class Share:
    cases: int = 0
    ran: int = 0  # the co-author's run did not fail
    clean: int = 0  # ran without a foreign change
    judged: int = 0  # the judge gave a verdict
    good: int = 0
    expected: int = 0  # ran cases of the demo set
    action_ok: int = 0
    facts_ok: int = 0
    verdicts: int = 0  # cases with a verdict of the whole case
    good_cases: int = 0


@dataclass(frozen=True)
class Summary:
    cases: int
    run_errors: int
    judge_errors: int
    paused: int
    domains: dict[str, Share]
    sections: dict[str, Share]
    total: Share
    failures: tuple[Result, ...] = field(default_factory=tuple)
    repeats: int = 1
    noise: tuple[str, ...] = ()


def _share(results: list[Result]) -> Share:
    ran = [r for r in results if r.run.outcome != "error"]
    judged = [r for r in ran if r.judged is not None and r.judged.passed is not None]
    expected = [r for r in ran if r.expected is not None]
    decided = [r for r in results if r.verdict is not None]
    return Share(
        cases=len(results),
        ran=len(ran),
        clean=sum(not r.foreign for r in ran),
        judged=len(judged),
        good=sum(bool(r.judged and r.judged.passed) for r in judged),
        expected=len(expected),
        action_ok=sum(r.action_problem is None for r in expected),
        facts_ok=sum(not r.missing for r in expected),
        verdicts=len(decided),
        good_cases=sum(bool(r.verdict) for r in decided),
    )


def summarize(results: list[Result]) -> Summary:
    for result in results:
        unknown = [domain for domain in result.case.expect if domain not in ALLOWED]
        if unknown:
            raise ValueError(f"Case {result.case.id!r}: domains {unknown} are not domains of the wide set")
    failures = tuple(r for r in results if r.verdict is False or (r.judged is not None and r.judged.passed is not True))
    return Summary(
        cases=len(results),
        run_errors=sum(r.run.outcome == "error" for r in results),
        judge_errors=sum(r.judged is not None and r.judged.passed is None for r in results),
        paused=sum(r.run.outcome == "paused" for r in results),
        domains={d: _share([r for r in results if d in r.case.expect]) for d in DOMAIN_SETS["wide"]},
        sections={s: _share([r for r in results if r.case.section == s]) for s in SECTIONS},
        total=_share(results),
        failures=failures,
        repeats=max((r.repeat for r in results), default=1),
        noise=noise(results),
    )


def spent(usages: list[Usage]) -> Usage:
    return Usage(
        model_calls=sum(u.model_calls for u in usages),
        input_tokens=sum(u.input_tokens for u in usages),
        cache_read_tokens=sum(u.cache_read_tokens for u in usages),
        output_tokens=sum(u.output_tokens for u in usages),
        cost_rub=sum((u.cost_rub for u in usages), Decimal(0)),
    )


def review_pick(results: list[Result], per_domain: int = 3, total: int = 30) -> list[Result]:
    """Cases for the owner to read: up to `per_domain` of every domain, by id, until `total`; deterministic."""
    picked: list[Result] = []
    taken: Counter[str] = Counter()
    for domain in DOMAIN_SETS["wide"]:
        for result in sorted((r for r in results if domain in r.case.expect), key=lambda r: r.case.id):
            if len(picked) == total or taken[domain] == per_domain:
                break
            if result in picked or result.run.outcome == "error" or result.repeat != 1:
                continue
            picked.append(result)
            taken.update(result.case.expect)
    return picked

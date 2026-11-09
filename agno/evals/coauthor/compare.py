"""Comparison of two reports of the measurement, without model calls (design, decision 12).

Only reports of one set and part compare. For every domain and section: the share of good cases in each, the
difference and the noise — cases whose repeats disagree in either report; a difference of no more cases than the
noisy ones is marked as noise, not as a change. Cases with one stable verdict in both reports that differ are listed
as became good or became bad.
"""

from dataclasses import dataclass
from typing import Any

from evals.routing.cases import SECTIONS
from evals.routing.components import DOMAIN_SETS


class CompareError(ValueError):
    """Two reports that cannot be compared."""


@dataclass(frozen=True)
class Entry:
    case_id: str
    expect: tuple[str, ...]
    section: str
    verdict: bool | None


@dataclass(frozen=True)
class Report:
    name: str
    set: str
    part: str | None
    entries: tuple[Entry, ...]

    @property
    def noise(self) -> frozenset[str]:
        seen: dict[str, set[bool]] = {}
        for entry in self.entries:
            if entry.verdict is not None:
                seen.setdefault(entry.case_id, set()).add(entry.verdict)
        return frozenset(case_id for case_id, verdicts in seen.items() if len(verdicts) > 1)

    def stable(self) -> dict[str, bool]:
        """Cases with at least one verdict, all the same."""
        seen: dict[str, set[bool]] = {}
        for entry in self.entries:
            if entry.verdict is not None:
                seen.setdefault(entry.case_id, set()).add(entry.verdict)
        return {case_id: next(iter(v)) for case_id, v in seen.items() if len(v) == 1}


@dataclass(frozen=True)
class Row:
    group: str
    cases: int  # distinct cases of the group in either report
    before: tuple[int, int]  # good, with a verdict
    after: tuple[int, int]
    noisy: int

    @property
    def delta(self) -> float | None:
        if not self.before[1] or not self.after[1]:
            return None
        return self.after[0] / self.after[1] - self.before[0] / self.before[1]

    @property
    def mark(self) -> str:
        delta = self.delta
        if delta is None:
            return "нет оценок"
        if delta == 0:
            return "без изменений"
        if abs(delta) * self.cases <= self.noisy:
            return "шум"
        return "лучше" if delta > 0 else "хуже"


@dataclass(frozen=True)
class Comparison:
    before: Report
    after: Report
    total: Row
    domains: tuple[Row, ...]
    sections: tuple[Row, ...]
    became_good: tuple[str, ...]
    became_bad: tuple[str, ...]


def _field(where: str, data: dict[str, Any], key: str) -> Any:
    if key not in data:
        raise CompareError(f"{where}: no field {key!r}")
    return data[key]


def read_report(name: str, data: dict[str, Any]) -> Report:
    meta = _field(name, data, "meta")
    entries: list[Entry] = []
    for index, item in enumerate(_field(name, data, "cases")):
        where = f"{name}: case {index}"
        case = _field(where, item, "case")
        entries.append(
            Entry(
                case_id=_field(where, case, "id"),
                expect=tuple(_field(where, case, "expect")),
                section=_field(where, case, "section"),
                verdict=_field(where, item, "verdict"),
            )
        )
    return Report(name, _field(name, meta, "set"), _field(name, meta, "part"), tuple(entries))


def _row(group: str, before: Report, after: Report, picks: Any) -> Row:
    def counts(report: Report) -> tuple[int, int]:
        decided = [e for e in report.entries if picks(e) and e.verdict is not None]
        return sum(bool(e.verdict) for e in decided), len(decided)

    ids = {e.case_id for r in (before, after) for e in r.entries if picks(e)}
    return Row(group, len(ids), counts(before), counts(after), len(ids & (before.noise | after.noise)))


def compare(before: Report, after: Report) -> Comparison:
    if (before.set, before.part) != (after.set, after.part):
        raise CompareError(
            f"Reports of different sets: {before.name} is {before.set}/{before.part}, "
            f"{after.name} is {after.set}/{after.part}"
        )
    was, now = before.stable(), after.stable()
    common = sorted(set(was) & set(now))
    return Comparison(
        before=before,
        after=after,
        total=_row("всего", before, after, lambda e: True),
        domains=tuple(_row(d, before, after, lambda e, d=d: d in e.expect) for d in DOMAIN_SETS["wide"]),
        sections=tuple(_row(s, before, after, lambda e, s=s: e.section == s) for s in SECTIONS),
        became_good=tuple(c for c in common if not was[c] and now[c]),
        became_bad=tuple(c for c in common if was[c] and not now[c]),
    )


def _share(counts: tuple[int, int]) -> str:
    good, whole = counts
    return "—" if not whole else f"{good / whole:.0%} ({good}/{whole})"


def markdown(comparison: Comparison) -> str:
    before, after = comparison.before, comparison.after
    part = "" if before.part is None else f", часть {before.part}"
    lines = [
        f"# Сравнение замера: набор {before.set}{part}",
        "",
        f"До: `{before.name}`, шумных случаев {len(before.noise)}. После: `{after.name}`, шумных случаев "
        f"{len(after.noise)}.",
        "",
    ]
    for title, rows in (
        ("Всего", (comparison.total,)),
        ("Домены", comparison.domains),
        ("Разделы", comparison.sections),
    ):
        lines += [
            f"## {title}",
            "",
            "| | Случаев | До | После | Разница | Шумных | Итог |",
            "|---|---|---|---|---|---|---|",
        ]
        for row in rows:
            if not row.cases:
                continue
            delta = "—" if row.delta is None else f"{row.delta:+.0%}"
            lines.append(
                f"| {row.group} | {row.cases} | {_share(row.before)} | {_share(row.after)} | {delta} | "
                f"{row.noisy} | {row.mark} |"
            )
        lines.append("")
    lines += ["## Стали хорошими", "", ", ".join(f"`{c}`" for c in comparison.became_good) or "Нет.", ""]
    lines += ["## Стали плохими", "", ", ".join(f"`{c}`" for c in comparison.became_bad) or "Нет.", ""]
    return "\n".join(lines)

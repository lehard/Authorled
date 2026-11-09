"""Judging the cases of one domain of a report again, from the saved answers (openspec/specs/coauthor-eval,
«Повторная оценка судьёй»; openspec/changes/coauthor-answer-rules, design, decision 7).

The report keeps every case's answer, calls and the judge's verdict; the cases expecting the domain are judged
again with the current service help, the others are carried over unchanged. The co-author is not run.
"""

import asyncio
from decimal import Decimal
from typing import Any

from core.plans import ModelPrice
from evals.coauthor.records import Call, CaseRun, Expectation, Ref, Usage
from evals.coauthor.score import Judged, Result
from evals.coauthor.user import Place
from evals.routing.cases import Case, Turn
from evals.routing.components import DOMAIN_SETS


class RejudgeError(ValueError):
    """A report or a domain that cannot be judged again."""


def _field(where: str, data: dict[str, Any], key: str) -> Any:
    if key not in data:
        raise RejudgeError(f"{where}: no field {key!r}")
    return data[key]


def _usage(data: dict[str, Any] | None) -> Usage | None:
    if data is None:
        return None
    return Usage(
        model_calls=data["model_calls"],
        input_tokens=data["input_tokens"],
        cache_read_tokens=data["cache_read_tokens"],
        output_tokens=data["output_tokens"],
        cost_rub=Decimal(str(data["cost_rub"])),
    )


def _refs(items: list[dict[str, Any]]) -> tuple[Ref, ...]:
    return tuple(Ref(item["kind"], item["name"]) for item in items)


def result_of(where: str, item: dict[str, Any]) -> Result:
    """One case of a report as the scoring sees it."""
    case_data = _field(where, item, "case")
    run_data = _field(where, item, "run")
    case = Case(
        id=case_data["id"],
        section=case_data["section"],
        message=case_data["message"],
        expect=tuple(case_data["expect"]),
        history=tuple(Turn(t["role"], t["text"]) for t in case_data["history"]),
    )
    run = CaseRun(
        case_id=run_data["case_id"],
        outcome=run_data["outcome"],
        answer=run_data["answer"],
        seconds=run_data["seconds"],
        calls=tuple(Call(c["name"], c["args"], c["paused"], c["result"]) for c in run_data["calls"]),
        usage=_usage(run_data["usage"]),
        error=run_data["error"],
    )
    expected_data = _field(where, item, "expected")
    expected = (
        None
        if expected_data is None
        else Expectation(
            action=tuple(expected_data["action"]),
            mention=tuple(tuple(group) for group in expected_data["mention"]),
            refs=_refs(expected_data["refs"]),
            absent=_refs(expected_data["absent"]),
        )
    )
    judged_data = _field(where, item, "judged")
    judged = (
        None
        if judged_data is None
        else Judged(judged_data["passed"], judged_data["reason"], _usage(judged_data["usage"]), judged_data["error"])
    )
    return Result(case, _field(where, item, "place"), run, judged, expected, _field(where, item, "repeat"))


def read_results(name: str, data: dict[str, Any]) -> tuple[dict[str, Any], list[Result]]:
    meta = _field(name, data, "meta")
    for key in ("set", "part", "repeat"):
        _field(f"{name}: meta", meta, key)
    if meta["part"] == "checks":
        # Its context is a scene of the open screenplay, which the report does not keep; run the part again instead.
        raise RejudgeError(f"{name}: the checks part is not judged again; run it again")
    cases = _field(name, data, "cases")
    return meta, [result_of(f"{name}: case {index}", item) for index, item in enumerate(cases)]


def check_domain(domain: str) -> None:
    if domain not in DOMAIN_SETS["wide"]:
        raise RejudgeError(f"Domain {domain!r} is not one of the wide set: {', '.join(DOMAIN_SETS['wide'])}")


def to_rejudge(results: list[Result], domain: str) -> list[int]:
    """Indexes of the cases to judge again: the domain is expected and the co-author's run did not fail."""
    check_domain(domain)
    return [i for i, r in enumerate(results) if domain in r.case.expect and r.run.outcome != "error"]


async def rejudge(
    results: list[Result],
    domain: str,
    where: dict[str, Place],
    price: ModelPrice,
    help_text: str | None,
    concurrency: int,
) -> list[Result]:
    # Imported here: the judge's model is built from the .env the command loaded.
    from evals.coauthor.judge import judge
    from evals.coauthor.run import CONTEXT_DESCRIPTION, chat_context

    picked = to_rejudge(results, domain)
    gate = asyncio.Semaphore(concurrency)

    async def one(index: int) -> tuple[int, Judged]:
        result = results[index]
        async with gate:
            context = chat_context(where[result.place])[CONTEXT_DESCRIPTION]
            judged = await judge(result.case, result.run, context, price, result.expected, help_text)
            print(f"{result.case.id} #{result.repeat}: judged again", flush=True)
            return index, judged

    redone = dict(await asyncio.gather(*(one(i) for i in picked)))
    return [
        Result(r.case, r.place, r.run, redone[i], r.expected, r.repeat) if i in redone else r
        for i, r in enumerate(results)
    ]

"""python -m evals.coauthor setup | run | compare: the quality measurement of the current co-author.

openspec/specs/coauthor-eval, README.md here. `setup` creates the user of the measurement with its demo stories.
`run --set wide|demo [--part work|holdout|checks|docs] (--all | --sample N) [--repeat K]` checks the set, the user and
the prices before the first model call, then runs every case K times through the real co-author (two at a time) and has
the judge rate it. The report goes to tmp/coauthor-eval/<UTC time>.json and .md, the cases for the owner to
<UTC time>-review.md; the log holds only case ids. `compare <before.json> <after.json>` compares two reports of one
set and part without model calls. `rejudge <report.json> --domain D` judges the cases of domain D again from the saved
answers, with the current service help, and writes a new report.

The measurement of actions (actions.py): `actions-setup` creates its own user with the demo stories; `actions-run
(--all | --sample N)` checks the set, the user and the price, then runs every request on a fresh copy of the open
draft, confirming every action, and checks the result by code. The report goes to tmp/coauthor-actions/.
"""

import argparse
import asyncio
import json
import subprocess
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any

from dotenv import load_dotenv

from app.paths import REPO_ROOT
from evals.coauthor.compare import compare, markdown, read_report
from evals.routing.score import percentile

if TYPE_CHECKING:
    from evals.coauthor.actions import ActionRun
    from evals.coauthor.records import Usage
    from evals.coauthor.sample import Sampled
    from evals.coauthor.score import Result, Share, Summary

SETS = ("wide", "demo")
CONCURRENCY = 2
REPORT_DIR = REPO_ROOT / "tmp" / "coauthor-eval"
ACTIONS_DIR = REPO_ROOT / "tmp" / "coauthor-actions"
COAUTHOR_MODEL = "deepseek-fast"


def _arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m evals.coauthor", description="Quality measurement of the co-author."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("setup", help="create the user of the measurement and its demo stories")
    run = commands.add_parser("run", help="run a set through the co-author and the judge (spends model calls)")
    run.add_argument("--set", required=True, choices=SETS, dest="set_name", help="wide: the sample; demo: own cases")
    run.add_argument(
        "--part", choices=("work", "holdout", "checks", "docs"), help="the part of the demo set (required for demo)"
    )
    which = run.add_mutually_exclusive_group(required=True)
    which.add_argument("--all", action="store_true", help="every case of the set")
    which.add_argument("--sample", type=int, help="only the first N cases of the set")
    run.add_argument("--repeat", type=int, default=1, help="run every case K times (the noise of the run)")
    again = commands.add_parser("rejudge", help="judge the cases of one domain of a report again (spends judge calls)")
    again.add_argument("report", type=Path)
    again.add_argument("--domain", required=True, help="a domain of the wide set, e.g. wide-help")
    pair = commands.add_parser("compare", help="compare two reports of one set and part (no model calls)")
    pair.add_argument("before", type=Path)
    pair.add_argument("after", type=Path)
    commands.add_parser("actions-setup", help="create the user of the measurement of actions and its demo stories")
    actions = commands.add_parser(
        "actions-run", help="run the requests of actions.toml, confirming every action (spends model calls)"
    )
    size = actions.add_mutually_exclusive_group(required=True)
    size.add_argument("--all", action="store_true", help="every request of the set")
    size.add_argument("--sample", type=int, help="only the first N requests of the set")
    arguments = parser.parse_args(argv)
    if arguments.command == "actions-run" and arguments.sample is not None and arguments.sample < 1:
        parser.error("--sample must be at least 1")
    if arguments.command == "run":
        if arguments.sample is not None and arguments.sample < 1:
            parser.error("--sample must be at least 1")
        if arguments.repeat < 1:
            parser.error("--repeat must be at least 1")
        if arguments.set_name == "demo" and arguments.part is None:
            parser.error("--set demo needs --part work, --part holdout, --part checks or --part docs")
        if arguments.set_name == "wide" and arguments.part is not None:
            parser.error("--part belongs to --set demo; the wide set is one sample")
    return arguments


def _pct(part: int, whole: int) -> str:
    return "—" if whole == 0 else f"{part / whole:.0%} ({part}/{whole})"


def _row(name: str, share: Share, demo: bool) -> str:
    cells = [name, str(share.cases), _pct(share.clean, share.ran), _pct(share.good, share.judged)]
    if demo:
        cells += [
            _pct(share.action_ok, share.expected),
            _pct(share.facts_ok, share.expected),
            _pct(share.good_cases, share.verdicts),
        ]
    return "| " + " | ".join(cells) + " |"


def _markdown(meta: dict[str, Any], summary: Summary, coauthor: Usage, judge: Usage) -> str:
    demo = meta["set"] == "demo"
    where = f"набор {meta['set']}" + (f", часть {meta['part']}" if meta["part"] else "")
    head = ["Случаев", "Без чужого изменения", "Хороший ответ"]
    if demo:
        head += ["Верное действие", "Верный факт", "Хороший случай"]
    total = f"Без чужого изменения: {_pct(summary.total.clean, summary.total.ran)}. Хороший ответ по судье: " + _pct(
        summary.total.good, summary.total.judged
    )
    if demo:
        total += f". Хороший случай: {_pct(summary.total.good_cases, summary.total.verdicts)}"
    lines = [
        f"# Замер соавтора: {where}, {meta['cases']} случаев × {meta['repeat']}",
        "",
        f"Начало {meta['started']}. Ошибок запуска {summary.run_errors}, ошибок судьи {summary.judge_errors}, "
        f"предложено действий (отклонены замером) {summary.paused}. Строки таблиц — все повторы вместе.",
        "",
        f"**{total}.**",
        "",
    ]
    if meta["repeat"] > 1:
        noisy = ", ".join(f"`{c}`" for c in summary.noise) or "нет"
        lines += [f"Шум (оценки повторов расходятся): {len(summary.noise)} случаев — {noisy}.", ""]
    for title, first, shares in (
        ("Домены", "Домен", summary.domains),
        ("Разделы", "Раздел", summary.sections),
    ):
        lines += [f"## {title}", "", "| " + " | ".join([first, *head]) + " |", "|" + "---|" * (len(head) + 1)]
        lines += [_row(name, share, demo) for name, share in shares.items() if share.cases]
        lines.append("")
    lines += ["## Цена и задержка", ""]
    for name, usage in (("Соавтор", coauthor), ("Судья", judge)):
        lines.append(
            f"- {name}: вызовов модели {usage.model_calls}, вход {usage.input_tokens} (из кэша "
            f"{usage.cache_read_tokens}), выход {usage.output_tokens}, {usage.cost_rub:.2f} ₽."
        )
    if meta["median_seconds"] is None:
        lines.append("- Задержки нет: ни один запуск соавтора не завершился.")
    else:
        lines.append(
            f"- Задержка соавтора: медиана {meta['median_seconds']:.1f} с, 95-й процентиль {meta['p95_seconds']:.1f} с."
        )
    lines += ["", "## Провалы", ""]
    if meta["part"] == "holdout":
        # Fixes are tuned on the work part; failures of the held-out part are not read (design, decision 13).
        lines.append(f"Отложенная часть: провалов {len(summary.failures)}, тексты не выводятся (design, решение 13).")
        return "\n".join(lines) + "\n"
    for result in summary.failures:
        lines += _case_lines(result)
    if not summary.failures:
        lines.append("Нет.")
    return "\n".join(lines) + "\n"


def _case_lines(result: Result) -> list[str]:
    case, run, judged = result.case, result.run, result.judged
    again = f"; повтор {result.repeat}" if result.repeat > 1 else ""
    lines = [f"### `{case.id}` ({case.section}; {', '.join(case.expect)}; {result.place}{again})", ""]
    for turn in case.history:
        lines.append(f"> {'Автор' if turn.role == 'author' else 'Соавтор'}: {turn.text}")
    lines += [f"**Автор:** {case.message}", ""]
    if run.outcome == "error":
        lines += [f"Ошибка запуска: {run.error}", ""]
        return lines
    if run.outcome == "paused":
        lines.append("Соавтор предложил действие, замер его отклонил.")
    lines.append(f"**Соавтор:** {run.answer}")
    for call in run.calls:
        waits = " (предложено, отклонено)" if call.paused else ""
        lines.append(f"- `{call.name}`{waits}: {json.dumps(call.args, ensure_ascii=False)[:300]}")
    if result.foreign:
        lines.append(f"Чужое изменение: {', '.join(result.foreign)}.")
    if result.action_problem:
        lines.append(f"Действие: {result.action_problem}.")
    if result.missing:
        lines.append(f"Нет обязательного факта: {'; '.join(result.missing)}.")
    if judged is not None:
        verdict = (
            "ошибка судьи: " + (judged.error or "")
            if judged.passed is None
            else ("хорошо" if judged.passed else "плохо")
        )
        lines.append(f"Судья: {verdict}. {judged.reason}")
    return [*lines, ""]


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Not serializable: {type(value).__name__}")


async def _run(arguments: argparse.Namespace) -> int:
    # Imported after .env is loaded: the co-author builds its model and checks its prices on import.
    from app.auth import set_project_access_source
    from billing import prices
    from core.projects import ProjectAccess
    from evals.coauthor.context import CONTEXT_DESCRIPTION, chat_context, open_doc, open_scene
    from evals.coauthor.demo_set import load_demo_part
    from evals.coauthor.judge import JUDGE_MODEL, judge, prompt_service_help
    from evals.coauthor.run import run_case
    from evals.coauthor.sample import load_sample
    from evals.coauthor.score import Result
    from evals.coauthor.user import QUALITY, places

    # Everything is checked before the first model call (spec «Прогон замера»).
    sampled = load_sample() if arguments.set_name == "wide" else load_demo_part(arguments.part)
    if arguments.sample is not None:
        sampled = sampled[: arguments.sample]
    where = places(QUALITY)
    # The chat's context of every case, read from the core before the first model call: a check of the mentor
    # opens the screenplay of its draft and selects a scene (spec «Случай с открытым текстом сценария»), a task of a
    # document opens the logline or the synopsis (spec «Случай с открытым документом»).
    contexts = {}
    for item in sampled:
        place = where[item.place]
        expected = item.expected
        if expected is not None and expected.open is not None:
            contexts[item.case.id] = chat_context(place, open_scene(place, expected.open))
        elif expected is not None and expected.doc is not None:
            contexts[item.case.id] = chat_context(place, open_doc(place, expected.doc))
        else:
            contexts[item.case.id] = chat_context(place)
    coauthor_price, judge_price = prices().get(COAUTHOR_MODEL), prices().get(JUDGE_MODEL)
    # What the co-author knows about the service in this run; the judge sees the same (design, decision 6).
    help_text = prompt_service_help()
    # The co-author's tools ask the core who may open a story, as in the API (app/main.py).
    set_project_access_source(ProjectAccess())

    started = datetime.now(UTC)
    gate = asyncio.Semaphore(CONCURRENCY)

    async def one(item: Sampled, repeat: int) -> Result:
        async with gate:
            run = await run_case(item.case, where[item.place], contexts[item.case.id], COAUTHOR_MODEL, coauthor_price)
            context = contexts[item.case.id][CONTEXT_DESCRIPTION]
            judged = (
                None
                if run.outcome == "error"
                else await judge(item.case, run, context, judge_price, item.expected, help_text)
            )
            print(f"{item.case.id} #{repeat}: {run.outcome}{'' if judged is None else ', judged'}", flush=True)
            return Result(item.case, item.place, run, judged, item.expected, repeat)

    jobs = [one(item, repeat) for repeat in range(1, arguments.repeat + 1) for item in sampled]
    results = list(await asyncio.gather(*jobs))
    seconds = [r.run.seconds for r in results if r.run.outcome != "error"]
    meta = {
        "set": arguments.set_name,
        "part": arguments.part,
        "repeat": arguments.repeat,
        "cases": len(sampled),
        "sample": arguments.sample,
        "started": started.isoformat(timespec="seconds"),
        "coauthor_model": COAUTHOR_MODEL,
        "judge_model": JUDGE_MODEL,
        "service_help": help_text,
        # No case ran: no latency, and the report says so (spec «Сбой соавтора в одном случае»).
        "median_seconds": percentile(seconds, 0.5) if seconds else None,
        "p95_seconds": percentile(seconds, 0.95) if seconds else None,
    }
    _write_report(meta, results, started)
    return 0


def _write_report(meta: dict[str, Any], results: list[Result], started: datetime) -> None:
    """The report of a run or a re-judging: JSON, the summary and, except for the held-out part, the owner's file."""
    from evals.coauthor.score import review_pick, spent, summarize

    summary = summarize(results)
    coauthor = spent([r.run.usage for r in results if r.run.usage is not None])
    judge_usage = spent([r.judged.usage for r in results if r.judged is not None and r.judged.usage is not None])
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"{started:%Y%m%dT%H%M%SZ}"
    report = {
        "meta": meta,
        "summary": asdict(summary) | {"failures": [r.case.id for r in summary.failures]},
        "coauthor": asdict(coauthor),
        "judge": asdict(judge_usage),
        "cases": [
            {
                "case": asdict(r.case),
                "place": r.place,
                "run": asdict(r.run),
                "repeat": r.repeat,
                "expected": None if r.expected is None else asdict(r.expected),
                "foreign": r.foreign,
                "action_problem": r.action_problem,
                "missing": r.missing,
                "judged": None if r.judged is None else asdict(r.judged),
                "verdict": r.verdict,
            }
            for r in results
        ],
    }
    (REPORT_DIR / f"{stem}.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8"
    )
    text = _markdown(meta, summary, coauthor, judge_usage)
    (REPORT_DIR / f"{stem}.md").write_text(text, encoding="utf-8")
    files = f"{stem}.json and {stem}.md"
    if meta["part"] != "holdout":
        review = ["# Замер соавтора: ответы для чтения владельцем", ""]
        for result in review_pick(results):
            review += _case_lines(result)
        (REPORT_DIR / f"{stem}-review.md").write_text("\n".join(review) + "\n", encoding="utf-8")
        files = f"{stem}.json, {stem}.md and {stem}-review.md"
    print(text)
    print(f"Report: tmp/coauthor-eval/{files}")


async def _rejudge(arguments: argparse.Namespace) -> int:
    # Imported after .env is loaded, as in _run.
    from billing import prices
    from evals.coauthor.judge import JUDGE_MODEL, prompt_service_help
    from evals.coauthor.rejudge import check_domain, read_results, rejudge
    from evals.coauthor.user import QUALITY, places

    # Everything is checked before the first model call (spec «Повторная оценка судьёй»).
    check_domain(arguments.domain)
    try:
        data = json.loads(arguments.report.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"{arguments.report}: {error}") from error
    meta, results = read_results(arguments.report.stem, data)
    where = places(QUALITY)
    price = prices().get(JUDGE_MODEL)
    help_text = prompt_service_help()
    started = datetime.now(UTC)
    redone = await rejudge(results, arguments.domain, where, price, help_text, CONCURRENCY)
    meta = meta | {
        "started": started.isoformat(timespec="seconds"),
        "rejudged_from": arguments.report.stem,
        "rejudged_domain": arguments.domain,
        "service_help": help_text,
    }
    _write_report(meta, redone, started)
    return 0


def _compare(arguments: argparse.Namespace) -> int:
    reports = []
    for path in (arguments.before, arguments.after):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise SystemExit(f"{path}: {error}") from error
        reports.append(read_report(path.stem, data))
    text = markdown(compare(*reports))
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORT_DIR / f"compare-{reports[0].name}-{reports[1].name}.md"
    out.write_text(text, encoding="utf-8")
    print(text)
    print(f"Comparison: {out.relative_to(REPO_ROOT)}")
    return 0


def _commit() -> str:
    """The code a report was made on: the commit and whether the working tree had changes."""
    head = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", "agno"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()
    return f"{head} + незакоммиченные правки в agno/" if dirty else head


async def _actions_run(arguments: argparse.Namespace) -> int:
    # Imported after .env is loaded: the co-author builds its model and checks its prices on import.
    from app.auth import set_project_access_source
    from billing import prices
    from core.engine import get_engine
    from core.projects import ProjectAccess, user_id_of
    from evals.coauthor.actions import check, load_set, markdown, summarize
    from evals.coauthor.actions_run import run_request
    from evals.coauthor.demo_notes import demo_notes, restore_notes
    from evals.coauthor.score import spent
    from evals.coauthor.user import ACTIONS, places

    # Everything is checked before the first model call (spec «Набор просьб замера действий»).
    requests = load_set()
    if arguments.sample is not None:
        requests = requests[: arguments.sample]
    where = places(ACTIONS)
    with get_engine().begin() as connection:
        owner = user_id_of(connection, ACTIONS.subject)
        # Notes that cannot be matched with the demo stop the run before any model call (spec «Заметки истории
        # перед просьбой»); every request restores them again.
        for place in where.values():
            restore_notes(connection, place.project_id, demo_notes(place.title), owner)
    price = prices().get(COAUTHOR_MODEL)
    set_project_access_source(ProjectAccess())
    commit = _commit()

    started = datetime.now(UTC)
    clock = time.monotonic()

    # One lane per story, one request at a time in it: the notes of a story are shared by its drafts, so two
    # requests of one story at once would see each other's notes.
    async def lane(place: str) -> list[ActionRun]:
        done = []
        for request in (r for r in requests if r.place == place):
            run = await run_request(request, where[place], owner, ACTIONS, COAUTHOR_MODEL, price)
            print(f"{request.id}: {run.outcome}", flush=True)
            done.append(run)
        return done

    lanes = await asyncio.gather(*(lane(place) for place in where))
    runs = {run.request_id: run for done in lanes for run in done}
    verdicts = [check(request, runs[request.id]) for request in requests]
    summary = summarize(verdicts)
    usage = spent([v.run.usage for v in verdicts if v.run.usage is not None])
    seconds = [v.run.seconds for v in verdicts if v.run.outcome == "done"]
    meta = {
        "requests": len(requests),
        "sample": arguments.sample,
        "started": started.isoformat(timespec="seconds"),
        "commit": commit,
        "model": COAUTHOR_MODEL,
        "seconds": time.monotonic() - clock,
        "median_seconds": percentile(seconds, 0.5) if seconds else None,
        "cost_per_request": f"{usage.cost_rub / len(requests):.2f}",
    }
    ACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"{started:%Y%m%dT%H%M%SZ}"
    report = {
        "meta": meta,
        "summary": asdict(summary),
        "usage": asdict(usage),
        "requests": [
            {
                "request": asdict(v.request),
                "run": asdict(v.run),
                "refusals": v.refusals,
                "attempts": v.attempts,
                "action_ok": v.action_ok,
                "missing": v.missing,
                "summary_dump": v.summary_dump,
                "extra": v.extra,
                "passed": v.passed,
            }
            for v in verdicts
        ],
    }
    (ACTIONS_DIR / f"{stem}.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8"
    )
    text = markdown(meta, summary, verdicts, usage)
    (ACTIONS_DIR / f"{stem}.md").write_text(text, encoding="utf-8")
    print(text)
    print(f"Report: tmp/coauthor-actions/{stem}.json and {stem}.md")
    return 0


def main(argv: list[str]) -> int:
    load_dotenv(REPO_ROOT / ".env")
    arguments = _arguments(argv)
    if arguments.command == "setup":
        from evals.coauthor.user import QUALITY, setup

        stories = setup(QUALITY)
        print(f"Пользователь замера готов: {stories} демо-истории.")
        return 0
    if arguments.command == "compare":
        return _compare(arguments)
    if arguments.command == "rejudge":
        return asyncio.run(_rejudge(arguments))
    if arguments.command == "actions-setup":
        from demo.load import DemoExists
        from evals.coauthor.user import ACTIONS, setup

        try:
            stories = setup(ACTIONS)
        except DemoExists as error:
            raise SystemExit(f"Пользователь замера действий уже есть. {error}") from error
        print(f"Пользователь замера действий готов: {stories} демо-истории.")
        return 0
    if arguments.command == "actions-run":
        return asyncio.run(_actions_run(arguments))
    return asyncio.run(_run(arguments))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

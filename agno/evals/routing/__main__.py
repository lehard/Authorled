"""python -m evals.routing --domains base|wide --split work|holdout --variant team|team-route|skills --model <alias>
[--sample N].

The routing exam (openspec/specs/orchestrator, README.md here). Before the first model call it checks the skills,
the cases and the price of the model; then every case is a fresh run without a shared session, four at a time.
The report goes to tmp/routing/<UTC time>-<domains>-<split>-<variant>-<model>.json and .md; the log holds only
case ids. In a set with stub tools the report adds what the domains did with them (score.tool_quality).
"""

import argparse
import asyncio
import json
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from agno.run.base import RunStatus
from dotenv import load_dotenv

from app.paths import REPO_ROOT
from core.plans import ModelPrice, prices
from evals.routing.cases import SPLITS, Case, load_split
from evals.routing.components import (
    DOMAIN_SETS,
    MODELS,
    VARIANTS,
    build,
    check_skills,
    chosen_domains,
    domain_set,
    history_session,
    model_runs,
    stub_tool_calls,
    tools_of,
)
from evals.routing.score import (
    NO_CHOICE,
    CaseResult,
    Cost,
    Quality,
    ToolIssue,
    ToolQuality,
    Usage,
    cost,
    quality,
    tool_quality,
)

CONCURRENCY = 4
REPORT_DIR = REPO_ROOT / "tmp" / "routing"


def _arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m evals.routing", description="Routing exam of the orchestrator.")
    parser.add_argument("--domains", required=True, choices=tuple(DOMAIN_SETS), help="domain set of the exam")
    parser.add_argument("--split", required=True, choices=SPLITS, help="part of the cases to run")
    parser.add_argument("--variant", required=True, choices=VARIANTS, help="orchestrator variant")
    parser.add_argument("--model", required=True, choices=tuple(MODELS), help="proxy alias of every component's model")
    parser.add_argument("--sample", type=int, help="run only the first N cases of the part")
    arguments = parser.parse_args(argv)
    if arguments.sample is not None and arguments.sample < 1:
        parser.error("--sample must be at least 1")
    return arguments


async def _run_case(
    case: Case,
    variant: str,
    model: str,
    set_name: str,
    tools: dict[str, str],
    price: ModelPrice,
    gate: asyncio.Semaphore,
) -> tuple[CaseResult, Any]:
    async with gate:
        session_id: str | None = None
        if case.history:
            turns = [(a.text, c.text) for a, c in zip(case.history[::2], case.history[1::2], strict=True)]
            db, session_id = history_session(variant, turns)
            orchestrator = build(variant, model, set_name, db)
        else:
            orchestrator = build(variant, model, set_name)
        started = time.monotonic()
        try:
            output = await orchestrator.arun(input=case.message, session_id=session_id, stream=False)
        except Exception as error:
            # Recorded, not swallowed: the case is reported as a failed run with this text (spec «Прогон экзамена»).
            seconds = time.monotonic() - started
            print(f"{case.id}: error {type(error).__name__}", flush=True)
            return CaseResult(case, "error", (), seconds, error=f"{type(error).__name__}: {error}"), None
        seconds = time.monotonic() - started
        if output.status != RunStatus.completed:
            print(f"{case.id}: error status {output.status}", flush=True)
            return CaseResult(case, "error", (), seconds, error=f"Run status {output.status}: {output.content}"), None
        calls, input_tokens, cache_read, output_tokens = 0, 0, 0, 0
        for run in model_runs(output):
            calls += sum(
                1 for message in run.messages or [] if message.role == "assistant" and message.metrics.output_tokens
            )
            details = run.metrics.details if run.metrics is not None else None
            for entries in (details or {}).values():
                for entry in entries:
                    if entry.id != model:
                        raise RuntimeError(f"Case {case.id}: run {run.run_id} used model {entry.id!r}, not {model!r}")
                    input_tokens += entry.input_tokens
                    cache_read += entry.cache_read_tokens
                    output_tokens += entry.output_tokens
        usage = Usage(
            calls, input_tokens, cache_read, output_tokens, price.cost_rub(input_tokens, cache_read, output_tokens)
        )
        chosen = tuple(chosen_domains(output))
        called = tuple(stub_tool_calls(output, tools))
        refused = sum(1 for run in model_runs(output) for call in run.tools or [] if call.tool_call_error)
        if refused:
            print(f"{case.id}: {refused} refused tool call(s)", flush=True)
        print(f"{case.id}: {', '.join(chosen) or 'no domain'}", flush=True)
        outcome = "chosen" if chosen else "no-domain"
        return CaseResult(case, outcome, chosen, seconds, usage=usage, tools=called), output.content


def _share(part: int, whole: int) -> str:
    return "—" if whole == 0 else f"{part / whole:.0%} ({part}/{whole})"


def _ratio(value: float | None) -> str:
    return "—" if value is None else f"{value:.0%}"


def _issues(title: str, issues: tuple[ToolIssue, ...]) -> list[str]:
    lines = ["", f"### {title}: {len(issues)}", ""]
    for issue in issues:
        tool = f" — `{issue.tool}`" if issue.tool else ""
        lines.append(f"- `{issue.case_id}` ({issue.section}): {issue.domain}{tool}")
    if not issues:
        lines.append("Нет.")
    return lines


def _tools_markdown(tools: ToolQuality, scored: Quality) -> list[str]:
    lines = [
        "",
        "## Инструменты доменов",
        "",
        f"- Вызовов заглушек инструментов: {tools.calls}; "
        f"случаев с вызовом: {tools.cases_with_calls} из {scored.scored}.",
        f"- «Чужой инструмент» (домен инструмента не среди ожидаемых): {len(tools.foreign)}.",
        f"- «Домен без действия» (ожидаемый домен выбран, его инструмент не вызван): {len(tools.idle)}.",
        f"- Инструмент без выбора его домена: {len(tools.unloaded)}.",
        "",
        "| Раздел | Чужой инструмент | Домен без действия |",
        "|---|---|---|",
    ]
    for section in scored.sections:
        foreign = sum(issue.section == section for issue in tools.foreign)
        idle = sum(issue.section == section for issue in tools.idle)
        lines.append(f"| {section} | {foreign} | {idle} |")
    lines += _issues("Чужой инструмент", tools.foreign)
    lines += _issues("Домен без действия", tools.idle)
    lines += _issues("Инструмент без выбора домена", tools.unloaded)
    return lines


def _markdown(meta: dict[str, Any], scored: Quality, spent: Cost, tools: ToolQuality | None) -> str:
    lines = [
        f"# Экзамен маршрутизации: {meta['domains']}, {meta['split']}, {meta['variant']}, {meta['model']}",
        "",
        f"Начало {meta['started']}, случаев {meta['cases']}"
        + (f" (первые {meta['sample']})" if meta["sample"] else "")
        + f". Оценено {scored.scored}, ошибок запуска {scored.errors}, домен не выбран {scored.no_domain}.",
        "",
        f"**Полное совпадение набора доменов: {_share(scored.exact, scored.scored)}.**",
    ]
    if meta["variant"] == "team-route":
        lines.append("")
        lines.append("Режим `route` выбирает ровно один домен: случаи с несколькими просьбами в нём заведомо неверны.")
    lines += [
        "",
        "## Домены",
        "",
        "| Домен | Точность | Полнота | Верно | Лишний | Пропущен |",
        "|---|---|---|---|---|---|",
    ]
    for domain, score in scored.domains.items():
        lines.append(
            f"| {domain} | {_ratio(score.precision)} | {_ratio(score.recall)} | {score.true_positive} "
            f"| {score.false_positive} | {score.false_negative} |"
        )
    columns = sorted({chosen for _, chosen in scored.confusion})
    rows = sorted({want for want, _ in scored.confusion})
    lines += ["", "## Матрица ошибок (один ожидаемый домен; строка — ожидали, столбец — выбрал)", ""]
    lines.append("| | " + " | ".join(columns) + " |")
    lines.append("|---" * (len(columns) + 1) + "|")
    for want in rows:
        lines.append(f"| {want} | " + " | ".join(str(scored.confusion.get((want, c), "")) for c in columns) + " |")
    lines += ["", f"`{NO_CHOICE}` — оркестратор ответил сам, без домена."]
    if scored.multi_found:
        lines += ["", "## Несколько просьб: найден ли каждый домен", "", "| Домен | Найден |", "|---|---|"]
        for domain, (found, total) in scored.multi_found.items():
            lines.append(f"| {domain} | {_share(found, total)} |")
    lines += ["", "## Разделы", "", "| Раздел | Полное совпадение | Ошибок запуска |", "|---|---|---|"]
    for section, part in scored.sections.items():
        lines.append(f"| {section} | {_share(part.exact, part.cases - part.errors)} | {part.errors} |")
    lines += [
        "",
        "## Цена и задержка",
        "",
        f"- Вызовов модели: {spent.model_calls}, на случай {spent.calls_per_case:.1f}.",
        f"- Токены: вход {spent.input_tokens} (из кэша {spent.cache_read_tokens}), выход {spent.output_tokens}.",
        f"- Стоимость: {spent.cost_rub:.2f} ₽, на случай {spent.rub_per_case:.3f} ₽.",
        f"- Задержка на случай: медиана {spent.median_seconds:.1f} с, 95-й процентиль {spent.p95_seconds:.1f} с.",
    ]
    if tools is not None:
        lines += _tools_markdown(tools, scored)
    lines += ["", "## Неверные случаи", ""]
    for result in scored.wrong:
        chosen = ", ".join(result.chosen) or NO_CHOICE
        lines.append(
            f"- `{result.case.id}` ({result.case.section}): ожидали {', '.join(result.case.expect)}; выбрал {chosen}"
        )
    if not scored.wrong:
        lines.append("Нет.")
    return "\n".join(lines) + "\n"


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Not serializable: {type(value).__name__}")


async def _main(arguments: argparse.Namespace) -> int:
    check_skills(arguments.domains)
    domains = domain_set(arguments.domains)
    tools = tools_of(arguments.domains)
    cases = load_split(arguments.domains, arguments.split)
    if arguments.sample is not None:
        cases = cases[: arguments.sample]
    price = prices().get(arguments.model)
    started = datetime.now(UTC)
    gate = asyncio.Semaphore(CONCURRENCY)
    outcomes = await asyncio.gather(
        *(_run_case(c, arguments.variant, arguments.model, arguments.domains, tools, price, gate) for c in cases)
    )
    results: list[CaseResult] = []
    answers: dict[str, Any] = {}
    for result, answer in outcomes:
        results.append(result)
        answers[result.case.id] = answer
    scored, spent = quality(results, domains), cost(results)
    used = tool_quality(results, tools) if tools else None
    meta = {
        "domains": arguments.domains,
        "split": arguments.split,
        "variant": arguments.variant,
        "model": arguments.model,
        "sample": arguments.sample,
        "started": started.isoformat(timespec="seconds"),
        "cases": len(results),
    }
    report = {
        "meta": meta,
        "quality": {
            "scored": scored.scored,
            "exact": scored.exact,
            "no_domain": scored.no_domain,
            "errors": scored.errors,
            "domains": {
                domain: {**asdict(score), "precision": score.precision, "recall": score.recall}
                for domain, score in scored.domains.items()
            },
            "confusion": [{"expected": e, "chosen": c, "count": n} for (e, c), n in sorted(scored.confusion.items())],
            "multi_found": {domain: {"found": f, "expected": t} for domain, (f, t) in scored.multi_found.items()},
            "sections": {name: asdict(score) for name, score in scored.sections.items()},
        },
        "tools": None if used is None else asdict(used),
        "cost": {**asdict(spent), "calls_per_case": spent.calls_per_case, "rub_per_case": spent.rub_per_case},
        "cases": [{**asdict(result), "exact": result.exact, "answer": answers[result.case.id]} for result in results],
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"{started:%Y%m%dT%H%M%SZ}-{arguments.domains}-{arguments.split}-{arguments.variant}-{arguments.model}"
    json_path, md_path = REPORT_DIR / f"{stem}.json", REPORT_DIR / f"{stem}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")
    summary = _markdown(meta, scored, spent, used)
    md_path.write_text(summary, encoding="utf-8")
    print(summary)
    print(f"Report: {json_path.relative_to(REPO_ROOT)} and {md_path.relative_to(REPO_ROOT)}")
    return 0


def main(argv: list[str]) -> int:
    load_dotenv(REPO_ROOT / ".env")
    arguments = _arguments(argv)
    return asyncio.run(_main(arguments))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

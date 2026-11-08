"""Cases of the routing exam (openspec/specs/orchestrator, «Набор экзамена»): each domain set has its own parts —
cases/work.toml and cases/holdout.toml for `base`, cases/wide-work.toml and cases/wide-holdout.toml for `wide`.

Every case is a `[[case]]` table: `id`, `section`, `message`, `expect` (the domains it must reach) and, for
continuations, `history` — the earlier turns, `{ role = "author" | "coauthor", text = "..." }`. Both parts are
loaded and checked together, so an id can never sit in both; an expected domain must belong to the set of the file;
a broken case stops the exam before any model call.
"""

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from evals.routing.components import domain_set

CASES_DIR = Path(__file__).parent / "cases"
SPLITS = ("work", "holdout")
FILES = {
    "base": {"work": "work.toml", "holdout": "holdout.toml"},
    "wide": {"work": "wide-work.toml", "holdout": "wide-holdout.toml"},
}
SECTIONS = (
    "single",  # one request of one domain
    "none",  # nothing for the three domains of the work
    "multi",  # two or three requests of different domains in one message
    "boundary",  # close to the border of two domains
    "continuation",  # a short follow-up that needs the history
    "switch",  # a change of topic in the middle of a conversation
    "noise",  # typos, mixed Russian and English, slang
    "adversarial",  # attempts to change the role or reveal the instructions
)
WITH_HISTORY = ("continuation", "switch")
ROLES = ("author", "coauthor")
_FIELDS = {"id", "section", "message", "expect", "history"}


class CaseError(ValueError):
    """A case file or a case the exam cannot use."""


@dataclass(frozen=True)
class Turn:
    role: str
    text: str


@dataclass(frozen=True)
class Case:
    id: str
    section: str
    message: str
    expect: tuple[str, ...]
    history: tuple[Turn, ...]


def _text(where: str, value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CaseError(f"{where} must be a non-empty string")
    return value


def _turn(where: str, value: Any) -> Turn:
    if not isinstance(value, dict) or set(value) != {"role", "text"}:
        raise CaseError(f"{where} must be a table with exactly role and text")
    if value["role"] not in ROLES:
        raise CaseError(f"{where}.role {value['role']!r} is not one of {', '.join(ROLES)}")
    return Turn(role=value["role"], text=_text(f"{where}.text", value["text"]))


def parse_case(source: str, index: int, data: Any, domains: tuple[str, ...]) -> Case:
    if not isinstance(data, dict):
        raise CaseError(f"{source}: case {index} must be a table")
    case_id = data.get("id")
    where = f"{source}: case {case_id!r}" if isinstance(case_id, str) and case_id else f"{source}: case {index}"
    missing = {"id", "section", "message", "expect"} - set(data)
    if missing:
        raise CaseError(f"{where}: missing {', '.join(sorted(missing))}")
    extra = set(data) - _FIELDS
    if extra:
        raise CaseError(f"{where}: unknown field {', '.join(sorted(extra))}")
    case_id = _text(f"{where}.id", case_id)
    section = data["section"]
    if section not in SECTIONS:
        raise CaseError(f"{where}: section {section!r} is not one of {', '.join(SECTIONS)}")
    expect = data["expect"]
    if not isinstance(expect, list) or not expect:
        raise CaseError(f"{where}: expect must be a non-empty list of domains")
    for domain in expect:
        if domain not in domains:
            raise CaseError(f"{where}: domain {domain!r} is not one of {', '.join(domains)}")
    if len(set(expect)) != len(expect):
        raise CaseError(f"{where}: expect repeats a domain")
    history_data = data.get("history", [])
    if not isinstance(history_data, list):
        raise CaseError(f"{where}: history must be a list of turns")
    history = tuple(_turn(f"{where}.history[{i}]", turn) for i, turn in enumerate(history_data))
    if section in WITH_HISTORY and not history:
        raise CaseError(f"{where}: a {section} case needs a history")
    # Turns go to the orchestrator as earlier runs, each an author's message and the co-author's answer.
    if any(turn.role != ROLES[i % 2] for i, turn in enumerate(history)) or len(history) % 2:
        raise CaseError(
            f"{where}: history must alternate author and coauthor, starting with author, ending with coauthor"
        )
    return Case(
        id=case_id,
        section=section,
        message=_text(f"{where}.message", data["message"]),
        expect=tuple(expect),
        history=history,
    )


def parse_split(source: str, data: dict[str, Any], domains: tuple[str, ...]) -> tuple[Case, ...]:
    if set(data) != {"case"} or not isinstance(data["case"], list) or not data["case"]:
        raise CaseError(f"{source}: the file must hold only a non-empty list of [[case]] tables")
    cases = tuple(parse_case(source, index, item, domains) for index, item in enumerate(data["case"]))
    seen: set[str] = set()
    for case in cases:
        if case.id in seen:
            raise CaseError(f"{source}: case {case.id!r} repeats")
        seen.add(case.id)
    return cases


def check_parts(parts: dict[str, tuple[Case, ...]]) -> None:
    """No id in two parts."""
    owner: dict[str, str] = {}
    for split, cases in parts.items():
        for case in cases:
            if case.id in owner:
                raise CaseError(f"Case {case.id!r} is in both {owner[case.id]} and {split}")
            owner[case.id] = split


def _read(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as file:
            return tomllib.load(file)
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise CaseError(f"{path.name}: {error}") from error


def load_parts(set_name: str, cases_dir: Path = CASES_DIR) -> dict[str, tuple[Case, ...]]:
    """Both parts of the domain set, each checked and both checked together."""
    domains = domain_set(set_name)
    files = FILES[set_name]
    parts = {split: parse_split(files[split], _read(cases_dir / files[split]), domains) for split in SPLITS}
    check_parts(parts)
    return parts


def load_split(set_name: str, split: str, cases_dir: Path = CASES_DIR) -> tuple[Case, ...]:
    if split not in SPLITS:
        raise CaseError(f"Split {split!r} is unknown; use one of: {', '.join(SPLITS)}")
    return load_parts(set_name, cases_dir)[split]

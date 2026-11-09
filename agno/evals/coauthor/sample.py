"""The sample of the measurement: ids of the wide work part and the story each case runs in (sample.toml).

Every id must be a case of `wide-work.toml`, never of the held-out part; the sample must cover every domain of the
wide set and every section. A broken sample stops the measurement before any model call
(openspec/specs/coauthor-eval, «Наборы замера»).
"""

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from evals.coauthor.records import Expectation
from evals.coauthor.user import PLACES
from evals.routing.cases import SECTIONS, Case, load_parts
from evals.routing.components import DOMAIN_SETS

SAMPLE_FILE = Path(__file__).parent / "sample.toml"


class SampleError(ValueError):
    """A sample the measurement cannot use."""


@dataclass(frozen=True)
class Sampled:
    case: Case
    place: str
    expected: Expectation | None = None  # only cases of the demo set carry what the code checks


def check_coverage(source: str, sampled: list[Sampled]) -> None:
    """Every domain of the wide set and every section has a case."""
    covered = {domain for s in sampled for domain in s.case.expect}
    missing = [domain for domain in DOMAIN_SETS["wide"] if domain not in covered]
    if missing:
        raise SampleError(f"{source} has no case of domain(s) {', '.join(missing)}")
    sections = {s.case.section for s in sampled}
    absent = [section for section in SECTIONS if section not in sections]
    if absent:
        raise SampleError(f"{source} has no case of section(s) {', '.join(absent)}")


def parse_sample(data: dict[str, Any], work: tuple[Case, ...], holdout: tuple[Case, ...]) -> list[Sampled]:
    if set(data) != {"case"} or not isinstance(data["case"], list) or not data["case"]:
        raise SampleError("sample.toml must hold only a non-empty list of [[case]] tables")
    by_id = {case.id: case for case in work}
    held = {case.id for case in holdout}
    sampled: list[Sampled] = []
    seen: set[str] = set()
    for index, item in enumerate(data["case"]):
        if not isinstance(item, dict) or set(item) != {"id", "place"}:
            raise SampleError(f"sample case {index} must have exactly id and place")
        case_id, place = item["id"], item["place"]
        if case_id in held:
            raise SampleError(f"sample case {case_id!r} belongs to the held-out part")
        if case_id not in by_id:
            raise SampleError(f"sample case {case_id!r} is not in wide-work.toml")
        if case_id in seen:
            raise SampleError(f"sample case {case_id!r} repeats")
        if place not in PLACES:
            raise SampleError(f"sample case {case_id!r}: place {place!r} is not one of {', '.join(PLACES)}")
        seen.add(case_id)
        sampled.append(Sampled(by_id[case_id], place))
    check_coverage("the sample", sampled)
    return sampled


def load_sample(path: Path = SAMPLE_FILE) -> list[Sampled]:
    parts = load_parts("wide")
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise SampleError(f"{path.name}: {error}") from error
    return parse_sample(data, parts["work"], parts["holdout"])

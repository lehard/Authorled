"""Cases of the routing exam: loading and refusals (openspec/specs/orchestrator, «Набор экзамена»)."""

from pathlib import Path
from typing import Any

import pytest

from evals.routing.cases import CaseError, check_parts, load_parts, load_split, parse_case, parse_split
from evals.routing.components import DOMAIN_SETS

BASE = DOMAIN_SETS["base"]
WIDE = DOMAIN_SETS["wide"]

CASE = {"id": "docs-1", "section": "single", "message": "Заведи персонажа Пётр", "expect": ["domain-documents"]}


def _case(**changes: Any) -> dict[str, Any]:
    data = {**CASE, **changes}
    return {key: value for key, value in data.items() if value is not None}


def test_case_with_history() -> None:
    case = parse_case(
        "work.toml",
        0,
        _case(
            section="continuation",
            message="да",
            history=[
                {"role": "author", "text": "Можно сократить сцену?"},
                {"role": "coauthor", "text": "Могу предложить правку. Отправить?"},
            ],
        ),
        BASE,
    )
    assert case.expect == ("domain-documents",)
    assert [turn.role for turn in case.history] == ["author", "coauthor"]


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"expect": []}, "expect must be a non-empty list"),
        ({"expect": ["domain-weather"]}, "domain 'domain-weather' is not one of"),
        ({"expect": ["domain-craft", "domain-craft"]}, "expect repeats a domain"),
        ({"section": "misc"}, "section 'misc' is not one of"),
        ({"message": "  "}, "message must be a non-empty string"),
        ({"expect": None}, "missing expect"),
        ({"note": "x"}, "unknown field note"),
        ({"section": "continuation"}, "a continuation case needs a history"),
        ({"history": [{"role": "editor", "text": "x"}]}, "role 'editor' is not one of"),
        ({"history": [{"role": "coauthor", "text": "x"}, {"role": "author", "text": "y"}]}, "must alternate"),
        ({"history": [{"role": "author", "text": "x"}]}, "must alternate"),
    ],
)
def test_case_refused(changes: dict[str, Any], reason: str) -> None:
    with pytest.raises(CaseError, match=reason) as error:
        parse_case("work.toml", 0, _case(**changes), BASE)
    assert "docs-1" in str(error.value)


def test_repeated_id_refused() -> None:
    with pytest.raises(CaseError, match="case 'docs-1' repeats"):
        parse_split("work.toml", {"case": [CASE, CASE]}, BASE)


def test_id_in_both_parts_refused() -> None:
    work = parse_split("work.toml", {"case": [CASE]}, BASE)
    holdout = parse_split("holdout.toml", {"case": [CASE]}, BASE)
    with pytest.raises(CaseError, match="'docs-1' is in both work and holdout"):
        check_parts({"work": work, "holdout": holdout})


def test_unknown_split_refused(tmp_path: Path) -> None:
    with pytest.raises(CaseError, match="Split 'train' is unknown"):
        load_split("base", "train", tmp_path)


def test_missing_part_refused(tmp_path: Path) -> None:
    (tmp_path / "work.toml").write_text(
        '[[case]]\nid = "docs-1"\nsection = "single"\nmessage = "Привет"\nexpect = ["domain-none"]\n', encoding="utf-8"
    )
    with pytest.raises(CaseError, match="holdout.toml"):
        load_parts("base", tmp_path)


def test_domain_of_other_set_refused() -> None:
    with pytest.raises(CaseError, match="domain 'domain-documents' is not one of"):
        parse_case("wide-work.toml", 0, _case(), WIDE)
    with pytest.raises(CaseError, match="domain 'wide-characters' is not one of"):
        parse_case("work.toml", 0, _case(expect=["wide-characters"]), BASE)


def test_unknown_set_refused(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Domain set 'huge' is unknown"):
        load_parts("huge", tmp_path)


@pytest.mark.parametrize("set_name", ["base", "wide"])
def test_release_cases_load(set_name: str) -> None:
    parts = load_parts(set_name)
    assert all(parts.values())

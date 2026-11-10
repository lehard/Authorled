"""Markdown of the synopsis in the core (openspec/specs/api/stories, «Разметка синопсиса», «Синопсис в поиске без
разметки»): the examples of web/src/editor/prose/markdown.cases.json, which npm run check:editor checks for the
editor too, and the refusal of the route and of the co-author's tool; the search is in test_search.py."""

import json
from pathlib import Path
from typing import Any

import pytest

from core.errors import Invalid
from core.prose import check_synopsis, plain_text

CASES = Path(__file__).resolve().parents[2] / "web" / "src" / "editor" / "prose" / "markdown.cases.json"
_CASES: list[dict[str, Any]] = json.loads(CASES.read_text())


@pytest.mark.parametrize("case", _CASES, ids=[case["name"] for case in _CASES])
def test_cases(case: dict[str, Any]) -> None:
    if "error" in case:
        with pytest.raises(Invalid) as error:
            check_synopsis(case["markdown"])
        assert case["error"] in error.value.detail
        assert error.value.field == "fields.synopsis"
        return
    assert check_synopsis(case["markdown"]) == case["markdown"]
    assert plain_text(case["markdown"]) == case["plain"]
    stored = case.get("stored", case["markdown"])
    assert plain_text(stored) == case["plain"]


def test_route_refuses_a_third_level_heading(authors: Any) -> None:
    author = authors()
    story = author.story()
    url = f"/api/v1/documents/{story['script_id']}"
    script = author.get(url).json()
    saved = author.patch(
        url, json={"fields": {"synopsis": "Вера молчит."}}, headers={"If-Match": str(script["revision"])}
    )
    assert saved.status_code == 200, saved.text
    refused = author.patch(
        url,
        json={"fields": {"synopsis": "### Сцена 1\n\nВера молчит."}},
        headers={"If-Match": str(saved.json()["revision"])},
    )
    assert refused.status_code == 422
    assert "synopsis" in refused.json()["detail"]
    assert "третьего уровня не поддерживается" in refused.json()["detail"]
    assert author.get(url).json()["fields"]["synopsis"] == "Вера молчит."
    markdown = "# Акт 1\n\n## Завязка\n\n**Вера** молчит."
    kept = author.patch(
        url, json={"fields": {"synopsis": markdown}}, headers={"If-Match": str(saved.json()["revision"])}
    )
    assert kept.status_code == 200, kept.text
    assert kept.json()["fields"]["synopsis"] == markdown
    escaped = "\\### не заголовок"
    kept = author.patch(url, json={"fields": {"synopsis": escaped}}, headers={"If-Match": str(kept.json()["revision"])})
    assert kept.json()["fields"]["synopsis"] == escaped

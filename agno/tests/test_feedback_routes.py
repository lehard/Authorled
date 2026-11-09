"""Routes of marks of the co-author's answers (openspec/specs/api/coauthor-feedback)."""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import Engine, select

from core.tables import coauthor_feedback
from core.usage import ModelUsage, RunUsage, record_run
from tests.routes import PROBLEM


def _session(story: dict[str, Any]) -> str:
    return f"{story['project']['id']}:{story['draft_id']}:{uuid.uuid4()}"


def _run(engine: Engine, author: Any, session_id: str, agent_id: str = "coauthor") -> str:
    """A run of the agent in the usage journal of the author, as the post-hook of the co-author writes it."""
    run_id = str(uuid.uuid4())
    now = datetime.now(UTC)
    usage = (ModelUsage("deepseek-fast", 100, 0, 10, Decimal("0.0001")),)
    with engine.begin() as connection:
        record_run(connection, author.subject, RunUsage(run_id, session_id, agent_id, "completed", now, usage), now)
    return run_id


def _marks(engine: Engine, run_id: str) -> list[Any]:
    with engine.connect() as connection:
        return list(connection.execute(select(coauthor_feedback).where(coauthor_feedback.c.run_id == run_id)).all())


def test_put_change_and_list(authors: Any, engine: Engine) -> None:
    author = authors()
    session_id = _session(author.story())
    first = _run(engine, author, session_id)
    _run(engine, author, session_id)

    put = author.put(f"/api/v1/coauthor-feedback/{first}", json={"value": "useful"})
    assert put.status_code == 200, put.text
    body = put.json()
    assert (body["run_id"], body["session_id"], body["value"]) == (first, session_id, "useful")
    assert "updated_at" in body

    changed = author.put(f"/api/v1/coauthor-feedback/{first}", json={"value": "not_useful"})
    assert changed.status_code == 200
    assert changed.json()["value"] == "not_useful"
    assert len(_marks(engine, first)) == 1

    listed = author.get("/api/v1/coauthor-feedback", params={"session_id": session_id})
    assert listed.status_code == 200
    assert [(mark["run_id"], mark["value"]) for mark in listed.json()] == [(first, "not_useful")]


def test_body_checks(authors: Any, engine: Engine) -> None:
    author = authors()
    run_id = _run(engine, author, _session(author.story()))
    url = f"/api/v1/coauthor-feedback/{run_id}"
    for body, field in (
        ({"value": "great"}, "value"),
        ({}, "value"),
        ({"value": None}, "value"),
        ({"value": "useful", "comment": "так себе"}, "comment"),
    ):
        refused = author.put(url, json=body)
        assert refused.status_code == 422, body
        assert refused.headers["content-type"] == PROBLEM
        assert f"«{field}»" in refused.json()["detail"]
    assert author.put(url, json=["useful"]).status_code == 422
    assert _marks(engine, run_id) == []


def test_delete(authors: Any, engine: Engine) -> None:
    author = authors()
    session_id = _session(author.story())
    run_id = _run(engine, author, session_id)
    url = f"/api/v1/coauthor-feedback/{run_id}"

    assert author.delete(url).status_code == 204
    assert author.put(url, json={"value": "useful"}).status_code == 200
    assert author.delete(url).status_code == 204
    assert author.delete(url).status_code == 204
    assert author.get("/api/v1/coauthor-feedback", params={"session_id": session_id}).json() == []
    (row,) = _marks(engine, run_id)
    assert row.value is None


def test_runs_out_of_reach(authors: Any, engine: Engine) -> None:
    author = authors()
    other = authors()
    foreign = _run(engine, other, _session(other.story()))
    # A run of the author in a conversation of a story they cannot reach.
    lost = _run(engine, author, _session(other.story()))
    engineer = _run(engine, author, _session(author.story()), agent_id="claude-engineer")
    outside = _run(engine, author, "not-a-story-conversation")
    for run_id in (foreign, lost, engineer, outside, "nope"):
        url = f"/api/v1/coauthor-feedback/{run_id}"
        for refused in (author.put(url, json={"value": "useful"}), author.delete(url)):
            assert refused.status_code == 404, run_id
            assert refused.headers["content-type"] == PROBLEM
            assert refused.json()["detail"] == "Ответ соавтора не найден."
        assert _marks(engine, run_id) == []


def test_list_checks(authors: Any) -> None:
    author = authors()
    other = authors()
    missing = author.get("/api/v1/coauthor-feedback")
    assert missing.status_code == 422
    assert missing.headers["content-type"] == PROBLEM
    for bad in ("p:d:c", "", f"{uuid.uuid4()}:{uuid.uuid4()}"):
        refused = author.get("/api/v1/coauthor-feedback", params={"session_id": bad})
        assert refused.status_code == 422, bad
        assert "session_id" in refused.json()["detail"]
    foreign = author.get("/api/v1/coauthor-feedback", params={"session_id": _session(other.story())})
    assert foreign.status_code == 404
    assert foreign.headers["content-type"] == PROBLEM


def test_log_has_only_identifiers(authors: Any, engine: Engine, caplog: pytest.LogCaptureFixture) -> None:
    author = authors()
    session_id = _session(author.story("Тихая вода"))
    run_id = _run(engine, author, session_id)
    with caplog.at_level(logging.INFO, logger="app.api.feedback"):
        assert author.put(f"/api/v1/coauthor-feedback/{run_id}", json={"value": "not_useful"}).status_code == 200
    logged = " ".join(record.getMessage() for record in caplog.records if record.name == "app.api.feedback")
    assert run_id in logged
    assert "not_useful" in logged
    assert "Тихая вода" not in logged

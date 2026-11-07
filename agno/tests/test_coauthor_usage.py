"""Hooks of the co-author around a run (openspec/specs/api/agents, «Соавтор»; openspec/specs/core/subscriptions,
«Журнал расхода соавтора», «Проверка лимита до запуска»). Agno objects are built by hand: no model is called."""

import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from agno.agent import Agent
from agno.exceptions import InputCheckError, OutputCheckError
from agno.metrics import ModelMetrics, RunMetrics
from agno.models.deepseek import DeepSeek
from agno.run import RunContext
from agno.run.agent import RunOutput
from agno.run.base import RunStatus
from agno.session import AgentSession
from sqlalchemy import Engine, delete, insert, select, update

from agents.coauthor_usage import (
    CHECK_FAILED,
    LIMIT_REACHED,
    RECORD_FAILED,
    SUBSCRIPTION_ENDED,
    check_usage_limit,
    limit_message,
    record_usage,
)
from core.billing import cancel, checkout, confirm_operation
from core.subscriptions import Subscription, SubscriptionEnded, start_subscription
from core.tables import billing_checkouts, payments, subscriptions, usage_records, user_settings, users
from core.tochka import TochkaUnavailable
from core.usage import ModelUsage, RunUsage, record_run
from tests.billing_fake import FakeTochka, paid_plans

__all__ = ["paid_plans"]

SESSION = "p:d:c"


@pytest.fixture(autouse=True)
def tochka(monkeypatch: pytest.MonkeyPatch) -> FakeTochka:
    """Tochka of the hooks; it is asked only when a paid period is over."""
    fake = FakeTochka()
    monkeypatch.setattr("agents.coauthor_usage.tochka_client", lambda: fake)
    return fake


@pytest.fixture
def author(engine: Engine) -> Iterator[Callable[[], str]]:
    """Authors with a beta subscription from now; the hooks commit, so their rows go afterwards."""
    made: list[str] = []

    def make() -> str:
        subject = f"test-{uuid.uuid4()}"
        made.append(subject)
        with engine.begin() as connection:
            user_id = connection.execute(
                insert(users)
                .values(auth_subject=subject, email=f"{subject}@example.com", display_name="Автор")
                .returning(users.c.id)
            ).scalar_one()
            start_subscription(connection, user_id, "beta", "granted", datetime.now(UTC))
        return subject

    yield make
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject.in_(made)).scalar_subquery()
        connection.execute(delete(usage_records).where(usage_records.c.user_id.in_(ids)))
        connection.execute(delete(payments).where(payments.c.user_id.in_(ids)))
        connection.execute(delete(billing_checkouts).where(billing_checkouts.c.user_id.in_(ids)))
        connection.execute(delete(subscriptions).where(subscriptions.c.user_id.in_(ids)))
        connection.execute(delete(user_settings).where(user_settings.c.user_id.in_(ids)))
        connection.execute(delete(users).where(users.c.auth_subject.in_(made)))


def _context(subject: str, run_id: str = "current") -> RunContext:
    claims = {"sub": subject, "groups": ["screenwriters"]}
    authority = SimpleNamespace(context=SimpleNamespace(principal_id=subject, claims=claims))
    return RunContext(run_id=run_id, session_id=SESSION, user_id=subject, authorization=authority)


def _output(subject: str, run_id: str, status: RunStatus = RunStatus.completed, tokens: bool = True) -> RunOutput:
    details = {
        "model": [
            ModelMetrics(
                id="deepseek-fast",
                provider="DeepSeek",
                input_tokens=1_000,
                cache_read_tokens=200,
                output_tokens=100,
                cost=0.0012,
            )
        ]
    }
    return RunOutput(
        run_id=run_id,
        agent_id="coauthor",
        session_id=SESSION,
        user_id=subject,
        status=status,
        metrics=RunMetrics(details=details if tokens else None),
        created_at=int(datetime.now(UTC).timestamp()),
    )


def _journal(engine: Engine, subject: str) -> list[Any]:
    with engine.connect() as connection:
        ids = select(users.c.id).where(users.c.auth_subject == subject).scalar_subquery()
        return list(
            connection.execute(
                select(usage_records).where(usage_records.c.user_id.in_(ids)).order_by(usage_records.c.run_id)
            ).all()
        )


def test_limit_message_uses_moscow_date() -> None:
    renews = datetime(2027, 12, 6, 22, 30, tzinfo=UTC)
    assert limit_message(renews) == "Лимит соавтора на этот период исчерпан. Он обновится 7 декабря."


def test_post_hook_records_once(engine: Engine, author: Callable[[], str]) -> None:
    subject = author()
    output = _output(subject, f"r-{uuid.uuid4()}")
    record_usage(output, _context(subject, output.run_id or ""))
    record_usage(output, _context(subject, output.run_id or ""))
    (row,) = _journal(engine, subject)
    assert (row.run_id, row.session_id, row.agent_id, row.model) == (
        output.run_id,
        SESSION,
        "coauthor",
        "deepseek-fast",
    )
    assert (row.input_tokens, row.cache_read_tokens, row.output_tokens, row.run_status) == (
        1_000,
        200,
        100,
        "completed",
    )
    # 800 × 30 + 200 × 0.6 + 100 × 120, per million.
    assert str(row.cost_rub) == "0.036120"


def test_post_hook_without_tokens_fails_loudly(engine: Engine, author: Callable[[], str]) -> None:
    subject = author()
    with pytest.raises(OutputCheckError) as failed:
        record_usage(_output(subject, "r-empty", tokens=False), _context(subject, "r-empty"))
    assert failed.value.additional_data == {"reason": RECORD_FAILED}
    assert _journal(engine, subject) == []


def test_pre_hook_writes_earlier_runs(engine: Engine, author: Callable[[], str]) -> None:
    subject = author()
    cancelled = _output(subject, f"a-{uuid.uuid4()}", RunStatus.cancelled)
    refused = _output(subject, f"b-{uuid.uuid4()}", RunStatus.error, tokens=False)
    running = _output(subject, f"c-{uuid.uuid4()}", RunStatus.running)
    current = _output(subject, "current", RunStatus.running)
    session = AgentSession(session_id=SESSION, user_id=subject, runs=[cancelled, refused, running, current])
    check_usage_limit(_context(subject), session)
    check_usage_limit(_context(subject), session)
    rows = _journal(engine, subject)
    assert [(row.run_id, row.run_status) for row in rows] == [(cancelled.run_id, "cancelled")]


def test_pre_hook_refuses_over_the_limit(engine: Engine, author: Callable[[], str]) -> None:
    subject = author()
    now = datetime.now(UTC)
    big = RunUsage(
        "r-big-" + subject, SESSION, "coauthor", "completed", now, (ModelUsage("deepseek-fast", 0, 0, 5_000_000, None),)
    )
    with engine.begin() as connection:
        record_run(connection, subject, big, now)
        period_end = connection.execute(
            select(subscriptions.c.period_end)
            .join(users, users.c.id == subscriptions.c.user_id)
            .where(users.c.auth_subject == subject)
        ).scalar_one()
    with pytest.raises(InputCheckError) as refused:
        check_usage_limit(_context(subject), AgentSession(session_id=SESSION, user_id=subject, runs=[]))
    assert str(refused.value) == limit_message(period_end)
    assert refused.value.additional_data == {"reason": LIMIT_REACHED, "renews_at": period_end.isoformat()}


def test_pre_hook_without_subscription_refuses(engine: Engine, author: Callable[[], str]) -> None:
    subject = author()
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject == subject).scalar_subquery()
        connection.execute(
            update(subscriptions)
            .where(subscriptions.c.user_id.in_(ids))
            .values(status="ended", ended_at=datetime.now(UTC))
        )
    with pytest.raises(InputCheckError) as refused:
        check_usage_limit(_context(subject), AgentSession(session_id=SESSION, user_id=subject, runs=[]))
    assert refused.value.additional_data == {"reason": CHECK_FAILED}
    assert type(refused.value.__cause__).__name__ == "NoSubscription"


def test_pre_hook_without_caller_refuses() -> None:
    context = RunContext(run_id="r1", session_id=SESSION, user_id="s1", authorization=None)
    with pytest.raises(InputCheckError) as refused:
        check_usage_limit(context, AgentSession(session_id=SESSION, user_id="s1", runs=[]))
    assert refused.value.additional_data == {"reason": CHECK_FAILED}


def test_agno_refuses_the_run_before_the_model(engine: Engine, author: Callable[[], str]) -> None:
    """The hooks wired into an Agent: Agno passes them the run and the session and stops on the refusal.

    The model points at a closed port, so any call to it would fail the run with another message.
    """
    subject = author()
    now = datetime.now(UTC)
    big = RunUsage(
        "r-agno-" + subject,
        SESSION,
        "coauthor",
        "completed",
        now,
        (ModelUsage("deepseek-fast", 0, 0, 5_000_000, None),),
    )
    with engine.begin() as connection:
        record_run(connection, subject, big, now)
    agent = Agent(
        id="coauthor",
        model=DeepSeek(id="deepseek-fast", base_url="http://127.0.0.1:9/v1", api_key="unused"),
        pre_hooks=[check_usage_limit],
        post_hooks=[record_usage],
    )
    run_id = f"r-{uuid.uuid4()}"
    output = agent.run(
        "Привет", session_id=SESSION, user_id=subject, run_id=run_id, run_context=_context(subject, run_id)
    )
    assert output.status == RunStatus.error
    assert str(output.content).startswith("Лимит соавтора на этот период исчерпан. Он обновится ")
    assert [row.run_id for row in _journal(engine, subject)] == [big.run_id]


def test_pre_hook_names_an_ended_subscription(engine: Engine, author: Callable[[], str]) -> None:
    """A subscription that does not renew by itself (payments-tochka) ends with its own reason."""
    subject = author()
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject == subject).scalar_subquery()
        row = connection.execute(select(subscriptions).where(subscriptions.c.user_id.in_(ids))).one()
    ended = SubscriptionEnded(
        Subscription(
            row.id, row.user_id, row.plan, "tochka", row.status, row.started_at, row.period_start, row.period_end
        )
    )

    def refuse(*_: Any) -> None:
        raise ended

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr("agents.coauthor_usage.check_limit", refuse)
        with pytest.raises(InputCheckError) as refused:
            check_usage_limit(_context(subject), AgentSession(session_id=SESSION, user_id=subject, runs=[]))
    assert refused.value.additional_data == {
        "reason": SUBSCRIPTION_ENDED,
        "subscription_id": str(row.id),
        "plan": "beta",
        "period_end": row.period_end.isoformat(),
    }
    assert refused.value.__cause__ is ended


def _paid_and_cancelled(engine: Engine, subject: str, tochka: FakeTochka, paid_at: datetime) -> None:
    """The author bought `pro` at `paid_at` and cancelled it."""
    with engine.begin() as connection:
        user_id = connection.execute(select(users.c.id).where(users.c.auth_subject == subject)).scalar_one()
        checkout(connection, user_id, "pro", paid_at, tochka)
        operation_id = connection.execute(
            select(billing_checkouts.c.operation_id).where(billing_checkouts.c.user_id == user_id)
        ).scalar_one()
        tochka.charge(operation_id, paid_at)
        confirm_operation(connection, operation_id, tochka)
        cancel(connection, user_id, paid_at, tochka)


@pytest.mark.usefixtures("paid_plans")
def test_pre_hook_moves_an_ended_paid_subscription_to_the_signup_plan(
    engine: Engine, author: Callable[[], str], tochka: FakeTochka
) -> None:
    """After the end of a cancelled paid period the author works on the plan of new accounts at once."""
    subject = author()
    _paid_and_cancelled(engine, subject, tochka, datetime.now(UTC) - timedelta(days=40))
    check_usage_limit(_context(subject), AgentSession(session_id=SESSION, user_id=subject, runs=[]))
    with engine.begin() as connection:
        ids = select(users.c.id).where(users.c.auth_subject == subject).scalar_subquery()
        active = connection.execute(
            select(subscriptions).where(subscriptions.c.user_id.in_(ids), subscriptions.c.status == "active")
        ).one()
    assert (active.plan, active.source) == ("beta", "granted")
    assert active.period_start <= datetime.now(UTC) < active.period_end


@pytest.mark.usefixtures("paid_plans")
def test_pre_hook_refuses_when_tochka_is_down_at_the_end(
    engine: Engine, author: Callable[[], str], tochka: FakeTochka
) -> None:
    subject = author()
    with engine.begin() as connection:
        user_id = connection.execute(select(users.c.id).where(users.c.auth_subject == subject)).scalar_one()
        paid_at = datetime.now(UTC) - timedelta(days=40)
        checkout(connection, user_id, "pro", paid_at, tochka)
        operation_id = connection.execute(
            select(billing_checkouts.c.operation_id).where(billing_checkouts.c.user_id == user_id)
        ).scalar_one()
        tochka.charge(operation_id, paid_at)
        confirm_operation(connection, operation_id, tochka)
    tochka.unavailable = True
    with pytest.raises(InputCheckError) as refused:
        check_usage_limit(_context(subject), AgentSession(session_id=SESSION, user_id=subject, runs=[]))
    assert refused.value.additional_data == {"reason": CHECK_FAILED}
    assert isinstance(refused.value.__cause__, TochkaUnavailable)

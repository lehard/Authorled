"""One request of the measurement of actions through the real co-author, applied by the core (design, decision 5).

The core copies the open draft of the demo story for the request (`create_draft`); the conversation names the copy,
so the co-author works only there. The agent is the registered `coauthor` with its sessions in memory, run as the
user of the measurement of actions. Every pause is confirmed, as the chat does in the mode `auto`, and the run goes
on to the co-author's answer. The notes of a story are shared by its drafts, so before every request they are brought
back to the demo state (spec «Заметки истории перед просьбой»). What changed is read from the core before and after:
cards of the copy, notes of the story, comments and suggestions of the copy, and the documents of the open draft,
which must stay as they were.
"""

import time
import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime

from agno.run.authorization import authorization_scope
from agno.run.base import RunStatus

from agents.coauthor import coauthor
from core import notes, review, texts
from core.documents import list_documents
from core.drafts import create_draft
from core.engine import get_engine
from core.plans import ModelPrice
from evals.coauthor.actions import ActionRun, Card, Changes, Request
from evals.coauthor.demo_notes import demo_notes, restore_notes
from evals.coauthor.run import caller, calls_of, chat_context, session_db, usage_of
from evals.coauthor.user import EvalUser, Place

# A run that keeps pausing after this many confirmations is a failed request, not an endless loop (spec
# «Подтверждение действий в замере»).
MAX_CONTINUATIONS = 6


@dataclass(frozen=True)
class Snapshot:
    cards: dict[uuid.UUID, tuple[int, Card]]  # documents of the copy: revision and state
    notes: dict[uuid.UUID, tuple[int, str]]  # notes of the story: revision and title
    comments: int
    suggestions: int
    open_draft: dict[uuid.UUID, tuple[int, str]]  # documents of the open draft: revision and name


def fresh_draft(place: Place, request: Request, owner: uuid.UUID) -> Place:
    """A copy of the open draft for one request; the place now names the copy."""
    name = f"замер {request.id} {datetime.now(UTC):%Y%m%dT%H%M%SZ}"
    with get_engine().begin() as connection:
        draft = create_draft(connection, place.project_id, name, place.draft_id, owner)
    return replace(place, draft_id=draft.id, draft_name=draft.name)


def snapshot(project_id: uuid.UUID, draft_id: uuid.UUID, open_draft_id: uuid.UUID) -> Snapshot:
    with get_engine().connect() as connection:
        cards = {
            document.id: (
                document.revision,
                Card(str(document.id), document.kind, document.name, document.role, document.summary, document.fields),
            )
            for document in list_documents(connection, draft_id)
            if document.deleted_at is None
        }
        screenplay = texts.screenplay_id(connection, draft_id)
        return Snapshot(
            cards,
            {note.id: (note.revision, note.title) for note in notes.list_notes(connection, project_id)},
            len(review.list_threads(connection, screenplay)),
            len(review.list_suggestions(connection, screenplay, None)),
            {document.id: (document.revision, document.name) for document in list_documents(connection, open_draft_id)},
        )


def diff(before: Snapshot, after: Snapshot) -> Changes:
    return Changes(
        created=tuple(card for key, (_, card) in after.cards.items() if key not in before.cards),
        updated=tuple(
            (before.cards[key][1].name, card)
            for key, (revision, card) in after.cards.items()
            if key in before.cards and before.cards[key][0] != revision
        ),
        notes_created=tuple(title for key, (_, title) in after.notes.items() if key not in before.notes),
        notes_updated=tuple(
            before.notes[key][1]
            for key, (revision, _) in after.notes.items()
            if key in before.notes and before.notes[key][0] != revision
        ),
        comments=after.comments - before.comments,
        suggestions=after.suggestions - before.suggestions,
        open_draft=tuple(
            name
            for key, (revision, name) in after.open_draft.items()
            if before.open_draft.get(key, (None, ""))[0] != revision
        ),
    )


async def run_request(
    request: Request, place: Place, owner: uuid.UUID, user: EvalUser, model: str, price: ModelPrice
) -> ActionRun:
    open_draft_id = place.draft_id
    started = time.monotonic()
    with get_engine().begin() as connection:
        restore_notes(connection, place.project_id, demo_notes(place.title), owner)
    copy = fresh_draft(place, request, owner)
    before = snapshot(copy.project_id, copy.draft_id, open_draft_id)
    session_id = f"{copy.project_id}:{copy.draft_id}:{uuid.uuid4()}"
    agent = coauthor.deep_copy(update={"db": session_db(session_id, user.subject, None)})
    context = chat_context(copy)
    continuations = 0
    try:
        with authorization_scope(lambda: caller(user.subject)):
            output = await agent.arun(
                input=request.message,
                session_id=session_id,
                user_id=user.subject,
                dependencies=context,
                add_dependencies_to_context=True,
                stream=False,
            )
            while output.status == RunStatus.paused:
                continuations += 1
                if continuations > MAX_CONTINUATIONS:
                    raise RuntimeError(f"The run paused more than {MAX_CONTINUATIONS} times")
                requirements = output.active_requirements
                for requirement in requirements:
                    if not requirement.needs_confirmation or requirement.tool_execution is None:
                        raise RuntimeError(
                            f"The run paused on a requirement the measurement cannot answer: {requirement}"
                        )
                    requirement.confirm()
                output = await agent.acontinue_run(
                    run_response=output,
                    requirements=requirements,
                    session_id=session_id,
                    user_id=user.subject,
                    dependencies=context,
                    stream=False,
                )
    except Exception as error:
        # Recorded, not swallowed: the request is reported as a failed run with this text and what it changed
        # (spec «Проверки замера действий»).
        changes = diff(before, snapshot(copy.project_id, copy.draft_id, open_draft_id))
        seconds = time.monotonic() - started
        text = f"{type(error).__name__}: {error}"
        return ActionRun(request.id, "error", "", seconds, changes=changes, error=text, continuations=continuations)
    seconds = time.monotonic() - started
    changes = diff(before, snapshot(copy.project_id, copy.draft_id, open_draft_id))
    calls = calls_of(output, set())
    if output.status != RunStatus.completed:
        status = f"Run status {output.status}: {output.content}"
        return ActionRun(request.id, "error", "", seconds, calls, changes, error=status, continuations=continuations)
    answer = output.content if isinstance(output.content, str) else ""
    usage = usage_of(output, model, price)
    return ActionRun(request.id, "done", answer, seconds, calls, changes, usage, continuations=continuations)

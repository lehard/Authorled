"""The user of the measurement and the stories the co-author works in (design, decision 3).

A separate account of the core with a copy of the demo stories «Тихая вода» and «Последний паром». `setup` creates
it once; a run without it stops before any model call and names the command.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from core.documents import draft_row
from core.engine import get_engine
from core.projects import list_projects, user_id_of
from core.subscriptions import current_subscription
from core.users import AccountNotFound, get_or_create_user
from demo.load import ensure_migrated, load_demo

# The demo stories carry comments of a writer and an editor (web/src/data/demo.json); the demo loader gives every
# account it gets a copy, so the editor's comments belong to a second account of the measurement, not to a
# development user.
DEMO_WRITER, DEMO_EDITOR = "writer@authorled.test", "editor@authorled.test"
PLAN = "beta"


@dataclass(frozen=True)
class EvalUser:
    """An account of a measurement with its editor and the command that creates both."""

    subject: str
    email: str
    name: str
    editor_subject: str
    editor_email: str
    editor_name: str
    setup_command: str


# The quality measurement (openspec/specs/coauthor-eval) and the measurement of actions
# (openspec/specs/coauthor-actions-eval): separate accounts, so the actions applied by one
# never reach the stories of the other.
QUALITY = EvalUser(
    "coauthor-eval",
    "coauthor-eval@authorled.test",
    "Замер соавтора",
    "coauthor-eval-editor",
    "coauthor-eval-editor@authorled.test",
    "Редактор замера",
    "python -m evals.coauthor setup",
)
ACTIONS = EvalUser(
    "coauthor-actions-eval",
    "coauthor-actions-eval@authorled.test",
    "Замер действий соавтора",
    "coauthor-actions-eval-editor",
    "coauthor-actions-eval-editor@authorled.test",
    "Редактор замера действий",
    "python -m evals.coauthor actions-setup",
)
# Places of the sample (sample.toml, field `place`) and the demo stories they open.
PLACES = {"tihaya-voda": "Тихая вода", "posledniy-parom": "Последний паром"}


class EvalUserMissing(RuntimeError):
    """The user of the measurement or one of its stories does not exist."""


@dataclass(frozen=True)
class Place:
    title: str
    tagline: str
    project_id: uuid.UUID
    draft_id: uuid.UUID
    draft_name: str


def setup(user: EvalUser) -> int:
    """Create the user and its copy of the demo stories; a second call is refused by the demo loader."""
    with get_engine().begin() as connection:
        ensure_migrated(connection)
        account = get_or_create_user(connection, user.subject, user.email, user.name)
        editor = get_or_create_user(connection, user.editor_subject, user.editor_email, user.editor_name)
        plan = current_subscription(connection, account.id, datetime.now(UTC)).plan
        if plan != PLAN:
            raise RuntimeError(f"The user {user.subject} has plan {plan!r}, expected {PLAN!r}")
        return load_demo(connection, {DEMO_WRITER: account.id, DEMO_EDITOR: editor.id})


def places(user: EvalUser) -> dict[str, Place]:
    """Story and open draft of every place; a missing user or story stops the run with the setup command."""
    with get_engine().connect() as connection:
        try:
            owner = user_id_of(connection, user.subject)
        except AccountNotFound as error:
            raise EvalUserMissing(f"No user of the measurement: run `{user.setup_command}` first") from error
        stories = {project.title: project for project in list_projects(connection, owner, trash=False)}
        found: dict[str, Place] = {}
        for place, title in PLACES.items():
            if title not in stories:
                raise EvalUserMissing(
                    f"The user of the measurement has no story «{title}»: run `{user.setup_command}` first"
                )
            story = stories[title]
            draft = draft_row(connection, story.open_draft_id)
            found[place] = Place(title, story.description, story.id, draft.id, draft.name)
    return found

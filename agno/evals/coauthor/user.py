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

SUBJECT = "coauthor-eval"
EMAIL = "coauthor-eval@authorled.test"
NAME = "Замер соавтора"
PLAN = "beta"
# The demo stories carry comments of a writer and an editor (web/src/data/demo.json); the demo loader gives every
# account it gets a copy, so the editor's comments belong to a second account of the measurement, not to a
# development user.
DEMO_WRITER, DEMO_EDITOR = "writer@authorled.test", "editor@authorled.test"
EDITOR_SUBJECT, EDITOR_EMAIL, EDITOR_NAME = (
    "coauthor-eval-editor",
    "coauthor-eval-editor@authorled.test",
    "Редактор замера",
)
# Places of the sample (sample.toml, field `place`) and the demo stories they open.
PLACES = {"tihaya-voda": "Тихая вода", "posledniy-parom": "Последний паром"}
SETUP_COMMAND = "python -m evals.coauthor setup"


class EvalUserMissing(RuntimeError):
    """The user of the measurement or one of its stories does not exist."""


@dataclass(frozen=True)
class Place:
    title: str
    tagline: str
    project_id: uuid.UUID
    draft_id: uuid.UUID
    draft_name: str


def setup() -> int:
    """Create the user and its copy of the demo stories; a second call is refused by the demo loader."""
    with get_engine().begin() as connection:
        ensure_migrated(connection)
        account = get_or_create_user(connection, SUBJECT, EMAIL, NAME)
        editor = get_or_create_user(connection, EDITOR_SUBJECT, EDITOR_EMAIL, EDITOR_NAME)
        plan = current_subscription(connection, account.id, datetime.now(UTC)).plan
        if plan != PLAN:
            raise RuntimeError(f"The user of the measurement has plan {plan!r}, expected {PLAN!r}")
        return load_demo(connection, {DEMO_WRITER: account.id, DEMO_EDITOR: editor.id})


def places() -> dict[str, Place]:
    """Story and open draft of every place; a missing user or story stops the run with the setup command."""
    with get_engine().connect() as connection:
        try:
            owner = user_id_of(connection, SUBJECT)
        except AccountNotFound as error:
            raise EvalUserMissing(f"No user of the measurement: run `{SETUP_COMMAND}` first") from error
        stories = {project.title: project for project in list_projects(connection, owner, trash=False)}
        found: dict[str, Place] = {}
        for place, title in PLACES.items():
            if title not in stories:
                raise EvalUserMissing(
                    f"The user of the measurement has no story «{title}»: run `{SETUP_COMMAND}` first"
                )
            story = stories[title]
            draft = draft_row(connection, story.open_draft_id)
            found[place] = Place(title, story.description, story.id, draft.id, draft.name)
    return found

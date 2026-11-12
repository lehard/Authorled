"""What one case of the measurement produced: the co-author's calls, answer, outcome and spending.

Plain data, without the agent, so the scoring and its tests import no model or database.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

# The co-author's tools that change the story (agents/coauthor_tools.py: CHANGING_TOOLS and suggest_edit, which
# changes the screenplay only through the author's decision). A test keeps this in step with the agent.
CHANGING = frozenset(
    {
        "create_story_note",
        "save_chat_file_to_notes",
        "update_story_note",
        "create_story_document",
        "update_story_document",
        "comment_on_screenplay",
        "suggest_edit",
    }
)


# What a case of the demo set may refer to (design, decision 10): a scene by its number in the open draft, the rest
# by the name of a card or the title of a note; `document` is a card of any kind.
REF_KINDS = ("scene", "character", "location", "world", "document", "note")


@dataclass(frozen=True)
class Ref:
    kind: str
    name: str  # the scene's number as text for `scene`

    def label(self) -> str:
        words = {
            "scene": "сцены",
            "character": "персонажа",
            "location": "локации",
            "world": "мира",
            "document": "карточки",
            "note": "заметки",
        }
        return f"{words[self.kind]} {self.name}" if self.kind == "scene" else f"{words[self.kind]} «{self.name}»"


@dataclass(frozen=True)
class Expectation:
    """What a case of the demo set expects, checked by code (design, decision 11)."""

    action: tuple[str, ...]  # changing tools of which one is needed; empty: no change at all
    mention: tuple[tuple[str, ...], ...] = ()  # groups of lower-case stems; each group needs one in the answer
    refs: tuple[Ref, ...] = ()
    absent: tuple[Ref, ...] = ()  # what the case asks about and the story does not have
    open: int | None = None  # the scene selected in the open screenplay; None: the story card is open
    doc: str | None = None  # the open «Логлайн» or «Синопсис» (evals/coauthor/doc_tasks.py), instead of a scene
    task: str | None = None  # the task of «Соавтор» at that document the case sends
    # The text the case asks to write, checked by code with its action: "page" (a synopsis without headings), "acts"
    # (a synopsis with headings of the first or second level) or "note" (a note without Markdown).
    markup: str | None = None


@dataclass(frozen=True)
class Call:
    name: str
    args: dict[str, Any]
    paused: bool  # proposed to the author and rejected by the measurement; never run
    result: str = ""  # what the tool returned to the co-author, cut for the judge


@dataclass(frozen=True)
class Usage:
    model_calls: int
    input_tokens: int
    cache_read_tokens: int
    output_tokens: int
    cost_rub: Decimal


@dataclass(frozen=True)
class CaseRun:
    case_id: str
    outcome: str  # "answered", "paused" (proposed a change, rejected, then answered) or "error"
    answer: str
    seconds: float
    calls: tuple[Call, ...] = ()
    usage: Usage | None = None
    error: str | None = None

    @property
    def changes(self) -> tuple[Call, ...]:
        return tuple(call for call in self.calls if call.name in CHANGING)

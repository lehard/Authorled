"""The demo set of the measurement: its own cases about the contents of the demo stories (design, decision 10).

Two parts, cases/demo-work.toml and cases/demo-holdout.toml. A case has the fields of a routing case (`id`, `section`,
`message`, `expect` with domains of the wide set, `history`) and its own: `place` (the story it runs in), `action`
(`"none"` or the changing tools of which one is needed), `mention` (groups of stems the answer must contain), `refs`
(what of the story it asks about), `absent` (what it asks about that the story does not have) and, optionally, `open`
(`{ scene = N }`: the screenplay is open and scene N selected, as a check of the mentor sends it; `{ doc = "logline" }`
or `{ doc = "synopsis" }`: that document is open). A case of the part `docs` names the task of «Соавтор» it sends
(`task`, evals/coauthor/doc_tasks.py) over the document of that task. Every reference is
checked against web/src/data/demo.json — the file `setup` loaded for the user of the measurement — in the draft the
story opens; a broken case stops the measurement before any model call (openspec/specs/coauthor-eval).
"""

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.texts import scenes
from demo.load import read_demo
from evals.coauthor.doc_tasks import DOC_TASKS, DOC_TITLES, matches
from evals.coauthor.records import CHANGING, REF_KINDS, Expectation, Ref
from evals.coauthor.sample import Sampled, SampleError, check_coverage
from evals.coauthor.user import PLACES
from evals.routing.cases import CaseError, parse_case
from evals.routing.components import DOMAIN_SETS

CASES_DIR = Path(__file__).parent / "cases"
PARTS = {
    "work": "demo-work.toml",
    "holdout": "demo-holdout.toml",
    "checks": "demo-checks.toml",
    "docs": "demo-docs.toml",
}
# The checks of the mentor are one domain over a selected scene, the tasks of documents a few domains over an open
# logline or synopsis: the coverage of domains and sections is not theirs (spec «Наборы замера»).
COVERED_PARTS = ("work", "holdout")
# Only the cases of this part name a task of «Соавтор» at a document, and every one of them does.
TASK_PART = "docs"
NO_ACTION = "none"
_OWN = {"place", "action", "mention", "refs", "absent", "open", "task", "markup"}
# What a case asks to write and the tool that writes it (openspec/specs/api/agents, «Разметка синопсиса у соавтора»).
MARKUP_TOOLS = {"page": "update_story_document", "acts": "update_story_document", "note": "create_story_note"}
_CARD_GROUPS = {"character": "characters", "location": "locations", "world": "worlds"}


@dataclass(frozen=True)
class Story:
    """What the co-author can find in one demo story: its scenes and the names of live cards and notes."""

    scenes: int
    names: dict[str, frozenset[str]]

    def has(self, ref: Ref) -> bool:
        if ref.kind == "scene":
            return 1 <= int(ref.name) <= self.scenes
        return ref.name in self.names[ref.kind]


def demo_stories(demo: dict[str, Any] | None = None) -> dict[str, Story]:
    """Every place of the measurement as the demo loader gives it: the first draft of the story is the open one."""
    demo = read_demo() if demo is None else demo
    found: dict[str, Story] = {}
    for place, title in PLACES.items():
        project = next(p for p in demo["projects"] if p["title"] == title)
        draft = next(d for d in demo["drafts"] if d["projectId"] == project["id"])
        script = next(s for s in demo["scripts"] if s["draftId"] == draft["id"])
        names = {
            kind: frozenset(
                item["name"] for item in demo[group] if item["draftId"] == draft["id"] and not item["deletedAt"]
            )
            for kind, group in _CARD_GROUPS.items()
        }
        names["document"] = frozenset().union(*names.values())
        names["note"] = frozenset(
            n["title"] for n in demo["notes"] if n["projectId"] == project["id"] and not n["deletedAt"]
        )
        found[place] = Story(len(scenes(script["text"])), names)
    return found


def _refs(where: str, value: Any) -> tuple[Ref, ...]:
    if not isinstance(value, list):
        raise SampleError(f"{where} must be a list of {{ kind, name }} tables")
    refs: list[Ref] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict) or set(item) != {"kind", "name"}:
            raise SampleError(f"{where}[{index}] must have exactly kind and name")
        kind, name = item["kind"], item["name"]
        if kind not in REF_KINDS:
            raise SampleError(f"{where}[{index}]: kind {kind!r} is not one of {', '.join(REF_KINDS)}")
        if kind == "scene":
            if not isinstance(name, int) or isinstance(name, bool):
                raise SampleError(f"{where}[{index}]: a scene is named by its number")
            name = str(name)
        elif not isinstance(name, str) or not name.strip():
            raise SampleError(f"{where}[{index}]: name must be a non-empty string")
        refs.append(Ref(kind, name))
    return tuple(refs)


def _action(where: str, value: Any) -> tuple[str, ...]:
    if value == NO_ACTION:
        return ()
    if not isinstance(value, list) or not value or len(set(value)) != len(value):
        raise SampleError(f"{where}: action must be {NO_ACTION!r} or a non-empty list of distinct changing tools")
    unknown = [name for name in value if name not in CHANGING]
    if unknown:
        raise SampleError(f"{where}: action {', '.join(map(repr, unknown))} is not a changing tool")
    return tuple(value)


def _mention(where: str, value: Any) -> tuple[tuple[str, ...], ...]:
    if not isinstance(value, list):
        raise SampleError(f"{where}: mention must be a list of groups of stems")
    groups: list[tuple[str, ...]] = []
    for index, group in enumerate(value):
        if not isinstance(group, list) or not group or not all(isinstance(s, str) and s.strip() for s in group):
            raise SampleError(f"{where}: mention[{index}] must be a non-empty list of non-empty stems")
        groups.append(tuple(stem.lower() for stem in group))
    return tuple(groups)


def _open(where: str, value: Any) -> tuple[int | None, str | None]:
    """The scene selected in the open screenplay or the open document; exactly one of them."""
    if not isinstance(value, dict) or set(value) not in ({"scene"}, {"doc"}):
        raise SampleError(f'{where} must be a table {{ scene = N }} or {{ doc = "logline" | "synopsis" }}')
    if "doc" in value:
        doc = value["doc"]
        if doc not in DOC_TITLES:
            raise SampleError(f"{where}: document {doc!r} is not one of {', '.join(DOC_TITLES)}")
        return None, doc
    scene = value["scene"]
    if not isinstance(scene, int) or isinstance(scene, bool):
        raise SampleError(f"{where}: a scene is named by its number")
    return scene, None


def _task(where: str, value: Any, doc: str | None, message: str) -> str:
    if value not in DOC_TASKS:
        raise SampleError(f"{where}: task {value!r} is not one of {', '.join(DOC_TASKS)}")
    task = DOC_TASKS[value]
    if doc != task.doc:
        raise SampleError(f"{where}: task {value!r} stands on {{ doc = {task.doc!r} }}, the case opens {doc!r}")
    if not matches(task, message):
        raise SampleError(f"{where}: the message is not the request of task {value!r}")
    return str(value)


def parse_demo_case(source: str, index: int, data: Any, stories: dict[str, Story], *, tasked: bool) -> Sampled:
    if not isinstance(data, dict):
        raise SampleError(f"{source}: case {index} must be a table")
    try:
        case = parse_case(source, index, {k: v for k, v in data.items() if k not in _OWN}, DOMAIN_SETS["wide"])
    except CaseError as error:
        raise SampleError(str(error)) from error
    where = f"{source}: case {case.id!r}"
    missing = {"place", "action"} - set(data)
    if missing:
        raise SampleError(f"{where}: missing {', '.join(sorted(missing))}")
    place = data["place"]
    if place not in stories:
        raise SampleError(f"{where}: place {place!r} is not one of {', '.join(stories)}")
    story = stories[place]
    refs = _refs(f"{where}.refs", data.get("refs", []))
    absent = _refs(f"{where}.absent", data.get("absent", []))
    for ref in refs:
        if not story.has(ref):
            raise SampleError(f"{where}: «{PLACES[place]}» has no {ref.kind} {ref.name!r}")
    for ref in absent:
        if story.has(ref):
            raise SampleError(f"{where}: absent {ref.kind} {ref.name!r} exists in «{PLACES[place]}»")
    opened, doc = _open(f"{where}.open", data["open"]) if "open" in data else (None, None)
    if opened is not None and not story.has(Ref("scene", str(opened))):
        raise SampleError(f"{where}: «{PLACES[place]}» has no scene {opened} to open")
    if tasked and "task" not in data:
        raise SampleError(f"{where}: a case of the part {TASK_PART} names its task")
    if not tasked and "task" in data:
        raise SampleError(f"{where}: only a case of the part {TASK_PART} names a task")
    task = _task(where, data["task"], doc, case.message) if tasked else None
    action = _action(where, data["action"])
    markup = data.get("markup")
    if markup is not None:
        if markup not in MARKUP_TOOLS:
            raise SampleError(f"{where}: markup {markup!r} is not one of {', '.join(MARKUP_TOOLS)}")
        if action != (MARKUP_TOOLS[markup],):
            raise SampleError(f"{where}: markup {markup!r} needs action = [{MARKUP_TOOLS[markup]!r}]")
    expected = Expectation(
        action=action,
        mention=_mention(where, data.get("mention", [])),
        refs=refs,
        absent=absent,
        open=opened,
        doc=doc,
        task=task,
        markup=markup,
    )
    return Sampled(case, place, expected)


def parse_demo_part(
    source: str, data: dict[str, Any], stories: dict[str, Story], *, covered: bool, tasked: bool
) -> list[Sampled]:
    if set(data) != {"case"} or not isinstance(data["case"], list) or not data["case"]:
        raise SampleError(f"{source}: the file must hold only a non-empty list of [[case]] tables")
    cases = [parse_demo_case(source, index, item, stories, tasked=tasked) for index, item in enumerate(data["case"])]
    seen: set[str] = set()
    for item in cases:
        if item.case.id in seen:
            raise SampleError(f"{source}: case {item.case.id!r} repeats")
        seen.add(item.case.id)
    if covered:
        check_coverage(source, cases)
    return cases


def check_parts(parts: dict[str, list[Sampled]]) -> None:
    owner: dict[str, str] = {}
    for part, cases in parts.items():
        for item in cases:
            if item.case.id in owner:
                raise SampleError(f"case {item.case.id!r} is in both {owner[item.case.id]} and {part}")
            owner[item.case.id] = part


def _read(path: Path) -> dict[str, Any]:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise SampleError(f"{path.name}: {error}") from error


def load_demo_part(part: str, cases_dir: Path = CASES_DIR) -> list[Sampled]:
    """One part of the demo set; all parts are loaded and checked together, so an id never sits in two."""
    if part not in PARTS:
        raise SampleError(f"Part {part!r} is unknown; use one of: {', '.join(PARTS)}")
    stories = demo_stories()
    parts = {
        name: parse_demo_part(
            file, _read(cases_dir / file), stories, covered=name in COVERED_PARTS, tasked=name == TASK_PART
        )
        for name, file in PARTS.items()
    }
    check_parts(parts)
    return parts[part]

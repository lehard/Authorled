"""Writes the stories of web/src/data/demo.json through the core, one copy per owner, in the caller's transaction."""

import copy
import json
import uuid
from pathlib import Path
from typing import Any

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, select

from core import documents, drafts, notes, projects, review, saves, texts
from core.tables import SCHEMA, users
from core.tables import projects as projects_table

AGNO_DIR = Path(__file__).resolve().parents[1]
DEMO_FILE = AGNO_DIR.parent / "web" / "src" / "data" / "demo.json"

Item = dict[str, Any]


class DemoExists(Exception):
    """An owner already has a story with a demo title, in the trash too."""


class SchemaBehind(Exception):
    """The schema is not at the last migration."""


def read_demo() -> Item:
    content: Item = json.loads(DEMO_FILE.read_text(encoding="utf-8"))
    return content


def ensure_migrated(connection: Connection) -> None:
    head = set(ScriptDirectory.from_config(Config(AGNO_DIR / "alembic.ini")).get_heads())
    current = set(MigrationContext.configure(connection, opts={"version_table_schema": SCHEMA}).get_current_heads())
    if current != head:
        raise SchemaBehind(f"Схема не на последней миграции: выполните ./scripts/dev.sh migrate ({current} → {head}).")


def _ensure_free(connection: Connection, demo: Item, accounts: dict[str, uuid.UUID]) -> None:
    taken = connection.execute(
        select(users.c.email, projects_table.c.title)
        .join(users, users.c.id == projects_table.c.owner_id)
        .where(
            projects_table.c.owner_id.in_(accounts.values()),
            projects_table.c.title.in_([project["title"] for project in demo["projects"]]),
        )
        .order_by(users.c.email, projects_table.c.title)
    ).all()
    if taken:
        names = ", ".join(f"{email}: «{title}»" for email, title in taken)
        raise DemoExists(f"Демо-истории уже есть, ничего не загружено. {names}.")


def _text(doc: Item, threads: dict[str, uuid.UUID]) -> Item:
    """Real thread ids in comment marks; suggestion marks go, the browser places them itself."""
    result = copy.deepcopy(doc)
    for block in result["content"]:
        if "content" not in block:
            continue
        merged: list[Item] = []
        for node in block["content"]:
            marks = [
                {"type": "comment", "attrs": {"id": str(threads[mark["attrs"]["id"]])}}
                for mark in node.pop("marks", [])
                if mark["type"] == "comment"
            ]
            if marks:
                node["marks"] = marks
            if merged and "marks" not in merged[-1] and "marks" not in node:
                merged[-1]["text"] += node["text"]
            else:
                merged.append(node)
        block["content"] = merged
    return result


def _passport(script: Item) -> Item:
    return {
        "logline": script["logline"],
        "show": script["show"],
        "title_page": script["titlePage"],
        "synopsis": script["synopsis"],
    }


def _card(kind: str, item: Item) -> Item:
    fields = dict(item["ext"])
    for source, target in (("long", "description"), ("age", "age"), ("gender", "gender"), ("overview", "overview")):
        if item.get(source):
            fields[target] = item[source]
    card = {"kind": kind, "name": item["name"], "summary": item["one"], "fields": fields}
    if kind != "world":
        card["role"] = item["role"]
    return card


def _cards(demo: Item, draft_id: str) -> list[tuple[Item, Item]]:
    """The cards of a draft of the file in navigator order, each with what the core takes."""
    groups = (("character", "characters"), ("location", "locations"), ("world", "worlds"))
    return [(item, _card(kind, item)) for kind, group in groups for item in demo[group] if item["draftId"] == draft_id]


def _points(connection: Connection, demo: Item, source_id: str, draft_id: uuid.UUID, owner: uuid.UUID) -> None:
    for point in demo["points"]:
        if point["draftId"] == source_id:
            saves.create_point(connection, draft_id, point["name"], owner)


def _notes(connection: Connection, demo: Item, source_id: str, story_id: uuid.UUID, owner: uuid.UUID) -> None:
    for note in demo["notes"]:
        if note["projectId"] == source_id:
            made = notes.create_note(connection, story_id, note["title"], note["body"], owner)
            if note["deletedAt"]:
                notes.trash_note(connection, made.id)


def _script(demo: Item, draft_id: str) -> Item:
    return next(script for script in demo["scripts"] if script["draftId"] == draft_id)


def _review(
    connection: Connection,
    demo: Item,
    source_id: str,
    story_id: uuid.UUID,
    draft_id: uuid.UUID,
    document_id: uuid.UUID,
    threads: dict[str, uuid.UUID],
    accounts: dict[str, uuid.UUID],
) -> None:
    for thread in demo["comments"]:
        if thread["draftId"] != source_id:
            continue
        review.create_thread(
            connection,
            document_id,
            threads[thread["id"]],
            thread["quote"],
            thread["text"],
            accounts[thread["email"]],
            thread["role"],
        )
        for reply in thread["replies"]:
            review.add_reply(connection, threads[thread["id"]], reply["text"], accounts[reply["email"]], reply["role"])
    for suggestion in demo["suggestions"]:
        if suggestion["draftId"] == source_id:
            review.create_suggestion(
                connection,
                document_id,
                suggestion["sceneUid"],
                suggestion["quote"],
                suggestion["text"],
                suggestion["why"],
                f"{story_id}:{draft_id}:{uuid.uuid4()}",
            )


def _story(connection: Connection, demo: Item, project: Item, owner: uuid.UUID, accounts: dict[str, uuid.UUID]) -> None:
    source_drafts = [draft for draft in demo["drafts"] if draft["projectId"] == project["id"]]
    first = source_drafts[0]
    script = _script(demo, first["id"])
    threads = {thread["id"]: uuid.uuid4() for thread in demo["comments"] if thread["draftId"] == first["id"]}
    story, first_id, document_id = projects.create_project(
        connection, owner, project["title"], project["desc"], _text(script["text"], threads)
    )
    # The colour of the sample data, so the `fixtures` source and the database show the same shelf.
    story = projects.update_project(connection, story.id, {"cover_color": project["coverColor"]})
    revision = documents.document_row(connection, document_id).revision
    documents.update_document(connection, document_id, revision, {"fields": _passport(script)}, owner)
    cards = _cards(demo, first["id"])
    if cards:
        made = documents.create_documents(connection, first_id, [card for _, card in cards], owner)
        for (item, _), document in zip(cards, made, strict=True):
            if item["deletedAt"]:
                documents.trash_document(connection, document.id)
    _review(connection, demo, first["id"], story.id, first_id, document_id, threads, accounts)
    _points(connection, demo, first["id"], first_id, owner)

    ids = {first["name"]: first_id}
    for source in source_drafts[1:]:
        ids[source["name"]] = _fork(connection, demo, story.id, source, ids[source["forkedFromName"]], owner)

    _notes(connection, demo, project["id"], story.id, owner)
    drafts.open_draft(connection, first_id, owner)
    if project["deletedAt"]:
        projects.trash_project(connection, story.id)


def _fork(
    connection: Connection, demo: Item, story_id: uuid.UUID, source: Item, base_id: uuid.UUID, owner: uuid.UUID
) -> uuid.UUID:
    """A draft forked from its base; the point comes first, so it keeps what the fork started from."""
    draft_id = drafts.create_draft(connection, story_id, source["name"], base_id, owner).id
    _points(connection, demo, source["id"], draft_id, owner)
    document_id = texts.screenplay_id(connection, draft_id)
    current = texts.get_text(connection, document_id)
    content = _text(_script(demo, source["id"])["text"], {})
    if content != current.content:
        texts.put_text(connection, document_id, current.revision, content, owner)
    saved = {document.name: document for document in documents.list_documents(connection, draft_id)}
    for _, card in _cards(demo, source["id"]):
        if card["name"] not in saved:
            raise ValueError(f"В основе драфта «{source['name']}» нет карточки «{card['name']}».")
        document = saved[card["name"]]
        if document.summary != card["summary"] or document.fields != card["fields"]:
            changes = {"summary": card["summary"], "fields": card["fields"]}
            documents.update_document(connection, document.id, document.revision, changes, owner)
    return draft_id


def load_demo(connection: Connection, accounts: dict[str, uuid.UUID]) -> int:
    """Give every owner of `accounts` (e-mail → user id) a copy of the stories; returns the stories of one copy."""
    demo = read_demo()
    _ensure_free(connection, demo, accounts)
    for owner in accounts.values():
        for project in demo["projects"]:
            _story(connection, demo, project, owner, accounts)
    return len(demo["projects"])

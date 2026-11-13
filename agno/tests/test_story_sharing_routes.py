"""Routes of a story with participants (openspec/specs/api/story-sharing and the deltas of api/stories, api/review,
auth): every story route against every role, invitations, the link «почитать» without a token, saves on an old
revision and the place of the owner. The antivirus is the clamav service of ./scripts/dev.sh test."""

import uuid
from dataclasses import dataclass
from typing import Any

import pytest

from tests.routes import PROBLEM, Author, product_app
from tests.test_file_routes import _upload

SCENE = {"type": "sceneHeading", "attrs": {"uid": "s3"}, "content": [{"type": "text", "text": "НАТ. ОЗЕРО — ДЕНЬ"}]}
ACTION = {"type": "action", "content": [{"type": "text", "text": "Вера молчит."}]}
TEXT = {"type": "doc", "content": [SCENE, ACTION]}

RANK = {"read": 0, "review": 1, "edit": 2, "owner": 3}
ROLE_RANK = {"reader": 0, "reviewer": 1, "coauthor": 2}


@dataclass
class Team:
    owner: Author
    coauthor: Author
    reviewer: Author
    reader: Author
    spare: Author
    stranger: Author


@pytest.fixture
def team(authors: Any) -> Team:
    return Team(
        authors(name="Вера"),
        authors(name="Борис"),
        authors(name="Аня"),
        authors(name="Глеб"),
        authors(name="Дина"),
        authors(name="Чужой"),
    )


def _invite(owner: Author, project_id: str, who: Author, role: str) -> None:
    response = owner.post(f"/api/v1/projects/{project_id}/invitations", json={"email": who.email, "role": role})
    assert response.status_code == 201, response.text
    assert who.get("/api/v1/me").status_code == 200


def _story(team: Team) -> dict[str, str]:
    """A story of the owner with every kind of record and the team invited; the ids by name."""
    owner = team.owner
    story = owner.story()
    project_id, draft_id, script_id = story["project"]["id"], story["draft_id"], story["script_id"]
    assert owner.put(f"/api/v1/documents/{script_id}/text", json=TEXT, headers={"If-Match": "1"}).status_code == 200
    (character,) = owner.post(
        f"/api/v1/drafts/{draft_id}/documents", json={"kind": "character", "name": "Вера", "role": "main"}
    ).json()
    note = owner.post(f"/api/v1/projects/{project_id}/notes/files", files={"file": ("Мир.txt", "Озеро".encode())})
    assert note.status_code == 201, note.text
    chat = _upload(owner, project_id, "a.txt", b"text")
    assert chat.status_code == 201, chat.text
    thread_id = str(uuid.uuid4())
    thread = owner.post(
        f"/api/v1/documents/{script_id}/comments", json={"id": thread_id, "quote": "Вера молчит", "body": "Пауза"}
    )
    assert thread.status_code == 201, thread.text
    suggestion = owner.post(
        f"/api/v1/documents/{script_id}/suggestions",
        json={"id": str(uuid.uuid4()), "scene_uid": "s3", "quote": "Вера молчит", "text": "Вера уходит"},
    )
    assert suggestion.status_code == 201, suggestion.text
    point = owner.post(f"/api/v1/drafts/{draft_id}/points", json={"name": "до"})
    assert point.status_code == 201, point.text
    (version, *_) = owner.get(f"/api/v1/documents/{script_id}/versions?part=text").json()
    assert owner.put(f"/api/v1/drafts/{draft_id}/read-link").status_code == 200
    for who, role in (
        (team.coauthor, "coauthor"),
        (team.reviewer, "reviewer"),
        (team.reader, "reader"),
        (team.spare, "reader"),
    ):
        _invite(owner, project_id, who, role)
    pending = owner.post(
        f"/api/v1/projects/{project_id}/invitations", json={"email": "pending@example.com", "role": "reader"}
    )
    reviewer_thread_id = str(uuid.uuid4())
    reviewer_thread = team.reviewer.post(
        f"/api/v1/documents/{script_id}/comments",
        json={"id": reviewer_thread_id, "quote": "Вера молчит", "body": "Слишком прямо", "scene_uid": "s3"},
    )
    assert reviewer_thread.status_code == 201, reviewer_thread.text
    members = owner.get(f"/api/v1/projects/{project_id}/members").json()["members"]
    return {
        "project_id": project_id,
        "draft_id": draft_id,
        "script": script_id,
        "character": character["id"],
        "note_id": note.json()["id"],
        "file_id": chat.json()["id"],
        "thread_id": thread_id,
        "reviewer_thread": reviewer_thread_id,
        "reviewer_message": reviewer_thread.json()["messages"][0]["id"],
        "suggestion_id": suggestion.json()["id"],
        "point_id": point.json()["id"],
        "version_id": version["id"],
        "invitation_id": pending.json()["id"],
        "spare": next(m["user_id"] for m in members if m["email"] == team.spare.email),
    }


# Every story route and the smallest role it needs (design of story-sharing, decision 2). `ids` names which record
# of `_story` fills a parameter when it is not the one of the same name; `query` is added to the address.
@dataclass(frozen=True)
class Case:
    method: str
    path: str
    need: str
    ids: tuple[tuple[str, str], ...] = ()
    query: str = ""


SCRIPT = (("document_id", "script"),)
CHARACTER = (("document_id", "character"),)
REVIEWER_MESSAGE = (("thread_id", "reviewer_thread"), ("message_id", "reviewer_message"))
SPARE = (("user_id", "spare"),)

CASES = [
    Case("PATCH", "/projects/{project_id}", "edit"),
    Case("POST", "/projects/{project_id}/trash", "owner"),
    Case("POST", "/projects/{project_id}/restore", "owner"),
    Case("DELETE", "/projects/{project_id}", "owner"),
    Case("GET", "/projects/{project_id}/drafts", "read"),
    Case("POST", "/projects/{project_id}/drafts", "edit"),
    Case("PATCH", "/drafts/{draft_id}", "edit"),
    Case("POST", "/drafts/{draft_id}/trash", "edit"),
    Case("POST", "/drafts/{draft_id}/restore", "edit"),
    Case("DELETE", "/drafts/{draft_id}", "owner"),
    Case("POST", "/drafts/{draft_id}/open", "read"),
    Case("GET", "/drafts/{draft_id}/documents", "read"),
    Case("POST", "/drafts/{draft_id}/documents", "edit"),
    Case("POST", "/drafts/{draft_id}/import", "edit"),
    Case("POST", "/drafts/{draft_id}/trash/empty", "owner"),
    Case("GET", "/documents/{document_id}", "read", CHARACTER),
    Case("PATCH", "/documents/{document_id}", "edit", CHARACTER),
    Case("POST", "/documents/{document_id}/trash", "edit", CHARACTER),
    Case("POST", "/documents/{document_id}/restore", "edit", CHARACTER),
    Case("DELETE", "/documents/{document_id}", "owner", CHARACTER),
    Case("GET", "/documents/{document_id}/text", "read", SCRIPT),
    Case("PUT", "/documents/{document_id}/text", "edit", SCRIPT),
    Case("GET", "/projects/{project_id}/notes", "read"),
    Case("POST", "/projects/{project_id}/notes/files", "edit"),
    Case("POST", "/projects/{project_id}/notes", "edit"),
    Case("PATCH", "/notes/{note_id}", "edit"),
    Case("POST", "/notes/{note_id}/trash", "edit"),
    Case("POST", "/notes/{note_id}/restore", "edit"),
    Case("DELETE", "/notes/{note_id}", "owner"),
    Case("DELETE", "/notes/{note_id}/file", "owner"),
    Case("POST", "/notes/{note_id}/text-from-file", "edit"),
    Case("POST", "/projects/{project_id}/files", "review"),
    Case("GET", "/files/{file_id}", "read"),
    Case("GET", "/files/{file_id}/content", "read"),
    Case("POST", "/files/{file_id}/note", "edit"),
    # A file of the owner's conversation: the reviewer may delete only their own.
    Case("DELETE", "/files/{file_id}", "edit"),
    Case("GET", "/documents/{document_id}/comments", "read", SCRIPT),
    Case("POST", "/documents/{document_id}/comments", "review", SCRIPT),
    Case("POST", "/comments/{thread_id}/replies", "review"),
    Case("PATCH", "/comments/{thread_id}", "edit"),
    Case("PATCH", "/comments/{thread_id}/messages/{message_id}", "review", REVIEWER_MESSAGE),
    Case("DELETE", "/comments/{thread_id}/messages/{message_id}", "review", REVIEWER_MESSAGE),
    Case("GET", "/documents/{document_id}/suggestions", "read", SCRIPT),
    Case("POST", "/documents/{document_id}/suggestions", "review", SCRIPT),
    Case("PATCH", "/suggestions/{suggestion_id}", "edit"),
    Case("GET", "/documents/{document_id}/versions", "read", SCRIPT, "?part=text"),
    Case("GET", "/versions/{version_id}", "read"),
    Case("POST", "/versions/{version_id}/restore", "edit"),
    Case("GET", "/drafts/{draft_id}/points", "read"),
    Case("POST", "/drafts/{draft_id}/points", "edit"),
    Case("POST", "/points/{point_id}/restore", "edit"),
    Case("GET", "/drafts/{draft_id}/search", "read", (), "?q=Вера"),
    Case("GET", "/drafts/{draft_id}/writing", "read"),
    Case("GET", "/projects/{project_id}/members", "read"),
    Case("POST", "/projects/{project_id}/invitations", "owner"),
    Case("DELETE", "/invitations/{invitation_id}", "owner"),
    Case("PATCH", "/projects/{project_id}/members/{user_id}", "owner", SPARE),
    Case("DELETE", "/projects/{project_id}/members/{user_id}", "owner", SPARE),
    Case("GET", "/drafts/{draft_id}/read-link", "edit"),
    Case("PUT", "/drafts/{draft_id}/read-link", "edit"),
    Case("DELETE", "/drafts/{draft_id}/read-link", "edit"),
    Case("PUT", "/drafts/{draft_id}/presence", "edit"),
]

# Routes with a record of a story in the address that are not story routes: a run of the co-author is found by
# billing (app/api/feedback.py).
NOT_STORY_PARAMS = {"run_id"}


def test_every_story_route_is_in_the_table() -> None:
    # The routes as the app publishes them: FastAPI keeps included routers apart from `app.routes`.
    routes: set[tuple[str, str]] = set()
    for path, operations in product_app().openapi()["paths"].items():
        if not path.startswith("/api/v1/") or "{" not in path:
            continue
        if any(f"{{{name}}}" in path for name in NOT_STORY_PARAMS):
            continue
        routes |= {(method.upper(), path.removeprefix("/api/v1")) for method in operations}
    table = {(case.method, case.path) for case in CASES}
    assert routes - table == set(), "a story route without its role in CASES"
    assert table - routes == set(), "CASES name a route the app does not have"


def _call(author: Author, case: Case, ids: dict[str, str]) -> Any:
    names = dict(case.ids)
    path = case.path
    for name in [part.strip("{}") for part in path.split("/") if part.startswith("{")]:
        path = path.replace(f"{{{name}}}", ids[names.get(name, name)])
    url = f"/api/v1{path}{case.query}"
    if case.method in ("POST", "PATCH", "PUT") and not path.endswith(("/files", "/notes/files")):
        return author.request(case.method, url, json={})
    return author.request(case.method, url)


def test_every_story_route_checks_the_role(team: Team) -> None:
    people = {"reader": team.reader, "reviewer": team.reviewer, "coauthor": team.coauthor}
    wrong: list[str] = []
    for case in CASES:
        ids = _story(team)
        need = RANK[case.need]
        stranger = _call(team.stranger, case, ids)
        if stranger.status_code != 404:
            wrong.append(f"{case.method} {case.path}: stranger got {stranger.status_code}")
        for role, author in people.items():
            if ROLE_RANK[role] < need:
                response = _call(author, case, ids)
                if response.status_code != 403 or response.headers["content-type"] != PROBLEM:
                    wrong.append(f"{case.method} {case.path}: {role} got {response.status_code}, not 403")
        allowed = next((a for r, a in people.items() if ROLE_RANK[r] == need), team.owner)
        response = _call(allowed, case, ids)
        if response.status_code in (403, 404):
            wrong.append(f"{case.method} {case.path}: the smallest allowed role got {response.status_code}")
    assert wrong == []


def test_refusal_names_the_role(team: Team) -> None:
    ids = _story(team)
    response = team.reviewer.patch(f"/api/v1/documents/{ids['character']}", json={"summary": "x"})
    assert response.status_code == 403
    assert "рецензент" in response.json()["detail"]


# --- invitations and the shelf


def test_invited_reviewer_sees_the_story(team: Team) -> None:
    ids = _story(team)
    shelf = team.reviewer.get("/api/v1/projects").json()
    (story,) = [s for s in shelf if s["id"] == ids["project_id"]]
    assert (story["role"], story["owner_name"]) == ("reviewer", "Вера")
    (own,) = [s for s in team.owner.get("/api/v1/projects").json() if s["id"] == ids["project_id"]]
    assert own["role"] == "owner"


def test_members_and_invitations_by_role(team: Team) -> None:
    ids = _story(team)
    url = f"/api/v1/projects/{ids['project_id']}/members"
    seen = team.reviewer.get(url).json()
    assert [m["name"] for m in seen["members"]] == ["Вера", "Борис", "Аня", "Глеб", "Дина"]
    assert seen["invitations"] == []
    assert [i["email"] for i in team.owner.get(url).json()["invitations"]] == ["pending@example.com"]


def test_invitation_refusals(team: Team) -> None:
    ids = _story(team)
    url = f"/api/v1/projects/{ids['project_id']}/invitations"
    assert team.owner.post(url, json={"email": team.owner.email, "role": "reader"}).status_code == 422
    assert team.owner.post(url, json={"email": team.reviewer.email, "role": "reader"}).status_code == 409
    assert team.owner.post(url, json={"email": "PENDING@example.com", "role": "reader"}).status_code == 409
    assert team.owner.post(url, json={"email": "x@example.com", "role": "owner"}).status_code == 422


def test_leave_and_remove(team: Team) -> None:
    ids = _story(team)
    members = f"/api/v1/projects/{ids['project_id']}/members"
    reader_id = next(m["user_id"] for m in team.owner.get(members).json()["members"] if m["name"] == "Глеб")
    assert team.reader.delete(f"{members}/{reader_id}").status_code == 204
    assert ids["project_id"] not in [s["id"] for s in team.reader.get("/api/v1/projects").json()]
    assert team.reader.get(f"/api/v1/projects/{ids['project_id']}/drafts").status_code == 404
    owner_id = next(m["user_id"] for m in team.owner.get(members).json()["members"] if m["role"] == "owner")
    assert team.owner.delete(f"{members}/{owner_id}").status_code == 409
    coauthor_id = next(m["user_id"] for m in team.owner.get(members).json()["members"] if m["name"] == "Борис")
    assert team.coauthor.delete(f"{members}/{ids['spare']}").status_code == 403
    assert team.owner.patch(f"{members}/{coauthor_id}", json={"role": "reader"}).json()["role"] == "reader"
    assert team.coauthor.put(f"/api/v1/drafts/{ids['draft_id']}/presence").status_code == 403


def test_story_in_the_trash_is_gone_for_participants(team: Team) -> None:
    ids = _story(team)
    assert team.owner.post(f"/api/v1/projects/{ids['project_id']}/trash").status_code == 200
    assert team.coauthor.get(f"/api/v1/projects/{ids['project_id']}/drafts").status_code == 404
    assert ids["project_id"] not in [s["id"] for s in team.coauthor.get("/api/v1/projects?trash=true").json()]


# --- the link «почитать»


def test_link_opens_without_a_token(team: Team) -> None:
    ids = _story(team)
    key = team.coauthor.get(f"/api/v1/drafts/{ids['draft_id']}/read-link").json()["key"]
    response = team.owner.client.post("/api/v1/read-links/open", json={"key": key})
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["story_title"], body["draft_name"]) == ("Маяк", "Драфт 1")
    assert "Вера молчит." in str(body["content"]) and "comment" not in str(body["content"])
    assert response.headers["Cache-Control"] == "no-store"
    assert set(body) == {"story_title", "draft_name", "content"}
    assert team.owner.delete(f"/api/v1/drafts/{ids['draft_id']}/read-link").status_code == 204
    assert team.owner.client.post("/api/v1/read-links/open", json={"key": key}).status_code == 404
    assert team.owner.client.post("/api/v1/read-links/open", json={"key": key, "x": 1}).status_code == 422


# --- review by a reviewer


def test_reviewer_comments_only_with_an_anchor(team: Team) -> None:
    ids = _story(team)
    url = f"/api/v1/documents/{ids['script']}/comments"
    without = team.reviewer.post(url, json={"id": str(uuid.uuid4()), "quote": "Вера молчит", "body": "x"})
    assert without.status_code == 422
    text = team.owner.get(f"/api/v1/documents/{ids['script']}/text").json()
    assert text["revision"] == 2


def test_reviewer_suggestion_is_decided_by_the_owner(team: Team) -> None:
    ids = _story(team)
    made = team.reviewer.post(
        f"/api/v1/documents/{ids['script']}/suggestions",
        json={"id": str(uuid.uuid4()), "scene_uid": "s3", "quote": "Вера молчит", "text": "Вера отворачивается"},
    )
    assert made.status_code == 201, made.text
    assert (made.json()["author_kind"], made.json()["author_name"]) == ("user", "Аня")
    assert (
        team.reviewer.patch(f"/api/v1/suggestions/{made.json()['id']}", json={"status": "accepted"}).status_code == 403
    )
    decided = team.owner.patch(f"/api/v1/suggestions/{made.json()['id']}", json={"status": "accepted"})
    assert decided.json()["decided_by_name"] == "Вера"


def test_reviewer_deletes_own_chat_file_but_imports_nothing(team: Team) -> None:
    ids = _story(team)
    own = _upload(team.reviewer, ids["project_id"], "b.txt", b"text")
    assert own.status_code == 201, own.text
    assert team.reviewer.delete(f"/api/v1/files/{own.json()['id']}").status_code == 204
    manuscript = _upload(team.reviewer, ids["project_id"], "c.fountain", b"INT. HOUSE - DAY\n", purpose="import")
    assert manuscript.status_code == 403


# --- saves on an old revision


def test_conflict_names_who_saved_and_keeps_the_text(team: Team) -> None:
    ids = _story(team)
    url = f"/api/v1/documents/{ids['script']}/text"
    lost = {"type": "doc", "content": [SCENE, {"type": "action", "content": [{"type": "text", "text": "Ушла."}]}]}
    response = team.coauthor.put(url, json=lost, headers={"If-Match": "1"})
    assert response.status_code == 409
    assert (response.json()["saved_by"], response.json()["saved_by_me"]) == ("Вера", False)
    versions = team.owner.get(f"/api/v1/documents/{ids['script']}/versions?part=text").json()
    (kept,) = [v for v in versions if v["reason"] == "conflict"]
    assert team.owner.get(f"/api/v1/versions/{kept['id']}").json()["content"] == lost
    assert team.owner.get(url).json()["revision"] == 2
    own = team.owner.put(url, json=lost, headers={"If-Match": "1"})
    assert own.json()["saved_by_me"] is True


def test_locked_draft_gives_no_saved_by(team: Team) -> None:
    ids = _story(team)
    assert team.owner.patch(f"/api/v1/drafts/{ids['draft_id']}", json={"locked": True}).status_code == 200
    response = team.coauthor.put(f"/api/v1/documents/{ids['script']}/text", json=TEXT, headers={"If-Match": "2"})
    assert response.status_code == 409
    assert "saved_by" not in response.json()


# --- the place of the owner


def test_coauthor_upload_takes_the_owners_place(team: Team, monkeypatch: pytest.MonkeyPatch) -> None:
    ids = _story(team)
    asked: list[Any] = []

    def limit(user_id: Any, at: Any) -> int:
        asked.append(user_id)
        return 300 * 1024

    monkeypatch.setattr("app.api.notes.billing.storage_limit", limit)
    url = f"/api/v1/projects/{ids['project_id']}/notes/files"
    assert team.coauthor.post(url, files={"file": ("a.txt", b"a" * 200 * 1024)}).status_code == 201
    response = team.owner.post(url, files={"file": ("b.txt", b"b" * 200 * 1024)})
    assert response.status_code == 413
    owner_id = next(
        m["user_id"]
        for m in team.owner.get(f"/api/v1/projects/{ids['project_id']}/members").json()["members"]
        if m["role"] == "owner"
    )
    assert {str(user) for user in asked} == {owner_id}
    other = team.coauthor.story("Своя")
    assert (
        team.coauthor.post(
            f"/api/v1/projects/{other['project']['id']}/notes/files", files={"file": ("c.txt", b"c" * 200 * 1024)}
        ).status_code
        == 201
    )


# --- the co-author by the role of who asks


def _run(author: Author, project_id: str, draft_id: str) -> Any:
    from types import SimpleNamespace

    from agno.run import RunContext

    claims = {"sub": author.subject, "groups": ["screenwriters"]}
    authority = SimpleNamespace(context=SimpleNamespace(principal_id=author.subject, claims=claims))
    session_id = f"{project_id}:{draft_id}:{uuid.uuid4()}"
    return RunContext(run_id="r1", session_id=session_id, user_id=author.subject, authorization=authority)


def test_coauthor_of_a_reviewer_reads_and_suggests_but_does_not_change(team: Team) -> None:
    from agents.coauthor_tools import create_story_note, read_screenplay, suggest_edit

    ids = _story(team)
    run = _run(team.reviewer, ids["project_id"], ids["draft_id"])
    assert "Вера молчит" in read_screenplay(run)
    refused = create_story_note(run, "Мир", "Озеро")
    assert refused.startswith("Отказ:") and "рецензент" in refused
    assert [n["title"] for n in team.owner.get(f"/api/v1/projects/{ids['project_id']}/notes").json()] == ["Мир"]
    suggested = suggest_edit(run, "s3", "Вера молчит", "Вера отворачивается", "Действие")
    assert "отправлено автору" in suggested


def test_reader_has_no_chat(team: Team) -> None:
    from agno.exceptions import InputCheckError

    from agents.coauthor_usage import READER, refuse_reader

    ids = _story(team)
    with pytest.raises(InputCheckError) as refused:
        refuse_reader(_run(team.reader, ids["project_id"], ids["draft_id"]))
    assert refused.value.additional_data == {"reason": READER}
    refuse_reader(_run(team.reviewer, ids["project_id"], ids["draft_id"]))

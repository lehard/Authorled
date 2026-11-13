"""Participants, invitations, the link «почитать», presence and saves refused for an old revision, in the core
(openspec/specs/api/story-sharing; api/stories, «Снимок отклонённого сохранения»; core/database)."""

import uuid
from typing import Any

import pytest
from sqlalchemy import Connection, insert, text, update
from sqlalchemy.exc import IntegrityError

from core import members, presence, read_links
from core.documents import create_documents, update_document
from core.drafts import trash_draft, update_draft
from core.errors import Conflict, Forbidden, Invalid, Locked, NotFound, RevisionConflict
from core.projects import create_project, list_projects, trash_project
from core.review import create_user_suggestion, list_suggestions
from core.saves import list_versions
from core.tables import document_versions, draft_presence, draft_read_links, project_invitations, project_members
from core.tables import suggestions as suggestion_table
from core.texts import get_text, heading, put_text
from core.users import get_or_create_user


def _user(connection: Connection, name: str) -> uuid.UUID:
    return get_or_create_user(connection, f"sub-{name}", f"{name}@authorled.test", name.capitalize()).id


def _p(kind: str, words: str, marks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"type": "text", "text": words}
    if marks:
        node["marks"] = marks
    return {"type": kind, "content": [node]}


def _story(connection: Connection) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
    """Vera's story «Маяк» with scene s3 «Вера молчит.»: the owner, the story, the draft and the screenplay."""
    vera = _user(connection, "vera")
    project, draft_id, script_id = create_project(connection, vera, "Маяк")
    put_text(
        connection,
        script_id,
        1,
        {"type": "doc", "content": [heading("s3", "НАТ. ОЗЕРО — ДЕНЬ"), _p("action", "Вера молчит.")]},
        vera,
    )
    return vera, project.id, draft_id, script_id


# --- roles


def test_roles_are_nested() -> None:
    assert members.allows("reviewer", "review") and not members.allows("reviewer", "edit")
    assert members.allows("coauthor", "edit") and not members.allows("coauthor", "owner")
    assert members.allows("owner", "owner") and not members.allows("reader", "review")
    with pytest.raises(Forbidden, match="рецензент"):
        members.require("reviewer", "edit")


def test_role_of_each_participant(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    anya, boris, gleb = _user(connection, "anya"), _user(connection, "boris"), _user(connection, "gleb")
    members.add_member(connection, project_id, anya, "reviewer", vera)
    members.add_member(connection, project_id, boris, "coauthor", vera)
    assert members.role_of(connection, vera, project_id) == "owner"
    assert members.role_of(connection, anya, project_id) == "reviewer"
    assert members.role_of(connection, boris, project_id) == "coauthor"
    assert members.role_of(connection, gleb, project_id) is None
    assert members.role_of_subject(connection, "sub-anya", project_id) == "reviewer"
    assert members.role_of_subject(connection, "nobody", project_id) is None


def test_story_in_the_trash_is_its_owners_only(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    anya = _user(connection, "anya")
    members.add_member(connection, project_id, anya, "coauthor", vera)
    trash_project(connection, project_id)
    assert members.role_of(connection, vera, project_id) == "owner"
    assert members.role_of(connection, anya, project_id) is None


# --- the shelf


def test_shelf_shows_the_stories_of_a_participant(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    anya = _user(connection, "anya")
    own, _, _ = create_project(connection, anya, "Паром")
    members.add_member(connection, project_id, anya, "reviewer", vera)
    shelf = {p.title: (p.role, p.owner_name) for p in list_projects(connection, anya, trash=False)}
    assert shelf == {"Маяк": ("reviewer", "Vera"), "Паром": ("owner", "Anya")}
    trash_project(connection, project_id)
    assert [p.id for p in list_projects(connection, anya, trash=False)] == [own.id]
    assert list_projects(connection, anya, trash=True) == []


# --- invitations and participants


def test_invitation_becomes_participation(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    invitation = members.invite(connection, project_id, vera, "  Anya@AuthorLed.test ", "reviewer")
    assert (invitation.email, invitation.role) == ("anya@authorled.test", "reviewer")
    assert [i.email for i in members.invitations(connection, project_id)] == ["anya@authorled.test"]
    anya = _user(connection, "anya")
    assert members.accept_invitations(connection, anya) == 1
    assert members.role_of(connection, anya, project_id) == "reviewer"
    assert members.invitations(connection, project_id) == []
    assert [m.role for m in members.members(connection, project_id)] == ["owner", "reviewer"]


def test_invitation_refusals(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    with pytest.raises(Invalid, match="владельца"):
        members.invite(connection, project_id, vera, "VERA@authorled.test", "reader")
    with pytest.raises(Invalid):
        members.invite(connection, project_id, vera, "not an e-mail", "reader")
    with pytest.raises(Invalid):
        members.invite(connection, project_id, vera, "anya@authorled.test", "owner")
    members.invite(connection, project_id, vera, "anya@authorled.test", "reader")
    with pytest.raises(Conflict):
        members.invite(connection, project_id, vera, "ANYA@authorled.test", "coauthor")
    boris = _user(connection, "boris")
    members.add_member(connection, project_id, boris, "reader", vera)
    with pytest.raises(Conflict, match="участник"):
        members.invite(connection, project_id, vera, "boris@authorled.test", "reader")


def test_invitation_into_a_story_in_the_trash_waits(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    members.invite(connection, project_id, vera, "anya@authorled.test", "reader")
    trash_project(connection, project_id)
    anya = _user(connection, "anya")
    assert members.accept_invitations(connection, anya) == 0
    assert [i.email for i in members.invitations(connection, project_id)] == ["anya@authorled.test"]


def test_change_remove_and_revoke(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    anya = _user(connection, "anya")
    members.add_member(connection, project_id, anya, "reader", vera)
    assert members.change_role(connection, project_id, anya, "coauthor").role == "coauthor"
    with pytest.raises(Conflict):
        members.change_role(connection, project_id, vera, "reader")
    with pytest.raises(Conflict):
        members.remove(connection, project_id, vera)
    members.remove(connection, project_id, anya)
    assert members.role_of(connection, anya, project_id) is None
    with pytest.raises(NotFound):
        members.remove(connection, project_id, anya)
    invitation = members.invite(connection, project_id, vera, "gleb@authorled.test", "reader")
    members.revoke(connection, invitation.id)
    assert members.invitations(connection, project_id) == []


# --- tables


def test_tables_refuse_broken_rows(connection: Connection) -> None:
    vera, project_id, draft_id, _ = _story(connection)
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(
            insert(project_members).values(project_id=project_id, user_id=vera, role="owner", added_by=vera)
        )
    members.invite(connection, project_id, vera, "anya@authorled.test", "reader")
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(
            insert(project_invitations).values(
                project_id=project_id, email="anya@authorled.test", role="reader", invited_by=vera
            )
        )
    read_links.ensure_link(connection, draft_id, vera)
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(insert(draft_read_links).values(draft_id=draft_id, key="other", created_by=vera))


def test_suggestion_of_a_user_needs_its_author(connection: Connection) -> None:
    _, _, _, script_id = _story(connection)
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(
            insert(suggestion_table).values(
                document_id=script_id, scene_uid="s3", quote="Вера", text="Аня", why="", author_kind="user"
            )
        )


def test_snapshot_of_a_conflict_is_accepted(connection: Connection) -> None:
    vera, _, _, script_id = _story(connection)
    connection.execute(
        insert(document_versions).values(
            document_id=script_id, part="text", content={}, reason="conflict", saved_by=vera, saved_at=text("now()")
        )
    )


def test_participants_go_with_the_story(connection: Connection) -> None:
    vera, project_id, _, _ = _story(connection)
    anya = _user(connection, "anya")
    members.add_member(connection, project_id, anya, "reader", vera)
    connection.execute(text("DELETE FROM authorled.projects WHERE id = :id"), {"id": project_id})
    assert connection.execute(project_members.select()).all() == []


# --- the link «почитать»


def test_link_gives_the_screenplay_only(connection: Connection) -> None:
    vera, _, draft_id, script_id = _story(connection)
    marked = _p(
        "action",
        "Вера молчит.",
        [{"type": "comment", "attrs": {"id": "c1"}}, {"type": "suggestion", "attrs": {"id": "s1"}}, {"type": "bold"}],
    )
    put_text(connection, script_id, 2, {"type": "doc", "content": [heading("s3", "НАТ. ОЗЕРО — ДЕНЬ"), marked]}, vera)
    link = read_links.ensure_link(connection, draft_id, vera)
    assert len(link.key) >= 22
    assert read_links.ensure_link(connection, draft_id, vera).key == link.key
    shared = read_links.open_link(connection, link.key)
    assert (shared.story_title, shared.draft_name) == ("Маяк", "Драфт 1")
    action = shared.content["content"][1]["content"][0]
    assert action["text"] == "Вера молчит." and action["marks"] == [{"type": "bold"}]


def test_link_turned_off_or_in_the_trash(connection: Connection) -> None:
    vera, project_id, draft_id, _ = _story(connection)
    old = read_links.ensure_link(connection, draft_id, vera)
    read_links.remove_link(connection, draft_id)
    with pytest.raises(NotFound):
        read_links.open_link(connection, old.key)
    new = read_links.ensure_link(connection, draft_id, vera)
    assert new.key != old.key
    trash_project(connection, project_id)
    with pytest.raises(NotFound):
        read_links.open_link(connection, new.key)
    with pytest.raises(NotFound):
        read_links.open_link(connection, "")


def test_link_of_a_draft_in_the_trash(connection: Connection) -> None:
    vera, project_id, draft_id, _ = _story(connection)
    from core.drafts import create_draft

    second = create_draft(connection, project_id, "Драфт 2", draft_id, vera)
    link = read_links.ensure_link(connection, second.id, vera)
    trash_draft(connection, second.id)
    with pytest.raises(NotFound):
        read_links.open_link(connection, link.key)


# --- presence


def test_presence_names_the_others_marked_lately(connection: Connection) -> None:
    vera, project_id, draft_id, _ = _story(connection)
    anya = _user(connection, "anya")
    members.add_member(connection, project_id, anya, "coauthor", vera)
    assert presence.mark(connection, draft_id, vera) == []
    assert presence.mark(connection, draft_id, anya) == ["Vera"]
    assert presence.mark(connection, draft_id, anya) == ["Vera"]
    assert connection.execute(draft_presence.select()).all().__len__() == 2
    connection.execute(
        update(draft_presence)
        .where(draft_presence.c.user_id == vera)
        .values(seen_at=text("now() - interval '90 seconds'"))
    )
    assert presence.mark(connection, draft_id, anya) == []


# --- saves on an old revision


def test_old_text_revision_names_who_saved(connection: Connection) -> None:
    vera, _, _, script_id = _story(connection)
    boris = _user(connection, "boris")
    doc = {"type": "doc", "content": [heading("s3", "НАТ. ОЗЕРО — ДЕНЬ"), _p("action", "Вера уходит.")]}
    with pytest.raises(RevisionConflict) as refused:
        put_text(connection, script_id, 1, doc, boris)
    assert (refused.value.saved_by, refused.value.saved_by_me) == ("Vera", False)
    assert (refused.value.part, refused.value.content) == ("text", doc)
    with pytest.raises(RevisionConflict) as own:
        put_text(connection, script_id, 1, doc, vera)
    assert own.value.saved_by_me is True


def test_old_document_revision_carries_the_passed_fields(connection: Connection) -> None:
    vera, _, draft_id, _ = _story(connection)
    (character,) = create_documents(connection, draft_id, [{"kind": "character", "name": "Вера", "role": "main"}], vera)
    update_document(connection, character.id, 1, {"summary": "Смотритель"}, vera)
    with pytest.raises(RevisionConflict) as refused:
        update_document(connection, character.id, 1, {"summary": "Рыбачка"}, vera)
    assert refused.value.part == "fields"
    assert refused.value.content is not None and refused.value.content["summary"] == "Рыбачка"
    assert refused.value.content["name"] == "Вера"
    with pytest.raises(RevisionConflict) as position:
        update_document(connection, character.id, 1, {"position": 0}, vera)
    assert position.value.content is None


def test_keep_refused_writes_a_snapshot_of_the_caller(connection: Connection) -> None:
    from core.snapshots import keep_refused

    vera, _, _, script_id = _story(connection)
    anya = _user(connection, "anya")
    doc = {"type": "doc", "content": [heading("s3", "НАТ. ОЗЕРО — ДЕНЬ"), _p("action", "Вера уходит.")]}
    with pytest.raises(RevisionConflict) as refused:
        put_text(connection, script_id, 1, doc, anya)
    keep_refused(connection, script_id, refused.value, anya)
    (kept,) = [v for v in list_versions(connection, script_id, "text") if v.reason == "conflict"]
    assert (kept.content, kept.saved_by) == (doc, anya)
    assert get_text(connection, script_id).revision == 2


def test_locked_draft_is_no_revision_conflict(connection: Connection) -> None:
    vera, _, draft_id, script_id = _story(connection)
    update_draft(connection, draft_id, {"locked": True})
    with pytest.raises(Locked) as refused:
        put_text(connection, script_id, 1, get_text(connection, script_id).content, vera)
    assert not isinstance(refused.value, RevisionConflict)


# --- suggestions of participants


def test_suggestion_of_a_reviewer(connection: Connection) -> None:
    vera, project_id, _, script_id = _story(connection)
    anya = _user(connection, "anya")
    members.add_member(connection, project_id, anya, "reviewer", vera)
    mark = uuid.uuid4()
    made = create_user_suggestion(
        connection, script_id, mark, "s3", "Вера молчит", "Вера отворачивается", " Действие вместо паузы ", anya
    )
    assert (made.id, made.author_kind, made.author_name, made.session_id) == (mark, "user", "Anya", None)
    assert made.why == "Действие вместо паузы"
    assert get_text(connection, script_id).revision == 2
    assert [s.id for s in list_suggestions(connection, script_id, "open")] == [mark]
    with pytest.raises(Conflict):
        create_user_suggestion(connection, script_id, mark, "s3", "Вера молчит", "x", "", anya)


@pytest.mark.parametrize(
    ("scene", "quote", "words"),
    [("s3", "Вера кричит", "x"), ("s9", "Вера молчит", "x"), ("s3", "", "x"), ("s3", "Вера молчит", " ")],
)
def test_suggestion_of_a_reviewer_refused(connection: Connection, scene: str, quote: str, words: str) -> None:
    vera, _, _, script_id = _story(connection)
    with pytest.raises(Invalid):
        create_user_suggestion(connection, script_id, uuid.uuid4(), scene, quote, words, "", vera)

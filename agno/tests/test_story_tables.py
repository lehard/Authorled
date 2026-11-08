"""Tables of the stories (openspec/specs/core/database: «Таблица историй» … «Таблицы файлов»)."""

import uuid

import pytest
from sqlalchemy import Connection, delete, func, insert, inspect, select
from sqlalchemy.exc import IntegrityError

from core.tables import (
    SCHEMA,
    comment_messages,
    comment_threads,
    document_versions,
    documents,
    draft_opens,
    draft_points,
    drafts,
    file_contents,
    files,
    projects,
    screenplay_texts,
    suggestions,
    users,
)


def _user(connection: Connection) -> uuid.UUID:
    return connection.execute(
        insert(users)
        .values(auth_subject="s1", email="writer@authorled.test", display_name="Сценарист")
        .returning(users.c.id)
    ).scalar_one()


def _project(connection: Connection, owner_id: uuid.UUID) -> uuid.UUID:
    return connection.execute(
        insert(projects).values(owner_id=owner_id, title="Маяк", format="feature").returning(projects.c.id)
    ).scalar_one()


def _draft(connection: Connection, project_id: uuid.UUID, name: str = "Драфт 1") -> uuid.UUID:
    """The draft of that name, made once."""
    found = connection.execute(
        select(drafts.c.id).where(drafts.c.project_id == project_id, drafts.c.name == name)
    ).scalar_one_or_none()
    if found is not None:
        return found
    return connection.execute(
        insert(drafts).values(project_id=project_id, name=name).returning(drafts.c.id)
    ).scalar_one()


def _owner_of(connection: Connection, project_id: uuid.UUID) -> uuid.UUID:
    return connection.execute(select(projects.c.owner_id).where(projects.c.id == project_id)).scalar_one()


def _document(
    connection: Connection, project_id: uuid.UUID, kind: str, role: str | None = None, draft: str = "Драфт 1"
) -> uuid.UUID:
    return connection.execute(
        insert(documents)
        .values(
            project_id=project_id,
            draft_id=_draft(connection, project_id, draft),
            kind=kind,
            name="Документ",
            role=role,
            position=0,
            updated_by=_owner_of(connection, project_id),
        )
        .returning(documents.c.id)
    ).scalar_one()


def _version(connection: Connection, document: uuid.UUID, owner: uuid.UUID, reason: str = "auto") -> None:
    connection.execute(
        insert(document_versions).values(
            document_id=document, part="text", content={}, reason=reason, saved_by=owner, saved_at=func.now()
        )
    )


def test_projects_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("projects", schema=SCHEMA)]
    assert columns == ["id", "owner_id", "title", "description", "format", "created_at", "updated_at", "deleted_at"]


def test_unknown_format_is_rejected(connection: Connection) -> None:
    owner = _user(connection)
    with pytest.raises(IntegrityError, match="ck_projects_format_known"):
        connection.execute(insert(projects).values(owner_id=owner, title="Маяк", format="novel"))


def test_second_script_is_rejected(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    _document(connection, project, "script")
    with pytest.raises(IntegrityError, match="ix_documents_one_script"):
        _document(connection, project, "script")


def test_script_in_trash_still_counts(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    script = _document(connection, project, "script")
    connection.execute(documents.update().where(documents.c.id == script).values(deleted_at=func.now()))
    with pytest.raises(IntegrityError, match="ix_documents_one_script"):
        _document(connection, project, "script")


def test_world_with_role_is_rejected(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    with pytest.raises(IntegrityError, match="ck_documents_role_by_kind"):
        _document(connection, project, "world", role="main")


def test_character_without_role_is_rejected(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    with pytest.raises(IntegrityError, match="ck_documents_role_by_kind"):
        _document(connection, project, "character")


def test_fields_must_be_an_object(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    with pytest.raises(IntegrityError, match="ck_documents_fields_object"):
        connection.execute(
            insert(documents).values(
                project_id=project,
                draft_id=_draft(connection, project),
                kind="world",
                name="Мир",
                position=0,
                fields=["a"],
                updated_by=_owner_of(connection, project),
            )
        )


def test_decision_needs_its_time(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    script = _document(connection, project, "script")
    with pytest.raises(IntegrityError, match="ck_suggestions_decided_when_closed"):
        connection.execute(
            insert(suggestions).values(
                document_id=script,
                scene_uid="s1",
                quote="Вера молчит",
                text="",
                why="",
                status="accepted",
                session_id=f"{project}:1",
            )
        )


def test_chat_file_needs_a_session(connection: Connection) -> None:
    owner = _user(connection)
    project = _project(connection, owner)
    with pytest.raises(IntegrityError, match="ck_files_session_for_chat"):
        connection.execute(
            insert(files).values(
                project_id=project,
                uploaded_by=owner,
                purpose="chat",
                name="a.txt",
                media_type="text/plain",
                size_bytes=1,
                sha256="0" * 64,
                text_content="a",
            )
        )


def test_messages_go_with_their_thread(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    thread = uuid.uuid4()
    connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера"))
    for body in ("Слишком прямо", "Согласен"):
        connection.execute(
            insert(comment_messages).values(
                thread_id=thread, author_kind="user", author_id=owner, author_role="", body=body
            )
        )
    connection.execute(delete(comment_threads).where(comment_threads.c.id == thread))
    assert connection.execute(select(func.count()).select_from(comment_messages)).scalar_one() == 0


def test_message_of_the_coauthor_has_no_user(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    thread = uuid.uuid4()
    connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера", scene_uid="s3"))
    connection.execute(
        insert(comment_messages).values(thread_id=thread, author_kind="coauthor", author_role="", body="Пауза")
    )
    with pytest.raises(IntegrityError, match="ck_comment_messages_author_of_kind"):
        connection.execute(
            insert(comment_messages).values(
                thread_id=thread, author_kind="coauthor", author_id=owner, author_role="", body="Пауза"
            )
        )


def test_message_of_a_user_names_the_user(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    thread = uuid.uuid4()
    connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера"))
    with pytest.raises(IntegrityError, match="ck_comment_messages_author_of_kind"):
        connection.execute(
            insert(comment_messages).values(thread_id=thread, author_kind="user", author_role="", body="Пауза")
        )


@pytest.mark.parametrize(("kind", "scene"), [("robot", None), ("user", "")])
def test_unknown_author_kind_and_empty_scene_are_rejected(connection: Connection, kind: str, scene: str | None) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    thread = uuid.uuid4()
    with pytest.raises(IntegrityError, match="ck_comment_"):
        connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера", scene_uid=scene))
        connection.execute(
            insert(comment_messages).values(
                thread_id=thread, author_kind=kind, author_id=owner, author_role="", body="Пауза"
            )
        )


def test_story_deletion_cascades(connection: Connection) -> None:
    owner = _user(connection)
    project = _project(connection, owner)
    script = _document(connection, project, "script")
    _document(connection, project, "character", role="main")
    connection.execute(
        insert(screenplay_texts).values(document_id=script, content={"type": "doc", "content": []}, updated_by=owner)
    )
    thread = uuid.uuid4()
    connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера"))
    connection.execute(
        insert(comment_messages).values(
            thread_id=thread, author_kind="user", author_id=owner, author_role="", body="Да"
        )
    )
    connection.execute(
        insert(suggestions).values(
            document_id=script, scene_uid="s1", quote="Вера", text="Вера Андреевна", why="", session_id=f"{project}:1"
        )
    )
    file_id = connection.execute(
        insert(files)
        .values(
            project_id=project,
            uploaded_by=owner,
            purpose="import",
            name="a.txt",
            media_type="text/plain",
            size_bytes=1,
            sha256="0" * 64,
            text_content="a",
        )
        .returning(files.c.id)
    ).scalar_one()
    connection.execute(insert(file_contents).values(file_id=file_id, bytes=b"a"))
    draft = _draft(connection, project)
    connection.execute(
        insert(draft_points).values(draft_id=draft, name="Т", kind="manual", content={}, created_by=owner)
    )
    connection.execute(insert(draft_opens).values(user_id=owner, project_id=project, draft_id=draft))
    _version(connection, script, owner)

    connection.execute(delete(projects).where(projects.c.id == project))

    for table in (
        drafts,
        documents,
        screenplay_texts,
        document_versions,
        draft_points,
        draft_opens,
        comment_threads,
        comment_messages,
        suggestions,
        files,
        file_contents,
    ):
        assert connection.execute(select(func.count()).select_from(table)).scalar_one() == 0, table.name


def test_user_with_a_story_cannot_be_deleted(connection: Connection) -> None:
    owner = _user(connection)
    _project(connection, owner)
    with pytest.raises(IntegrityError, match="fk_projects_owner_id_users"):
        connection.execute(delete(users).where(users.c.id == owner))


def test_script_in_each_draft(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    _document(connection, project, "script")
    _document(connection, project, "script", draft="Драфт 2")


def test_document_of_another_story_is_rejected(connection: Connection) -> None:
    owner = _user(connection)
    first, second = _project(connection, owner), _project(connection, owner)
    with pytest.raises(IntegrityError, match="fk_documents_draft_id_drafts"):
        connection.execute(
            insert(documents).values(
                project_id=second,
                draft_id=_draft(connection, first),
                kind="world",
                name="Мир",
                position=0,
                updated_by=owner,
            )
        )


def test_contents_go_with_their_draft(connection: Connection) -> None:
    owner = _user(connection)
    project = _project(connection, owner)
    script = _document(connection, project, "script")
    connection.execute(
        insert(screenplay_texts).values(document_id=script, content={"type": "doc", "content": []}, updated_by=owner)
    )
    connection.execute(delete(drafts).where(drafts.c.id == _draft(connection, project)))
    for table in (documents, screenplay_texts):
        assert connection.execute(select(func.count()).select_from(table)).scalar_one() == 0, table.name


def test_base_may_go_and_the_name_stays(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    base = _draft(connection, project)
    copy = connection.execute(
        insert(drafts)
        .values(project_id=project, name="Драфт 2", forked_from_id=base, forked_from_name="Драфт 1")
        .returning(drafts.c.id)
    ).scalar_one()
    connection.execute(delete(drafts).where(drafts.c.id == base))
    row = connection.execute(select(drafts).where(drafts.c.id == copy)).one()
    assert (row.forked_from_id, row.forked_from_name) == (None, "Драфт 1")


def test_unknown_reason_is_rejected(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    with pytest.raises(IntegrityError, match="ck_document_versions_reason_known"):
        _version(connection, script, owner, "manual")


def test_snapshot_before_a_change_of_the_coauthor(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    _version(connection, script, owner, "coauthor")


def test_snapshots_go_with_their_document(connection: Connection) -> None:
    owner = _user(connection)
    script = _document(connection, _project(connection, owner), "script")
    _version(connection, script, owner)
    connection.execute(delete(documents).where(documents.c.id == script))
    assert connection.execute(select(func.count()).select_from(document_versions)).scalar_one() == 0


def test_point_needs_a_name(connection: Connection) -> None:
    owner = _user(connection)
    draft = _draft(connection, _project(connection, owner))
    with pytest.raises(IntegrityError, match="ck_draft_points_name_not_empty"):
        connection.execute(
            insert(draft_points).values(draft_id=draft, name="", kind="manual", content={}, created_by=owner)
        )


def test_one_open_draft_per_user_and_story(connection: Connection) -> None:
    owner = _user(connection)
    project = _project(connection, owner)
    draft = _draft(connection, project)
    connection.execute(insert(draft_opens).values(user_id=owner, project_id=project, draft_id=draft))
    with pytest.raises(IntegrityError, match="pk_draft_opens"):
        connection.execute(insert(draft_opens).values(user_id=owner, project_id=project, draft_id=draft))


def test_old_kind_draft_is_rejected(connection: Connection) -> None:
    project = _project(connection, _user(connection))
    with pytest.raises(IntegrityError, match="ck_documents_kind_known"):
        _document(connection, project, "draft")

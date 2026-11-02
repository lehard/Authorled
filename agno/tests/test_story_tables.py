"""Tables of the stories (openspec/specs/core/database: «Таблица историй» … «Таблицы файлов»)."""

import uuid

import pytest
from sqlalchemy import Connection, delete, func, insert, inspect, select
from sqlalchemy.exc import IntegrityError

from core.tables import (
    SCHEMA,
    comment_messages,
    comment_threads,
    documents,
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


def _document(connection: Connection, project_id: uuid.UUID, kind: str, role: str | None = None) -> uuid.UUID:
    return connection.execute(
        insert(documents)
        .values(project_id=project_id, kind=kind, name="Документ", role=role, position=0)
        .returning(documents.c.id)
    ).scalar_one()


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
            insert(documents).values(project_id=project, kind="world", name="Мир", position=0, fields=["a"])
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
            insert(comment_messages).values(thread_id=thread, author_id=owner, author_role="", body=body)
        )
    connection.execute(delete(comment_threads).where(comment_threads.c.id == thread))
    assert connection.execute(select(func.count()).select_from(comment_messages)).scalar_one() == 0


def test_story_deletion_cascades(connection: Connection) -> None:
    owner = _user(connection)
    project = _project(connection, owner)
    script = _document(connection, project, "script")
    _document(connection, project, "character", role="main")
    connection.execute(insert(screenplay_texts).values(document_id=script, content={"type": "doc", "content": []}))
    thread = uuid.uuid4()
    connection.execute(insert(comment_threads).values(id=thread, document_id=script, quote="Вера"))
    connection.execute(insert(comment_messages).values(thread_id=thread, author_id=owner, author_role="", body="Да"))
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

    connection.execute(delete(projects).where(projects.c.id == project))

    for table in (documents, screenplay_texts, comment_threads, comment_messages, suggestions, files, file_contents):
        assert connection.execute(select(func.count()).select_from(table)).scalar_one() == 0, table.name


def test_user_with_a_story_cannot_be_deleted(connection: Connection) -> None:
    owner = _user(connection)
    _project(connection, owner)
    with pytest.raises(IntegrityError, match="fk_projects_owner_id_users"):
        connection.execute(delete(users).where(users.c.id == owner))

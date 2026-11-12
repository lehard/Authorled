"""Tables of the library of sources (openspec/specs/core/database, «Таблица книг библиотеки», «Таблица кусков
библиотеки»)."""

import uuid
from typing import Any

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, delete, func, insert, inspect, select, text
from sqlalchemy.exc import DataError, IntegrityError, StatementError

from core.projects import create_project
from core.tables import SCHEMA, notes, projects, source_books, source_fragments, users
from tests.test_migrations import _upgrade

VECTOR = [0.0] * 1023 + [1.0]


def _book(connection: Connection, slug: str = "impro", **values: Any) -> uuid.UUID:
    row = {"slug": slug, "title": "Impro", "authors": ["Keith Johnstone"], "language": "en"}
    row.update(values)
    return connection.execute(
        insert(source_books).values(embedding_model="giga-embeddings", **row).returning(source_books.c.id)
    ).scalar_one()


def _fragment(connection: Connection, book: uuid.UUID, position: int = 0, embedding: list[float] = VECTOR) -> None:
    connection.execute(
        insert(source_fragments).values(
            book_id=book,
            position=position,
            path=["Status"],
            content="A status is something one does.",
            ts_config="english",
            embedding=embedding,
        )
    )


def test_book_columns(connection: Connection) -> None:
    columns = [column["name"] for column in inspect(connection).get_columns("source_books", schema=SCHEMA)]
    assert columns == [
        "id",
        "slug",
        "title",
        "authors",
        "language",
        "original_year",
        "edition_year",
        "translator",
        "translation_year",
        "original_title",
        "embedding_model",
        "loaded_at",
    ]


def test_second_book_with_the_same_slug_is_refused(connection: Connection) -> None:
    _book(connection)
    with pytest.raises(IntegrityError, match="uq_source_books_slug"):
        _book(connection)


def test_unknown_language_is_refused(connection: Connection) -> None:
    with pytest.raises(IntegrityError, match="ck_source_books_language_known"):
        _book(connection, language="de")


def test_book_without_authors_is_refused(connection: Connection) -> None:
    with pytest.raises(IntegrityError, match="ck_source_books_authors_not_empty"):
        _book(connection, authors=[])


def test_fragments_go_with_their_book(connection: Connection) -> None:
    book = _book(connection)
    _fragment(connection, book)
    connection.execute(delete(source_books).where(source_books.c.id == book))
    left = connection.execute(select(func.count()).select_from(source_fragments)).scalar_one()
    assert left == 0


def test_fragment_gets_the_words_of_its_language(connection: Connection) -> None:
    _fragment(connection, _book(connection))
    found = connection.execute(
        select(func.count())
        .select_from(source_fragments)
        .where(source_fragments.c.tsv.op("@@")(func.to_tsquery("english", "statuses")))
    ).scalar_one()
    assert found == 1


def test_vector_of_another_size_is_refused(connection: Connection) -> None:
    book = _book(connection)
    with pytest.raises((DataError, StatementError), match="1024"):
        _fragment(connection, book, embedding=[0.5] * 768)


def test_sources_migration_keeps_stories(
    engine: Engine, alembic_config: Config, billing_alembic_config: Config
) -> None:
    """Applied from 0017 on a database with a story and a note: they stay, the tables of the library are empty."""
    subject = f"test-{uuid.uuid4()}"
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE authorled.source_fragments, authorled.source_books"))
        connection.execute(text("UPDATE authorled.alembic_version SET version_num = '0017_drop_note_research'"))
        owner = connection.execute(
            insert(users)
            .values(auth_subject=subject, email="sources@authorled.test", display_name="Автор")
            .returning(users.c.id)
        ).scalar_one()
        story, _, _ = create_project(connection, owner, "Маяк")
        connection.execute(insert(notes).values(project_id=story.id, title="Финал", updated_by=owner))

    _upgrade(alembic_config, billing_alembic_config)

    with engine.begin() as connection:
        assert connection.execute(select(projects.c.title).where(projects.c.id == story.id)).scalar_one() == "Маяк"
        assert connection.execute(select(notes.c.title).where(notes.c.project_id == story.id)).scalar_one() == "Финал"
        for table in (source_books, source_fragments):
            assert connection.execute(select(func.count()).select_from(table)).scalar_one() == 0
        connection.execute(delete(projects).where(projects.c.id == story.id))
        connection.execute(text("DELETE FROM billing.subscriptions WHERE user_id = :owner"), {"owner": owner})
        connection.execute(delete(users).where(users.c.id == owner))

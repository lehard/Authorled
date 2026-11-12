"""Loading the canon (openspec/specs/sources/library, «Загрузка и замена книги»): a failed model keeps the old book."""

from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, select

from core.sources import parse_canon, remove_book, save_book
from core.tables import source_books, source_fragments
from sources import __main__ as commands

CANON = "---\ntitle: Книга\nauthors: [Автор]\nlanguage: ru\n---\n\n# Глава\n\n{text}\n"


def test_failed_model_keeps_the_book(tmp_path: Path, engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    old = parse_canon("test-load-book.md", CANON.format(text="Старый текст."))
    with engine.begin() as connection:
        save_book(connection, old, [[1.0] + [0.0] * 1023], "giga-embeddings")
    (tmp_path / "test-load-book.md").write_text(CANON.format(text="Новый текст."), encoding="utf-8")

    class Broken:
        def embed_batch(self, texts: list[str]) -> list[list[float]]:
            raise RuntimeError("proxy is down")

    monkeypatch.setattr(commands, "embedder", lambda: Broken())
    monkeypatch.setattr(commands, "embeddings_model", lambda: "giga-embeddings")
    try:
        with pytest.raises(RuntimeError, match="proxy is down"):
            commands.main(["load", str(tmp_path)])
        with engine.connect() as connection:
            contents = connection.execute(
                select(source_fragments.c.content)
                .join(source_books, source_books.c.id == source_fragments.c.book_id)
                .where(source_books.c.slug == "test-load-book")
            ).scalars()
            assert list(contents) == ["Старый текст."]
    finally:
        with engine.begin() as connection:
            remove_book(connection, "test-load-book")


def test_drafts_are_not_loaded(tmp_path: Path, capsys: Any) -> None:
    (tmp_path / "drafts").mkdir()
    (tmp_path / "drafts" / "draft.md").write_text("без шапки", encoding="utf-8")
    (tmp_path / "book.md").write_text(CANON.format(text="Текст."), encoding="utf-8")
    assert commands.main(["check", str(tmp_path)]) == 0
    assert capsys.readouterr().out == "book: 1 кусков\n"


def test_missing_canon_folder_is_refused(tmp_path: Path, capsys: Any) -> None:
    assert commands.main(["load", str(tmp_path / "missing")]) == 1
    assert "папки канона нет" in capsys.readouterr().err

"""The library of sources in the core: the canon, its pieces, writing, search and quotations
(openspec/specs/sources/library)."""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import Connection, func, select

from core.errors import Invalid, NotFound
from core.sources import (
    PIECE_MAX_CHARS,
    Book,
    cite,
    list_books,
    parse_canon,
    remove_book,
    save_book,
    search,
)
from core.tables import source_books, source_fragments

SAMPLES = Path(__file__).parent / "fixtures" / "sources"
MODEL = "giga-embeddings"
HEADER = "---\ntitle: Книга\nauthors: [Автор]\nlanguage: ru\n---\n"


def _sample(name: str) -> Book:
    return parse_canon(name, (SAMPLES / name).read_text(encoding="utf-8"))


def _axis(index: int) -> list[float]:
    """A vector along one axis: two different axes are equally far from each other."""
    vector = [0.0] * 1024
    vector[index] = 1.0
    return vector


def _save(connection: Connection, book: Book, first_axis: int = 0, model: str = MODEL) -> uuid.UUID:
    vectors = [_axis(first_axis + piece.position) for piece in book.pieces]
    return save_book(connection, book, vectors, model)


def _ids(connection: Connection, slug: str) -> dict[tuple[str, ...], uuid.UUID]:
    rows = connection.execute(
        select(source_fragments.c.path, source_fragments.c.id)
        .join(source_books, source_books.c.id == source_fragments.c.book_id)
        .where(source_books.c.slug == slug)
    ).all()
    return {tuple(row.path): row.id for row in rows}


# The canon


def test_sample_is_read() -> None:
    book = _sample("sample-drama.md")
    assert book.meta.slug == "sample-drama"
    assert book.meta.title == "Образец о драме"
    assert book.meta.authors == ("Тестовый Автор",)
    assert (book.meta.original_year, book.meta.edition_year) == (1990, 2020)
    assert book.meta.original_title == "Sample on Drama"
    assert book.meta.translator is None


def test_pieces_keep_the_paths_of_the_headings() -> None:
    paths = [piece.path for piece in _sample("sample-drama.md").pieces]
    assert paths == [
        ("Часть 1. Целое", "Глава 1. Начало и конец"),
        ("Часть 1. Целое", "Глава 2. Перемена"),
        ("Часть 2. Характер", "Глава 3. Желание и потребность"),
    ]
    assert [piece.position for piece in _sample("sample-drama.md").pieces] == [0, 1, 2]


def test_piece_does_not_cross_a_chapter() -> None:
    first, second, _ = _sample("sample-drama.md").pieces
    assert "Развязка отвечает" in first.content and "Перемена судьбы" not in first.content
    assert second.content.startswith("Перемена судьбы")
    assert "- Перемена к счастью." in second.content


def test_diagram_stays_whole_and_illustration_is_text() -> None:
    first = _sample("sample-drama.md").pieces[0]
    assert "```mermaid\nflowchart LR\n  Начало --> Середина --> Развязка\n```" in first.content
    assert "[Иллюстрация: три прямоугольника подряд" in first.content


def test_long_paragraph_is_cut_by_sentences() -> None:
    sentence = "Это предложение повторяется, чтобы абзац стал длиннее одного куска. "
    paragraph = sentence * 60
    book = parse_canon("long.md", f"{HEADER}\n# Глава\n\n{paragraph}\n")
    assert len(book.pieces) > 1
    assert all(len(piece.content) <= PIECE_MAX_CHARS for piece in book.pieces)
    assert " ".join(piece.content for piece in book.pieces).split() == paragraph.split()


def test_long_diagram_is_refused() -> None:
    diagram = "flowchart LR\n" + "\n".join(f"  A{i} --> B{i}" for i in range(120))
    with pytest.raises(Invalid, match=r"long\.md, раздел «Глава»: схема Mermaid длиннее"):
        parse_canon("long.md", f"{HEADER}\n# Глава\n\n```mermaid\n{diagram}\n```\n")


@pytest.mark.parametrize(
    ("header", "message"),
    [
        ("title: Книга\nlanguage: ru\n", "нет обязательного поля «authors»"),
        ("title: Книга\nauthors: [Автор]\nlanguage: de\n", "язык «de» не поддерживается"),
        ("title: Книга\nauthors: [Автор]\nlanguage: ru\ntranslater: Кто-то\n", "неизвестные поля шапки: translater"),
        ("title: Книга\nauthors: Автор\nlanguage: ru\n", "поле «authors» должно быть списком"),
        ("title: Книга\nauthors: [Автор]\nlanguage: ru\nedition_year: прошлый\n", "поле «edition_year» должно быть"),
    ],
)
def test_broken_header_is_refused(header: str, message: str) -> None:
    with pytest.raises(Invalid, match=f"book.md: {message}"):
        parse_canon("book.md", f"---\n{header}---\n\n# Глава\n\nТекст.\n")


def test_translation_without_translator_is_read() -> None:
    book = parse_canon(
        "book.md", "---\ntitle: Поэтика\nauthors: [Аристотель]\nlanguage: ru\n---\n\n# Глава\n\nТекст.\n"
    )
    assert book.meta.translator is None and book.meta.original_title is None


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ("# Глава\n\n![](images/fig1.png)\n", "раздел «Глава»: в каноне осталась картинка"),
        ("# Глава\n\n[Иллюстрация: ]\n", "раздел «Глава»: пустое описание иллюстрации"),
        ("# Глава\n\n<div>Текст</div>\n", "раздел «Глава»: в каноне осталась разметка HTML"),
        ("Текст без глав.\n", "в каноне нет ни одного заголовка"),
    ],
)
def test_broken_body_is_refused(body: str, message: str) -> None:
    with pytest.raises(Invalid, match=f"book.md, {message}" if "раздел" in message else f"book.md: {message}"):
        parse_canon("book.md", f"{HEADER}\n{body}")


def test_bad_file_name_is_refused() -> None:
    with pytest.raises(Invalid, match="имя файла канона"):
        parse_canon("Impro Book.md", f"{HEADER}\n# Глава\n\nТекст.\n")


# Writing and removing


def test_save_again_replaces_the_book(connection: Connection) -> None:
    book = _sample("sample-drama.md")
    _save(connection, book)
    changed = parse_canon("sample-drama.md", (SAMPLES / "sample-drama.md").read_text().replace("главный", "первый"))
    _save(connection, changed)
    assert connection.execute(select(func.count()).select_from(source_books)).scalar_one() == 1
    contents = connection.execute(select(source_fragments.c.content)).scalars().all()
    assert len(contents) == 3
    assert not any("главный двигатель" in content for content in contents)
    assert any("первый двигатель" in content for content in contents)


def test_list_and_remove(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    _save(connection, _sample("sample-status.md"), first_axis=10)
    listed = {book.slug: book for book in list_books(connection)}
    assert set(listed) == {"sample-drama", "sample-status"}
    assert (listed["sample-drama"].pieces, listed["sample-drama"].embedding_model) == (3, MODEL)
    remove_book(connection, "sample-drama")
    assert [book.slug for book in list_books(connection)] == ["sample-status"]
    assert connection.execute(select(func.count()).select_from(source_fragments)).scalar_one() == 2


def test_removing_a_missing_book_is_refused(connection: Connection) -> None:
    with pytest.raises(NotFound):
        remove_book(connection, "no-such-book")


# Search


def test_words_and_meaning_are_fused(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    ids = _ids(connection, "sample-drama")
    change = ids[("Часть 1. Целое", "Глава 2. Перемена")]
    want = ids[("Часть 2. Характер", "Глава 3. Желание и потребность")]
    # The vector of the query is that of the chapter on change; its words are in the chapter on wants.
    found = search(connection, "желание и потребность", _axis(1), MODEL, limit=2)
    assert {item.fragment_id for item in found} == {change, want}
    assert found[0].fragment_id == want


def test_russian_word_forms_are_found(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    first = _ids(connection, "sample-drama")[("Часть 1. Целое", "Глава 1. Начало и конец")]
    found = search(connection, "развязки", _axis(500), MODEL, limit=1)
    assert found[0].fragment_id == first
    assert found[0].reference == "Тестовый Автор, «Образец о драме», 2020, Часть 1. Целое, Глава 1. Начало и конец"


def test_english_word_forms_are_found(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    _save(connection, _sample("sample-status.md"), first_axis=10)
    status = _ids(connection, "sample-status")[("Status",)]
    found = search(connection, "statuses", _axis(500), MODEL, limit=1)
    assert found[0].fragment_id == status


def test_vectors_of_another_model_are_refused(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"), model="gigachat-embeddings")
    with pytest.raises(Invalid, match="sample-drama посчитаны другой моделью"):
        search(connection, "развязка", _axis(0), MODEL)


def test_empty_query_is_refused(connection: Connection) -> None:
    with pytest.raises(Invalid, match="Пустой запрос"):
        search(connection, "  ", _axis(0), MODEL)


# Quotations


def test_quotation_with_other_spaces_is_found(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    first = _ids(connection, "sample-drama")[("Часть 1. Целое", "Глава 1. Начало и конец")]
    citation = cite(connection, first, "Сцена без  развязки\nкажется оборванной")
    assert citation.quote == "Сцена без развязки кажется оборванной"
    assert citation.reference.startswith("Тестовый Автор, «Образец о драме», 2020")
    assert "пер." not in citation.reference


def test_quotation_not_in_the_source_is_refused(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    first = _ids(connection, "sample-drama")[("Часть 1. Целое", "Глава 1. Начало и конец")]
    with pytest.raises(Invalid, match="Цитаты нет в источнике"):
        cite(connection, first, "герой должен страдать")


def test_long_quotation_is_refused(connection: Connection) -> None:
    _save(connection, _sample("sample-drama.md"))
    first = _ids(connection, "sample-drama")[("Часть 1. Целое", "Глава 1. Начало и конец")]
    with pytest.raises(Invalid, match="длиннее 300 знаков"):
        cite(connection, first, "а" * 301)


def test_reference_names_the_translator(connection: Connection) -> None:
    _save(connection, _sample("sample-status.md"))
    status = _ids(connection, "sample-status")[("Status",)]
    citation = cite(connection, status, "Status is something one does")
    assert (
        citation.reference == "Test Writer, Second Writer, «Sample on Status», пер. Not a Real Translator, 2001, Status"
    )


def test_quotation_of_a_missing_piece_is_refused(connection: Connection) -> None:
    with pytest.raises(NotFound):
        cite(connection, uuid.uuid4(), "текст")


# Closed full text (openspec/specs/sources/library, «Закрытость полного текста»)


def test_library_is_not_agentos_knowledge() -> None:
    """Only the code of the application reads the library: no Knowledge, AgentOS gets only shared-knowledge."""
    root = Path(__file__).resolve().parents[1]
    for module in ("core/sources.py", "core/tables.py"):
        assert "agno" not in {line.split()[1].split(".")[0] for line in _imports(root / module)}
    for module in ("app/main.py", "app/registry.py", "app/interfaces.py"):
        text = (root / module).read_text(encoding="utf-8")
        assert "sources" not in text and "source_fragments" not in text
    assert "knowledge=[shared_knowledge]," in (root / "app/main.py").read_text(encoding="utf-8")


def _imports(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line for line in lines if line.startswith(("import ", "from "))]

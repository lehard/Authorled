"""Drafts of the canon from book files (openspec/specs/sources/library, «Подготовка черновика из файла книги»).

The converters themselves (pandoc, calibre, djvutxt) live on the owner's Mac and are checked there by hand
(tasks of storytelling-sources, 4.3); these tests need only the antivirus of the stand.
"""

import io
from pathlib import Path

import pytest
from pypdf import PdfWriter

from core.errors import Invalid
from core.sources import parse_canon
from sources import convert as converting
from sources.convert import ILLUSTRATION, convert, converter_for, draft_slug, replace_images
from tests.test_clamav import EICAR


@pytest.mark.parametrize(
    ("name", "kind"),
    [
        ("Poetics.epub", "pandoc"),
        ("book.FB2", "pandoc"),
        ("book.docx", "pandoc"),
        ("book.rtf", "pandoc"),
        ("book.odt", "pandoc"),
        ("book.html", "pandoc"),
        ("book.txt", "pandoc"),
        ("Impro - Keith Johnstone.md", "pandoc"),
        ("book.mobi", "calibre"),
        ("book.azw3", "calibre"),
        ("book.pdf", "pdf"),
        ("book.djvu", "djvu"),
    ],
)
def test_converter_is_chosen_by_extension(name: str, kind: str) -> None:
    assert converter_for(Path(name)) == kind


def test_unsupported_format_is_refused() -> None:
    with pytest.raises(Invalid, match=r"book\.cbz: формат «\.cbz» не поддерживается; поддерживаются \.epub"):
        converter_for(Path("book.cbz"))


@pytest.mark.parametrize(
    ("stem", "slug"),
    [
        ("Impro - Keith Johnstone", "impro-keith-johnstone"),
        ("Aristotel_._PoyetikaI", "aristotel-poyetikai"),
        ("Поэтика Аристотеля", "poetika-aristotelya"),
    ],
)
def test_draft_slug(stem: str, slug: str) -> None:
    assert draft_slug(stem) == slug


def test_images_become_blank_illustrations() -> None:
    markdown = "Текст.\n\n![Схема 1](media/fig1.png){width=50%}\n\nЕщё ![](a.jpg) текст."
    assert replace_images(markdown) == f"Текст.\n\n{ILLUSTRATION}\n\nЕщё {ILLUSTRATION} текст."


def test_page_markers_go() -> None:
    assert replace_images("Текст.\n\n<!-- p. 12 -->\nДальше <!-- scan\ns001 --> текст.") == "Текст.\n\nДальше  текст."


def test_missing_program_is_named(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(converting.shutil, "which", lambda name: None)
    with pytest.raises(
        Invalid, match="Нет программы ebook-convert: установите её командой «brew install --cask calibre»"
    ):
        converting._program("ebook-convert")


def test_pdf_without_text_is_refused(tmp_path: Path) -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    data = io.BytesIO()
    writer.write(data)
    (tmp_path / "drafts").mkdir()
    book = tmp_path / "scan.pdf"
    book.write_bytes(data.getvalue())
    with pytest.raises(Invalid, match="В файле PDF нет текста"):
        convert(book, tmp_path)
    assert list((tmp_path / "drafts").iterdir()) == []


def test_header_of_a_draft_is_checked_by_the_canon() -> None:
    """A draft without authors does not pass the check until the owner fills them in."""
    header = converting._header({"title": "Поэтика", "authors": [], "language": "ru"})
    with pytest.raises(Invalid, match="нет обязательного поля «authors»"):
        parse_canon("poetika.md", f"{header}# Глава\n\nТекст.\n")
    filled = header.replace("authors: []", "authors: [Аристотель]")
    assert parse_canon("poetika.md", f"{filled}# Глава\n\nТекст.\n").meta.authors == ("Аристотель",)


def test_existing_draft_stays_without_force(tmp_path: Path) -> None:
    (tmp_path / "drafts").mkdir()
    (tmp_path / "drafts" / "book.md").write_text("готово", encoding="utf-8")
    book = tmp_path / "book.txt"
    book.write_text("Текст", encoding="utf-8")
    with pytest.raises(Invalid, match="черновик уже есть; добавьте --force"):
        convert(book, tmp_path)
    assert (tmp_path / "drafts" / "book.md").read_text(encoding="utf-8") == "готово"


def test_infected_file_is_not_parsed(tmp_path: Path) -> None:
    (tmp_path / "drafts").mkdir()
    book = tmp_path / "book.txt"
    book.write_bytes(EICAR)
    with pytest.raises(Invalid, match="book.txt: антивирус нашёл угрозу Eicar-Test-Signature"):
        convert(book, tmp_path)
    assert list((tmp_path / "drafts").iterdir()) == []

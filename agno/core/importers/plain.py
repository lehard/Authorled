"""Manuscripts without markup: DOCX and TXT are read line by line by the Fountain rules (design decision 8)."""

import io
import zipfile

from docx import Document as DocxDocument
from docx.opc.exceptions import PackageNotFoundError

from core.errors import Invalid
from core.importers.fountain import is_cue_line, is_scene_heading, parse_fountain
from core.importers.screenplay import Paragraph


def text_of_txt(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise Invalid("Текстовый файл должен быть в кодировке UTF-8.") from error


def text_of_docx(data: bytes) -> str:
    """Paragraphs of the body as Fountain lines: a blank line between blocks, none after a cue or a
    parenthetical, so that speech stays with its character (a DOCX screenplay has no blank paragraphs)."""
    try:
        document = DocxDocument(io.BytesIO(data))
    except (zipfile.BadZipFile, PackageNotFoundError, KeyError, ValueError) as error:
        raise Invalid(f"Файл DOCX не читается: {error}.") from error
    lines = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    out: list[str] = []
    for index, line in enumerate(lines):
        if index > 0:
            previous = lines[index - 1]
            speech = is_cue_line(previous) and not is_scene_heading(previous) or previous.startswith("(")
            out.append("\n" if speech else "\n\n")
        out.append(line)
    return "".join(out)


def parse_txt(data: bytes) -> list[Paragraph]:
    return parse_fountain(text_of_txt(data))


def parse_docx(data: bytes) -> list[Paragraph]:
    return parse_fountain(text_of_docx(data))

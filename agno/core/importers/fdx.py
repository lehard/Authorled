"""Final Draft (FDX) to paragraphs: the rules of web/src/editor/importers/fdx.ts (fdxToDoc).

Paragraph types map by the Final Draft names of web/src/editor/elements.ts; bold, italic and underline stay.
The standard XML parser fetches no external entities; its expat limits entity expansion.
"""

import xml.etree.ElementTree as ElementTree

from core.errors import Invalid
from core.importers.screenplay import Paragraph, Run

TYPE_OF = {
    "Scene Heading": "sceneHeading",
    "Cast List": "sceneCharacters",
    "Action": "action",
    "Character": "character",
    "Parenthetical": "parenthetical",
    "Dialogue": "dialogue",
    "Lyrics": "lyrics",
    "Shot": "shot",
    "Transition": "transition",
    "General": "unformatted",
    "Note": "inlineNote",
    "Beat": "beat",
    "Sequence": "sequence",
    "Act": "act",
}
_STYLES = (("Bold", "bold"), ("Italic", "italic"), ("Underline", "underline"))


def _runs(paragraph: ElementTree.Element) -> list[Run]:
    runs = []
    for text in paragraph.iter("Text"):
        content = "".join(text.itertext())
        if content:
            style = text.get("Style") or ""
            runs.append(Run(content, tuple(mark for name, mark in _STYLES if name in style)))
    return runs


def _without_brackets(runs: list[Run]) -> list[Run]:
    """Final Draft keeps the brackets of a parenthetical; the editor draws them itself."""
    if not runs or not runs[0].text.startswith("(") or not runs[-1].text.endswith(")"):
        return runs
    if len(runs) == 1:
        trimmed = [Run(runs[0].text[1:-1], runs[0].marks)]
    else:
        trimmed = [Run(runs[0].text[1:], runs[0].marks), *runs[1:-1], Run(runs[-1].text[:-1], runs[-1].marks)]
    return [run for run in trimmed if run.text]


def parse_fdx(data: bytes) -> list[Paragraph]:
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as error:
        raise Invalid(f"Файл не разобран как XML: {error}.") from error
    if root.tag != "FinalDraft":
        raise Invalid(f"Это не файл Final Draft: корневой элемент «{root.tag}» вместо «FinalDraft».")
    out = []
    for index, paragraph in enumerate(root.iterfind("Content/Paragraph"), start=1):
        fdx_type = paragraph.get("Type")
        if fdx_type is None:
            raise Invalid(f"У абзаца {index} нет типа (Type).")
        kind = TYPE_OF.get(fdx_type)
        if kind is None:
            raise Invalid(f"Абзац {index}: неизвестный тип Final Draft «{fdx_type}».")
        runs = _runs(paragraph)
        if kind == "parenthetical":
            runs = _without_brackets(runs)
        out.append(Paragraph(kind, tuple(runs)))
    if not out:
        raise Invalid("В файле Final Draft нет абзацев сценария.")
    return out

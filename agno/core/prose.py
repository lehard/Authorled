"""Markdown of the synopsis (openspec/specs/api/stories, «Разметка синопсиса», «Синопсис в поиске без разметки»).

The grammar of the prose editor (web/src/editor/prose/markdown.ts, design of synopsis-editor, decisions 2 and 3):
paragraphs, `#` and `##` headings, bold, italic, backslash escapes, a single newline as a line break; everything
else is text. markdown-it-py reads it as markdown-it does in the browser; web/src/editor/prose/markdown.cases.json
holds the examples both sides check.
"""

from markdown_it import MarkdownIt
from markdown_it.token import Token

from core.errors import Invalid

_TOKENIZER = MarkdownIt("zero").enable(["heading", "emphasis", "escape", "newline"])
_ORDINAL = {3: "третьего", 4: "четвёртого", 5: "пятого", 6: "шестого"}
_BREAKS = ("softbreak", "hardbreak")


def _tokens(text: str) -> list[Token]:
    """Tokens of the text; a heading deeper than the second level is refused with the field `synopsis`."""
    tokens = _TOKENIZER.parse(text)
    for token in tokens:
        if token.type == "heading_open" and (level := int(token.tag[1:])) > 2:
            raise Invalid(
                f"Поле «synopsis»: заголовок {_ORDINAL[level]} уровня не поддерживается, "
                "заголовки глубже второго уровня не поддерживаются.",
                "fields.synopsis",
            )
    return tokens


def check_synopsis(text: str) -> str:
    """The synopsis as it is, when the editor can show it."""
    _tokens(text)
    return text


def plain_text(text: str) -> str:
    """Text without markup: blocks through an empty line, a line break as a newline."""
    blocks: list[str] = []
    for token in _tokens(text):
        if token.type != "inline":
            continue
        parts = ["\n" if child.type in _BREAKS else child.content for child in token.children or []]
        blocks.append("".join(parts))
    return "\n\n".join(blocks)

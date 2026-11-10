"""Fountain (fountain.io) to paragraphs: ported from the former browser parseFountain, removed by story-data-web.

Types Fountain has no syntax for come back from the notes `[[@tag text]]` our export writes.
"""

import re

from core.importers.screenplay import Paragraph

TAGS = {
    "cast": "sceneCharacters",
    "shot": "shot",
    "text": "unformatted",
    "dialogue": "dialogue",
    "parenthetical": "parenthetical",
    "action": "action",
    "heading": "sceneHeading",
    "character": "character",
    "lyrics": "lyrics",
    "transition": "transition",
    "note": "inlineNote",
    "beat": "beat",
    "sequence": "sequence",
    "act": "act",
}

TRANSITIONS = {
    "FADE OUT.",
    "FADE IN:",
    "FADE TO BLACK.",
    "CUT TO:",
    "SMASH CUT TO:",
    "MATCH CUT TO:",
    "DISSOLVE TO:",
    "JUMP CUT TO:",
    "WIPE TO:",
    "TIME CUT:",
    "IRIS IN:",
    "IRIS OUT.",
}

_HEADING = re.compile(r"^(INT\.?\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.?|ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s", re.IGNORECASE)


def is_transition(line: str) -> bool:
    text = line.strip().upper()
    return text in TRANSITIONS or re.fullmatch(r"[A-Z\s]+TO:", text) is not None


def is_scene_heading(line: str) -> bool:
    return _HEADING.match(line.strip()) is not None


def _cue_name(name: str) -> bool:
    """A cue name of the JS rule: an upper-case letter, then upper-case letters, digits, spaces and . ' -."""
    if not (name[:1].isalpha() and name[:1].isupper()):
        return False
    return all((c.isalpha() and c.isupper()) or c in "0123456789.'-" or c.isspace() for c in name[1:])


def is_cue_line(line: str) -> bool:
    """The line reads as a character cue when speech follows it."""
    text = line.strip()
    if len(text) < 2:
        return False
    match = re.fullmatch(r"(.*?)(\s*\([^)]*\))?", text, re.S)
    if match is None or not _cue_name(match.group(1)):
        return False
    return not is_transition(text)


def _is_cue(line: str, following: str | None) -> bool:
    return following is not None and following.strip() != "" and is_cue_line(line)


# A line of exactly two spaces keeps an empty line inside a paragraph (fountain.io, «Line Breaks»).
EMPTY_LINE = "  "


def _note(line: str) -> Paragraph | None:
    """`[[text]]` on its own line (or on several) is a note; `[[@tag text]]` is a paragraph of our export."""
    match = re.fullmatch(r"\[\[(.*)\]\]", line, re.S)
    if match is None:
        return None
    tagged = re.fullmatch(r"@(\w+)(?: (.*))?", match.group(1), re.S)
    if tagged is not None and tagged.group(1) in TAGS:
        return Paragraph.plain(TAGS[tagged.group(1)], tagged.group(2) or "")
    return Paragraph.plain("inlineNote", match.group(1))


def _inside(line: str) -> bool:
    """The line goes on the paragraph above it: text, or the two spaces of an empty line."""
    return line == EMPTY_LINE or line.strip() != ""


def _row(line: str) -> str:
    return "" if line == EMPTY_LINE else line.rstrip()


def _long_note(lines: list[str], i: int) -> tuple[Paragraph, int] | None:
    """A note `[[` that closes on a later line: its paragraph (lines joined by line breaks) and the index after it.

    Without `]]` before a blank line the line is no note.
    """
    first = lines[i].lstrip()
    if not first.startswith("[[") or first.rstrip().endswith("]]"):
        return None
    rows = [first]
    j = i + 1
    while j < len(lines) and _inside(lines[j]):
        # Lines of a note keep their spaces: only the two spaces of an empty line are markup.
        rows.append("" if lines[j] == EMPTY_LINE else lines[j])
        if lines[j].endswith("]]"):
            note = _note("\n".join(rows))
            if note is None:
                raise AssertionError("строки от [[ до ]] не прочитаны как пометка")
            return note, j + 1
        j += 1
    return None


def _ends_action(line: str) -> bool:
    text = line.strip()
    return text == "===" or text.startswith("[[")


def parse_fountain(source: str) -> list[Paragraph]:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[Paragraph] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        text = line.strip()
        long_note = _long_note(lines, i)
        i += 1
        if text == "":
            continue
        if long_note is not None:
            found, i = long_note
            out.append(found)
            continue
        note = _note(text)
        if note is not None:
            out.append(note)
        elif text == "===":
            out.append(Paragraph("pageBreak"))
        elif text.startswith("##"):
            out.append(Paragraph.plain("sequence", re.sub(r"^#+\s*", "", text)))
        elif text.startswith("#"):
            out.append(Paragraph.plain("act", text[1:].strip()))
        elif text.startswith("="):
            out.append(Paragraph.plain("beat", text[1:].strip()))
        elif text.startswith("~"):
            out.append(Paragraph.plain("lyrics", text[1:]))
        elif text.startswith("!"):
            i = _action(out, line[line.index("!") + 1 :], lines, i)
        elif re.match(r"^\.[^.]", text):
            out.append(Paragraph.plain("sceneHeading", text[1:]))
        elif text.startswith(">") and not text.endswith("<"):
            out.append(Paragraph.plain("transition", text[1:].strip()))
        elif is_scene_heading(text):
            out.append(Paragraph.plain("sceneHeading", text))
        elif is_transition(text):
            out.append(Paragraph.plain("transition", text))
        elif text.startswith("@") or _is_cue(text, lines[i] if i < len(lines) else None):
            out.append(Paragraph.plain("character", text[1:] if text.startswith("@") else text))
            i = _speech(out, lines, i)
        else:
            i = _action(out, line, lines, i)
    return out


def _action(out: list[Paragraph], first: str, lines: list[str], i: int) -> int:
    """An action with the lines under it up to a blank line, joined by line breaks."""
    rows = [first]
    while i < len(lines) and _inside(lines[i]) and not _ends_action(lines[i]):
        rows.append(_row(lines[i]))
        i += 1
    out.append(Paragraph.plain("action", "\n".join(rows)))
    return i


def _speech(out: list[Paragraph], lines: list[str], i: int) -> int:
    """Dialogue, parentheticals and lyrics under a cue until the blank line; lines of dialogue in a row are one."""
    dialogue: list[str] | None = None

    def close() -> None:
        nonlocal dialogue
        if dialogue is not None:
            out.append(Paragraph.plain("dialogue", "\n".join(dialogue)))
            dialogue = None

    while i < len(lines) and _inside(lines[i]):
        if lines[i] == EMPTY_LINE:
            if dialogue is None:
                break
            dialogue.append("")
            i += 1
            continue
        long_note = _long_note(lines, i)
        if long_note is not None:
            close()
            found, i = long_note
            out.append(found)
            continue
        speech = lines[i].strip()
        i += 1
        note = _note(speech)
        if note is not None:
            close()
            out.append(note)
        elif re.fullmatch(r"\(.*\)", speech):
            close()
            out.append(Paragraph.plain("parenthetical", speech[1:-1]))
        elif speech.startswith("~"):
            close()
            out.append(Paragraph.plain("lyrics", speech[1:]))
        elif dialogue is None:
            dialogue = [speech]
        else:
            dialogue.append(speech)
    close()
    return i

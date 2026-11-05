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


def _note(line: str) -> Paragraph | None:
    """`[[text]]` on its own line is a note; `[[@tag text]]` is a paragraph of our export."""
    match = re.fullmatch(r"\[\[(.*)\]\]", line)
    if match is None:
        return None
    tagged = re.fullmatch(r"@(\w+)(?: (.*))?", match.group(1))
    if tagged is not None and tagged.group(1) in TAGS:
        return Paragraph.plain(TAGS[tagged.group(1)], tagged.group(2) or "")
    return Paragraph.plain("inlineNote", match.group(1))


def parse_fountain(source: str) -> list[Paragraph]:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[Paragraph] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        text = line.strip()
        i += 1
        if text == "":
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
            out.append(Paragraph.plain("action", line[line.index("!") + 1 :]))
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
            # Dialogue, parentheticals and lyrics until the blank line.
            while i < len(lines) and lines[i].strip() != "":
                speech = lines[i].strip()
                note = _note(speech)
                if note is not None:
                    out.append(note)
                elif re.fullmatch(r"\(.*\)", speech):
                    out.append(Paragraph.plain("parenthetical", speech[1:-1]))
                elif speech.startswith("~"):
                    out.append(Paragraph.plain("lyrics", speech[1:]))
                else:
                    out.append(Paragraph.plain("dialogue", speech))
                i += 1
        else:
            out.append(Paragraph.plain("action", line))
    return out

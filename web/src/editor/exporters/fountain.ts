import type { Node } from "prosemirror-model";

import type { ElementName } from "../elements.ts";

// Fountain (fountain.io) by the table of design decision 6. Types Fountain has no syntax for,
// and paragraphs that would read as another type, go as notes `[[@tag text]]` that only our
// import (the core, agno/core/importers/fountain.py) reads; other programs show them as notes
// and keep the text. Marks are not written.

/** Tags of `[[@tag text]]` notes for types Fountain has no syntax for. */
const TAG_OF: Partial<Record<ElementName, string>> = {
  sceneCharacters: "cast",
  shot: "shot",
  unformatted: "text",
  dialogue: "dialogue",
  parenthetical: "parenthetical",
  action: "action",
  sceneHeading: "heading",
  character: "character",
  lyrics: "lyrics",
  transition: "transition",
  inlineNote: "note",
  beat: "beat",
  sequence: "sequence",
  act: "act",
};

// Lines Fountain reads as a transition or a scene heading without a mark.
const TRANSITIONS = new Set([
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
]);

function isTransition(line: string): boolean {
  const t = line.trim().toUpperCase();
  return TRANSITIONS.has(t) || /^[A-Z\s]+TO:$/.test(t);
}

function isSceneHeading(line: string): boolean {
  return /^(INT\.?\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.?|ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s/iu.test(
    line.trim(),
  );
}

const SPECIAL_START = /^(\.|@|>|~|=|#|!|\[\[|===)/;

/** A line of exactly two spaces keeps an empty line inside a paragraph (fountain.io, «Line Breaks»). */
const EMPTY_LINE = "  ";

/** Lines of a paragraph with line breaks: an empty line goes as two spaces. */
function rows(text: string): string[] {
  return text.split("\n").map((line) => {
    if (line === EMPTY_LINE)
      throw new Error(
        "Строку из двух пробелов внутри абзаца нельзя записать в Fountain: она читается как пустая",
      );
    return line === "" ? EMPTY_LINE : line;
  });
}

function tagged(type: ElementName, text: string): string {
  const tag = TAG_OF[type];
  if (tag === undefined)
    throw new Error(`Нет записи Fountain для типа «${type}»`);
  const lines = rows(text);
  // The note ends on the first line that ends with `]]` (agno/core/importers/fountain.py).
  if (lines.slice(0, -1).some((line) => line.endsWith("]]")))
    throw new Error(
      `Абзац «${type}» со строкой, которая кончается на «]]», нельзя записать в Fountain`,
    );
  return `[[@${tag}${text === "" ? "" : ` ${lines.join("\n")}`}]]`;
}

/** Lines of a dialogue Fountain reads back as one dialogue, or null when it cannot. */
function dialogueLines(text: string): string | null {
  const lines = text.split("\n");
  if (lines[0] === "") return null;
  const speech = lines.every(
    (line) =>
      line === "" || (line === line.trim() && !/^(\(.*\)|~|\[\[)/.test(line)),
  );
  return speech ? rows(text).join("\n") : null;
}

/** Lines of an action Fountain reads back as one action, or null when it cannot. */
function actionLines(text: string): string | null {
  const [first, ...rest] = text.split("\n");
  if (first === "" || first !== first.trimEnd()) return null;
  const joined = rest.every(
    (line) =>
      line === "" ||
      (line === line.trimEnd() &&
        !line.trim().startsWith("[[") &&
        line.trim() !== "==="),
  );
  if (!joined) return null;
  // A first line read as another type (a cue, when lines follow it) gets the forced-action mark.
  const forced =
    SPECIAL_START.test(first) ||
    isSceneHeading(first) ||
    isTransition(first) ||
    (rest.length > 0 && plainCue(first));
  return (forced ? "!" : "") + rows(text).join("\n");
}

/** A cue Fountain reads as a character without the `@` mark. */
function plainCue(text: string): boolean {
  return (
    /^\p{Lu}[\p{Lu}\d\s.'-]*(\s*\([^)]*\))?$/u.test(text) && !isTransition(text)
  );
}

export function docToFountain(doc: Node): string {
  const lines: string[] = [];
  // Whether the last line is inside a character block (no blank line since the cue).
  let speech = false;
  // Whether the last line of the character block is dialogue: dialogue under it would join it.
  let afterDialogue = false;
  const block = (line: string) => {
    if (lines.length > 0) lines.push("");
    lines.push(line);
    speech = false;
    afterDialogue = false;
  };

  doc.forEach((node, _offset, index) => {
    if (node.type.name === "pageBreak") {
      block("===");
      return;
    }
    const type = node.type.name as ElementName;
    const text = node.textContent;
    // Empty paragraphs and line breaks of other types have no Fountain form: keep them as tagged notes.
    const plain = text !== "" && !text.includes("\n");

    switch (type) {
      case "character": {
        // A plain cue needs a speech line right under it, or Fountain reads it as action.
        const next = index + 1 < doc.childCount ? doc.child(index + 1) : null;
        const cue =
          plain &&
          plainCue(text) &&
          next !== null &&
          (next.type.name === "dialogue" || next.type.name === "parenthetical");
        block(plain ? (cue ? text : `@${text}`) : tagged(type, text));
        speech = true;
        return;
      }
      case "parenthetical":
        if (speech) {
          const free = plain && !/^(\(.*\)|~|\[\[)/.test(text);
          lines.push(free ? `(${text})` : tagged(type, text));
          afterDialogue = false;
        } else {
          block(tagged(type, text));
        }
        return;
      case "dialogue": {
        if (!speech) {
          block(tagged(type, text));
          return;
        }
        // Lines of a dialogue in a row are one dialogue: a second dialogue goes as a note.
        const free = afterDialogue || text === "" ? null : dialogueLines(text);
        lines.push(free ?? tagged(type, text));
        afterDialogue = true;
        return;
      }
      case "action": {
        const free = text === "" ? null : actionLines(text);
        block(free ?? tagged(type, text));
        return;
      }
    }
    if (!plain) {
      block(tagged(type, text));
      return;
    }
    switch (type) {
      case "sceneHeading":
        block(
          isSceneHeading(text) && !SPECIAL_START.test(text) ? text : `.${text}`,
        );
        break;
      case "lyrics":
        block(`~${text}`);
        break;
      case "transition":
        block(`> ${text}`);
        break;
      case "act":
        block(`# ${text}`);
        break;
      case "sequence":
        block(`## ${text}`);
        break;
      case "beat":
        block(`= ${text}`);
        break;
      case "inlineNote":
        block(text.startsWith("@") ? tagged(type, text) : `[[${text}]]`);
        break;
      case "sceneCharacters":
      case "shot":
      case "unformatted":
        block(tagged(type, text));
        break;
    }
  });

  return lines.join("\n") + "\n";
}

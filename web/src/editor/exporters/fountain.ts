import type { Node } from "prosemirror-model";

import type { ElementName } from "../elements.ts";
import { isSceneHeading, isTransition, TAGS } from "../importers/fountain.ts";

// Fountain (fountain.io) by the table of design decision 6. Types Fountain has no syntax for,
// and paragraphs that would read as another type, go as notes `[[@tag text]]` that only our
// import reads; other programs show them as notes and keep the text. Marks are not written.

const SPECIAL_START = /^(\.|@|>|~|=|#|!|\[\[|===)/;

const TAG_OF = Object.fromEntries(
  Object.entries(TAGS).map(([tag, type]) => [type, tag]),
) as Partial<Record<ElementName, string>>;

function tagged(type: ElementName, text: string): string {
  const tag = TAG_OF[type];
  if (tag === undefined)
    throw new Error(`Нет записи Fountain для типа «${type}»`);
  return `[[@${tag}${text === "" ? "" : ` ${text}`}]]`;
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
  const block = (line: string) => {
    if (lines.length > 0) lines.push("");
    lines.push(line);
    speech = false;
  };

  doc.forEach((node, _offset, index) => {
    if (node.type.name === "pageBreak") {
      block("===");
      return;
    }
    const type = node.type.name as ElementName;
    const text = node.textContent;
    // Empty paragraphs and line breaks have no Fountain form: keep them as tagged notes.
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
      case "dialogue":
        if (speech) {
          const free = plain && !/^(\(.*\)|~|\[\[)/.test(text);
          lines.push(
            !free
              ? tagged(type, text)
              : type === "parenthetical"
                ? `(${text})`
                : text,
          );
        } else {
          block(tagged(type, text));
        }
        return;
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
      case "action":
        block(
          SPECIAL_START.test(text) || isSceneHeading(text) || isTransition(text)
            ? `!${text}`
            : text,
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

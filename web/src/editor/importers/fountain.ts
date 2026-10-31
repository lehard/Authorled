import type { Node } from "prosemirror-model";

import { isElementName, type ElementName } from "../elements.ts";
import { schema } from "../schema/index.ts";

/** Tags of `[[@tag text]]` notes our export writes for types Fountain has no syntax for. */
export const TAGS: Record<string, ElementName> = {
  cast: "sceneCharacters",
  shot: "shot",
  text: "unformatted",
  dialogue: "dialogue",
  parenthetical: "parenthetical",
  action: "action",
  heading: "sceneHeading",
  character: "character",
  lyrics: "lyrics",
  transition: "transition",
  note: "inlineNote",
  beat: "beat",
  sequence: "sequence",
  act: "act",
};

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

export function isTransition(line: string): boolean {
  const t = line.trim().toUpperCase();
  return TRANSITIONS.has(t) || /^[A-Z\s]+TO:$/.test(t);
}

export function isSceneHeading(line: string): boolean {
  return /^(INT\.?\/EXT\.|INT\.|EXT\.|EST\.|I\/E\.?|ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s/iu.test(
    line.trim(),
  );
}

function isCue(line: string, next: string | undefined): boolean {
  const t = line.trim();
  if (t.length < 2 || next === undefined || next.trim() === "") return false;
  if (!/^\p{Lu}[\p{Lu}\d\s.'-]*(\s*\([^)]*\))?$/u.test(t)) return false;
  return !isTransition(t);
}

export type FountainElement = { type: ElementName | "pageBreak"; text: string };

/** `[[text]]` on its own line is a note; `[[@tag text]]` is a paragraph of our export. */
function note(line: string): FountainElement | null {
  const m = /^\[\[(.*)\]\]$/.exec(line);
  if (m === null) return null;
  const tagged = /^@(\w+)(?: (.*))?$/.exec(m[1]);
  const type = tagged === null ? undefined : TAGS[tagged[1]];
  if (tagged !== null && type !== undefined && isElementName(type)) {
    return { type, text: tagged[2] ?? "" };
  }
  return { type: "inlineNote", text: m[1] };
}

export function parseFountain(fountain: string): FountainElement[] {
  const lines = fountain.replace(/\r\n?/g, "\n").split("\n");
  const out: FountainElement[] = [];
  const push = (type: FountainElement["type"], text: string) =>
    out.push({ type, text });
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const t = line.trim();
    if (t === "") {
      i++;
      continue;
    }
    i++;

    const n = note(t);
    if (n !== null) out.push(n);
    else if (t === "===") push("pageBreak", "");
    else if (t.startsWith("##")) push("sequence", t.replace(/^#+\s*/, ""));
    else if (t.startsWith("#")) push("act", t.slice(1).trim());
    else if (t.startsWith("=")) push("beat", t.slice(1).trim());
    else if (t.startsWith("~")) push("lyrics", t.slice(1));
    else if (t.startsWith("!"))
      push("action", line.slice(line.indexOf("!") + 1));
    else if (/^\.[^.]/.test(t)) push("sceneHeading", t.slice(1));
    else if (t.startsWith(">") && !t.endsWith("<"))
      push("transition", t.slice(1).trim());
    else if (isSceneHeading(t)) push("sceneHeading", t);
    else if (isTransition(t)) push("transition", t);
    else if (t.startsWith("@") || isCue(t, lines[i])) {
      push("character", t.startsWith("@") ? t.slice(1) : t);
      // Dialogue, parentheticals and lyrics until the blank line.
      while (i < lines.length && lines[i].trim() !== "") {
        const d = lines[i].trim();
        const n = note(d);
        if (n !== null) out.push(n);
        else if (/^\(.*\)$/.test(d)) push("parenthetical", d.slice(1, -1));
        else if (d.startsWith("~")) push("lyrics", d.slice(1));
        else push("dialogue", d);
        i++;
      }
    } else push("action", line);
  }
  return out;
}

export function fountainToDoc(fountain: string): Node {
  const nodes = parseFountain(fountain).map((el) =>
    schema.nodes[el.type].create(
      null,
      el.text === "" ? null : schema.text(el.text),
    ),
  );
  if (nodes.length === 0) nodes.push(schema.nodes.sceneHeading.create());
  return schema.nodes.doc.create(null, nodes);
}

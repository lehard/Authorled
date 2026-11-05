// JSON of a screenplay document: what the app stores and the backend will keep.
import { Node } from "prosemirror-model";
import { Transform } from "prosemirror-transform";

import type { ElementName, MarkColor } from "./elements.ts";
import { schema } from "./schema/index.ts";

export type MarkJSON =
  | { type: "bold" | "italic" | "underline" }
  | { type: "textColor" | "highlight"; attrs: { color: MarkColor } }
  | { type: "comment" | "suggestion"; attrs: { id: string } };

export type TextJSON = { type: "text"; text: string; marks?: MarkJSON[] };

export type SceneParams = {
  /** Lasting id of the scene, unique in the document (web/screenplay-editor, «Постоянный uid сцены»). */
  uid: string;
  /** Meaningful name of the scene, shown on the card and in the navigator, not in the text. */
  alt: string;
  /** Day of the story. */
  day: string;
  color: MarkColor | null;
  tags: string[];
};

export const NO_PARAMS: SceneParams = {
  uid: "",
  alt: "",
  day: "",
  color: null,
  tags: [],
};

export type BlockJSON =
  | { type: "sceneHeading"; attrs?: Partial<SceneParams>; content?: TextJSON[] }
  | { type: Exclude<ElementName, "sceneHeading">; content?: TextJSON[] }
  | { type: "pageBreak" };

export type ScreenplayDoc = { type: "doc"; content: BlockJSON[] };

/** Checks the JSON against the schema; an unknown type or mark throws. */
export function toNode(doc: ScreenplayDoc): Node {
  const node = Node.fromJSON(schema, doc);
  node.check();
  return node;
}

export function toJSON(node: Node): ScreenplayDoc {
  return node.toJSON() as ScreenplayDoc;
}

/**
 * The document with a `uid` on every scene heading: an empty one and a repeated one (a copy)
 * get a new id, the first heading with an id keeps it.
 */
export function ensureSceneUids(doc: ScreenplayDoc): ScreenplayDoc {
  const seen = new Set<string>();
  let changed = false;
  const content = doc.content.map((block): BlockJSON => {
    if (block.type !== "sceneHeading") return block;
    const uid = block.attrs?.uid ?? "";
    if (uid !== "" && !seen.has(uid)) {
      seen.add(uid);
      return block;
    }
    changed = true;
    const fresh = crypto.randomUUID();
    seen.add(fresh);
    return { ...block, attrs: { ...block.attrs, uid: fresh } };
  });
  return changed ? { type: "doc", content } : doc;
}

/** A document of plain paragraphs: samples and a new story. */
export function plainDoc(rows: [ElementName, string][]): ScreenplayDoc {
  return {
    type: "doc",
    content: rows.map(([type, text]) =>
      text === "" ? { type } : { type, content: [{ type: "text", text }] },
    ),
  };
}

/**
 * The document without marks of `types`: a draft copies the text without the comments and
 * suggestions of the current one (screenplay-drafts, decision 2).
 */
export function stripMarks(
  doc: ScreenplayDoc,
  types: ("comment" | "suggestion")[],
): ScreenplayDoc {
  const node = toNode(doc);
  const tr = new Transform(node);
  for (const type of types)
    tr.removeMark(0, node.content.size, schema.marks[type]);
  return toJSON(tr.doc);
}

export type Paragraph = { type: ElementName; text: string };

/** Paragraphs as «type, text» for code that reads the screenplay without the editor. */
export function paragraphs(doc: ScreenplayDoc): Paragraph[] {
  const result: Paragraph[] = [];
  toNode(doc).forEach((node) => {
    if (node.type.name === "pageBreak") return;
    result.push({
      type: node.type.name as ElementName,
      text: node.textContent,
    });
  });
  return result;
}

export type SceneEntry =
  | { kind: "act" | "sequence"; name: string; index: number }
  | {
      kind: "scene";
      number: number;
      heading: string;
      /** First line of text after the heading, beats and notes left out. */
      text: string;
      beats: string[];
      params: SceneParams;
      /** Characters that count for screen time (heading and text, without beats and notes). */
      chars: number;
      /** Index of the heading paragraph; the scene runs to `end` (exclusive). */
      index: number;
      end: number;
    };

const UNTIMED = new Set<string>(["act", "sequence", "beat", "inlineNote"]);

/** Acts, groups and scenes: a scene runs from its heading to the next heading, group or act. */
export function scenes(doc: ScreenplayDoc): SceneEntry[] {
  const out: SceneEntry[] = [];
  let current: Extract<SceneEntry, { kind: "scene" }> | null = null;
  let number = 0;
  toNode(doc).forEach((node, _offset, i) => {
    const type = node.type.name;
    const text = node.textContent;
    if (type === "pageBreak") return;
    if (type === "act" || type === "sequence") {
      current = null;
      out.push({ kind: type, name: text, index: i });
      return;
    }
    if (type === "sceneHeading") {
      number += 1;
      current = {
        kind: "scene",
        number,
        heading: text,
        text: "",
        beats: [],
        params: node.attrs as SceneParams,
        chars: text.length,
        index: i,
        end: i + 1,
      };
      out.push(current);
      return;
    }
    if (current === null) return;
    current.end = i + 1;
    if (type === "beat") current.beats.push(text);
    if (UNTIMED.has(type)) return;
    if (current.text === "" && text.trim() !== "") current.text = text.trim();
    current.chars += text.length;
  });
  return out;
}

/** Rough screen time: about 12 characters per second, as in mockup v2. */
export function screenTime(chars: number): string {
  const seconds = Math.round(chars / 12);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// JSON of a screenplay document: what the app stores and the backend will keep.
import { Node } from "prosemirror-model";

import type { ElementName, MarkColor } from "./elements.ts";
import { schema } from "./schema/index.ts";

export type MarkJSON =
  | { type: "bold" | "italic" | "underline" }
  | { type: "textColor" | "highlight"; attrs: { color: MarkColor } };

export type TextJSON = { type: "text"; text: string; marks?: MarkJSON[] };

export type BlockJSON =
  { type: ElementName; content?: TextJSON[] } | { type: "pageBreak" };

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

/** A document of plain paragraphs: samples and a new story. */
export function plainDoc(rows: [ElementName, string][]): ScreenplayDoc {
  return {
    type: "doc",
    content: rows.map(([type, text]) =>
      text === "" ? { type } : { type, content: [{ type: "text", text }] },
    ),
  };
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
  paragraphs(doc).forEach((p, i) => {
    if (p.type === "act" || p.type === "sequence") {
      current = null;
      out.push({ kind: p.type, name: p.text, index: i });
      return;
    }
    if (p.type === "sceneHeading") {
      current = {
        kind: "scene",
        number: out.filter((s) => s.kind === "scene").length + 1,
        heading: p.text,
        text: "",
        chars: p.text.length,
        index: i,
        end: i + 1,
      };
      out.push(current);
      return;
    }
    if (current === null) return;
    current.end = i + 1;
    if (UNTIMED.has(p.type)) return;
    if (current.text === "" && p.text.trim() !== "")
      current.text = p.text.trim();
    current.chars += p.text.length;
  });
  return out;
}

/** Rough screen time: about 12 characters per second, as in mockup v2. */
export function screenTime(chars: number): string {
  const seconds = Math.round(chars / 12);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

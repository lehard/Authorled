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

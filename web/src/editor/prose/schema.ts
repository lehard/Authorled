// Schema of the prose editor (openspec/specs/web/prose-editor, design of synopsis-editor, decision 1):
// paragraphs, headings of two levels, a line break inside a paragraph, bold and italic. Nothing else.
import { Schema } from "prosemirror-model";

export const HEADING_LEVELS = [1, 2] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

function validLevel(value: unknown): void {
  if (value !== 1 && value !== 2)
    throw new RangeError(
      `Уровень заголовка прозы — 1 или 2, а не ${JSON.stringify(value)}`,
    );
}

export const proseSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      toDOM: () => ["p", 0],
      parseDOM: [{ tag: "p" }],
    },
    heading: {
      group: "block",
      // A heading is one line: Markdown cannot hold a break inside it.
      content: "text*",
      marks: "strong em",
      defining: true,
      attrs: { level: { default: 1, validate: validLevel } },
      toDOM: (node) => [`h${node.attrs.level as HeadingLevel}`, 0],
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
      ],
    },
    text: { group: "inline" },
    hard_break: {
      group: "inline",
      inline: true,
      selectable: false,
      leafText: () => "\n",
      toDOM: () => ["br"],
      parseDOM: [{ tag: "br" }],
    },
  },
  marks: {
    strong: {
      toDOM: () => ["strong", 0],
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
    },
    em: {
      toDOM: () => ["em", 0],
      parseDOM: [{ tag: "em" }, { tag: "i" }],
    },
  },
});

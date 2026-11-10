// Markdown of the prose editor (openspec/specs/web/prose-editor, «Хранение синопсиса Markdown»; design of
// synopsis-editor, decision 2). The grammar: paragraphs, `#` and `##` headings, `**bold**`, `*italic*`,
// backslash escapes and a single newline as a line break. Everything else is text. agno/core/prose.py
// reads the same grammar with markdown-it-py; markdown.cases.json holds the examples both sides check.
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type { Node } from "prosemirror-model";
import { MarkdownParser, MarkdownSerializer } from "prosemirror-markdown";

import { proseSchema } from "./schema.ts";

/** A text the editor cannot show: a heading deeper than the second level. */
export class ProseMarkupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProseMarkupError";
  }
}

const ORDINAL: Record<number, string> = {
  3: "третьего",
  4: "четвёртого",
  5: "пятого",
  6: "шестого",
};

// A single newline is a `softbreak` token (the `breaks` option only changes HTML rendering): the parser
// below makes it a line break, as the plain texts written before the editor have it.
const tokenizer = MarkdownIt("zero").enable([
  "heading",
  "emphasis",
  "escape",
  "newline",
]);

const parser = new MarkdownParser(proseSchema, tokenizer, {
  paragraph: { block: "paragraph" },
  heading: {
    block: "heading",
    getAttrs: (token: Token) => {
      const level = Number(token.tag.slice(1));
      if (level > 2)
        throw new ProseMarkupError(
          `Заголовок ${ORDINAL[level]} уровня не поддерживается: в синопсисе бывают заголовки только первого и второго уровня.`,
        );
      return { level };
    },
  },
  hardbreak: { node: "hard_break" },
  softbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
});

/** The document of a Markdown text; an empty text is one empty paragraph. */
export function parseProse(markdown: string): Node {
  if (markdown.trim() === "")
    return proseSchema.node("doc", null, [proseSchema.node("paragraph")]);
  return parser.parse(markdown);
}

// Escapes only what the grammar reads as markup, so the stored text stays readable. `#` is escaped
// everywhere: at a line start it opens a heading, at the end of a heading it is cut as its closing.
function escapeText(text: string): string {
  return text.replace(/[\\*_#]/g, "\\$&");
}

const serializer = new MarkdownSerializer(
  {
    paragraph(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    heading(state, node) {
      state.write(`${"#".repeat(node.attrs.level as number)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    hard_break(state) {
      state.write("\n");
    },
    text(state, node) {
      // The state knows where a line starts; only the set of escaped characters is ours.
      state.esc = escapeText;
      state.text(node.text ?? "", true);
    },
  },
  {
    em: {
      open: "*",
      close: "*",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    strong: {
      open: "**",
      close: "**",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
);

/** Markdown of a document; empty paragraphs are not kept (Markdown has none). */
export function serializeProse(doc: Node): string {
  return serializer.serialize(doc, { tightLists: true }).trim();
}

/** Text without markup: blocks through an empty line, a line break as a newline. */
export function proseText(doc: Node): string {
  return doc.textBetween(0, doc.content.size, "\n\n");
}

/** Words by the rule of the screenplay: pieces between whitespace with a letter or a digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((piece) => /[\p{L}\p{N}]/u.test(piece))
    .length;
}

/** Characters with spaces, without the breaks between paragraphs and lines. */
export function countChars(doc: Node): number {
  let chars = 0;
  doc.descendants((node) => {
    if (node.isText) chars += node.text?.length ?? 0;
  });
  return chars;
}

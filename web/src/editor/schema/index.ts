import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";

import {
  ELEMENT_NAMES,
  ELEMENTS,
  elementClass,
  MARK_COLORS,
  type ElementName,
} from "../elements.ts";

// Parameters of a scene live on its heading and move with it (scene-outline-and-cards, decision 2).
const SCENE_ATTRS: NodeSpec["attrs"] = {
  alt: { default: "", validate: "string" },
  day: { default: "", validate: "string" },
  color: {
    default: null,
    validate: (v) => {
      if (v !== null) validColour(v);
    },
  },
  tags: {
    default: [],
    validate: (v) => {
      if (!Array.isArray(v) || v.some((t) => typeof t !== "string"))
        throw new RangeError(
          `Теги сцены — список строк, а не ${JSON.stringify(v)}`,
        );
    },
  },
};

function paragraph(name: ElementName): NodeSpec {
  const type = elementClass(name).slice(3);
  return {
    ...(name === "sceneHeading" ? { attrs: SCENE_ATTRS } : {}),
    group: "block",
    content: "text*",
    defining: true,
    toDOM: () => [
      "p",
      {
        class: elementClass(name),
        "data-type": type,
        "data-placeholder": ELEMENTS[name].placeholder,
      },
      0,
    ],
    parseDOM: [{ tag: `p[data-type="${type}"]` }],
  };
}

// Text colour and fill keep the palette number, not a colour: the theme paints it.
function colourMark(attr: "data-mark-color" | "data-mark-fill"): MarkSpec {
  return {
    attrs: { color: { validate: (v) => validColour(v) } },
    toDOM: (mark) => [
      "span",
      {
        class: attr === "data-mark-color" ? "pw-color" : "pw-fill",
        [attr]: mark.attrs.color as string,
      },
      0,
    ],
    parseDOM: [
      {
        tag: `span[${attr}]`,
        getAttrs: (dom) => {
          const color = dom.getAttribute(attr);
          return color !== null && MARK_COLORS.includes(color as never)
            ? { color }
            : false;
        },
      },
    ],
  };
}

function validColour(value: unknown) {
  if (!MARK_COLORS.includes(value as never))
    throw new RangeError(`Неизвестный цвет метки: ${String(value)}`);
}

const nodes: Record<string, NodeSpec> = { doc: { content: "block+" } };
for (const name of ELEMENT_NAMES) nodes[name] = paragraph(name);
// A forced page break of imported Fountain (===); the editor itself does not insert it.
nodes.pageBreak = {
  group: "block",
  atom: true,
  toDOM: () => [
    "div",
    {
      class: "pm-page-break",
      "data-type": "page-break",
      contenteditable: "false",
    },
  ],
  parseDOM: [{ tag: 'div[data-type="page-break"]' }],
};
nodes.text = { group: "inline" };

export const schema = new Schema({
  nodes,
  marks: {
    bold: {
      toDOM: () => ["strong", 0],
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
    },
    italic: { toDOM: () => ["em", 0], parseDOM: [{ tag: "em" }, { tag: "i" }] },
    underline: { toDOM: () => ["u", 0], parseDOM: [{ tag: "u" }] },
    textColor: colourMark("data-mark-color"),
    highlight: colourMark("data-mark-fill"),
    // Place of a comment thread; the threads live outside the text (screenplay-comments, decision 1).
    // Several comments may cover the same words; text typed at the edge stays outside.
    comment: {
      attrs: { id: { validate: "string" } },
      excludes: "",
      inclusive: false,
      toDOM: (mark) => [
        "span",
        { class: "pw-comment", "data-comment-id": mark.attrs.id as string },
        0,
      ],
      parseDOM: [
        {
          tag: "span[data-comment-id]",
          getAttrs: (dom) => {
            const id = dom.getAttribute("data-comment-id");
            return id === null || id === "" ? false : { id };
          },
        },
      ],
    },
  },
});

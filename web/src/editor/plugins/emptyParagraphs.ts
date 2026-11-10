import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// An empty paragraph shows the placeholder of its type (web/screenplay-editor, «Подсказка пустого
// абзаца»). Emptiness is read from the document: the DOM of a paragraph whose text ends with a line
// break has the same trailing <br> as an empty one.

/** Positions of the textblocks of `doc` without content. */
export function emptyParagraphs(doc: Node): number[] {
  const found: number[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.content.size === 0) found.push(pos);
    return false;
  });
  return found;
}

function build(doc: Node): DecorationSet {
  return DecorationSet.create(
    doc,
    emptyParagraphs(doc).map((pos) =>
      // An empty textblock is two positions long: its opening and closing.
      Decoration.node(pos, pos + 2, { class: "pw-empty" }),
    ),
  );
}

export const emptyParagraphsKey = new PluginKey<DecorationSet>(
  "emptyParagraphs",
);

export const emptyParagraphsPlugin = new Plugin<DecorationSet>({
  key: emptyParagraphsKey,
  state: {
    init: (_, state) => build(state.doc),
    apply: (tr, old) =>
      tr.docChanged ? build(tr.doc) : old.map(tr.mapping, tr.doc),
  },
  props: {
    decorations: (state) => emptyParagraphsKey.getState(state),
  },
});

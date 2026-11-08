import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { sceneHeadings } from "./sceneHeadings.ts";

export const sceneNumbersKey = new PluginKey<DecorationSet>("sceneNumbers");

export const sceneNumbersPlugin = new Plugin<DecorationSet>({
  key: sceneNumbersKey,

  state: {
    init(_, state) {
      return buildDecorations(state.doc);
    },
    apply(tr, old) {
      if (tr.docChanged) {
        return buildDecorations(tr.doc);
      }
      return old.map(tr.mapping, tr.doc);
    },
  },

  props: {
    decorations(state) {
      return sceneNumbersKey.getState(state);
    },
  },
});

/*
 * The left number is a widget before the text. The right one is drawn by the `::after` of the
 * heading from `data-scene-number`: as a widget after the caret of an empty heading it made
 * WebKit lose what was typed there (web/screenplay-editor, «Ввод в пустой заголовок сцены»).
 * An empty heading is marked `pw-empty-heading`: the left widget is its child, so the
 * `br:only-child` of the placeholder rule never matches it.
 */
function buildDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  for (const { pos, number, empty } of sceneHeadings(doc)) {
    const num = String(number);
    const node = doc.nodeAt(pos);
    if (node === null)
      throw new Error(`Номера сцен: нет заголовка в позиции ${pos}`);
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        "data-scene-number": num,
        ...(empty ? { class: "pw-empty-heading" } : {}),
      }),
      Decoration.widget(
        pos + 1,
        () => {
          const el = document.createElement("span");
          el.className = "pw-scene-number pw-scene-number-left";
          el.textContent = num;
          el.contentEditable = "false";
          return el;
        },
        { side: -1, key: `sn-l-${pos}-${num}` },
      ),
    );
  }
  return DecorationSet.create(doc, decorations);
}

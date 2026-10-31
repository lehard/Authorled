import type { Node } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// Hidden paragraphs (design of screenplay-text-tools, decision 2): beats until «Показать биты»,
// and everything outside the scene with the caret in «Только текущая сцена». The document
// does not change; the paragraph with the caret is never hidden.

export type ViewOptions = { showBeats: boolean; isolate: boolean };

export const visibilityKey = new PluginKey<ViewOptions>("visibility");

/** Index of the top-level paragraph that holds `pos`. */
export function blockIndex(doc: Node, pos: number): number {
  return doc.resolve(Math.min(pos, doc.content.size)).index(0);
}

/** First and last (exclusive) paragraph of the scene around `cursor`, or null without scenes. */
export function sceneRange(doc: Node, cursor: number): [number, number] | null {
  const types: string[] = [];
  doc.forEach((n) => types.push(n.type.name));
  const starts = types.flatMap((t, i) => (t === "sceneHeading" ? [i] : []));
  if (starts.length === 0) return null;
  const endOf = (start: number) => {
    let i = start + 1;
    while (
      i < types.length &&
      !["sceneHeading", "sequence", "act"].includes(types[i])
    )
      i++;
    return i;
  };
  for (let s = starts.length - 1; s >= 0; s--) {
    if (starts[s] <= cursor && cursor < endOf(starts[s]))
      return [starts[s], endOf(starts[s])];
  }
  // Before the first scene, or on an act or group line: the next scene, else the last one.
  const next = starts.find((s) => s > cursor) ?? starts[starts.length - 1];
  return [next, endOf(next)];
}

/** Indexes of the paragraphs to hide. */
export function hiddenBlocks(
  doc: Node,
  cursor: number,
  options: ViewOptions,
): Set<number> {
  const hidden = new Set<number>();
  const range = options.isolate ? sceneRange(doc, cursor) : null;
  doc.forEach((node, _offset, i) => {
    if (i === cursor) return;
    if (range !== null && (i < range[0] || i >= range[1])) hidden.add(i);
    else if (!options.showBeats && node.type.name === "beat") hidden.add(i);
  });
  return hidden;
}

export function hiddenIn(state: EditorState): Set<number> {
  const options = visibilityKey.getState(state);
  if (options === undefined) throw new Error("Плагин visibility не подключён");
  return hiddenBlocks(
    state.doc,
    blockIndex(state.doc, state.selection.head),
    options,
  );
}

export const visibilityPlugin = new Plugin<ViewOptions>({
  key: visibilityKey,
  state: {
    init: () => ({ showBeats: false, isolate: false }),
    apply(tr, value) {
      const meta = tr.getMeta(visibilityKey) as
        Partial<ViewOptions> | undefined;
      return meta === undefined ? value : { ...value, ...meta };
    },
  },
  props: {
    decorations(state) {
      const hidden = hiddenIn(state);
      if (hidden.size === 0) return DecorationSet.empty;
      const decorations: Decoration[] = [];
      state.doc.forEach((node, offset, i) => {
        if (hidden.has(i)) {
          decorations.push(
            Decoration.node(offset, offset + node.nodeSize, {
              class: "pw-hidden",
            }),
          );
        }
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
});

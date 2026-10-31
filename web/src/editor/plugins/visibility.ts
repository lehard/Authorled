import type { Node } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "prosemirror-state";
import { ReplaceAroundStep, ReplaceStep } from "prosemirror-transform";
import { Decoration, DecorationSet } from "prosemirror-view";

import { OUTLINE_TYPES } from "../elements.ts";

// Hidden paragraphs (design of screenplay-text-tools, decision 2): beats until «Показать биты»,
// and everything outside the scene with the caret in «Только текущая сцена». The document
// does not change; the paragraph with the caret is never hidden.

export type ViewOptions = {
  showBeats: boolean;
  isolate: boolean;
  /** The treatment: only scene headings, beats, groups and acts, beats always shown. */
  outline: boolean;
};

const OUTLINE = new Set<string>(OUTLINE_TYPES);

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
    const type = node.type.name;
    if (options.outline && !OUTLINE.has(type)) hidden.add(i);
    else if (i === cursor) return;
    else if (range !== null && (i < range[0] || i >= range[1])) hidden.add(i);
    else if (!options.outline && !options.showBeats && type === "beat")
      hidden.add(i);
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

export function visibilityPlugin(outline: boolean) {
  return new Plugin<ViewOptions>({
    key: visibilityKey,
    state: {
      init: () => ({ showBeats: false, isolate: false, outline }),
      apply(tr, value) {
        const meta = tr.getMeta(visibilityKey) as
          Partial<ViewOptions> | undefined;
        return meta === undefined ? value : { ...value, ...meta, outline };
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
}

export const outlineGuardKey = new PluginKey("outlineGuard");

/**
 * The treatment never deletes or joins hidden text, and the caret never rests in it
 * (scene-outline-and-cards, decision 3). Loads and imports pass meta `outlineGuardKey: true`.
 */
export const outlineGuardPlugin = new Plugin({
  key: outlineGuardKey,
  filterTransaction(tr) {
    if (tr.getMeta(outlineGuardKey) === true) return true;
    return tr.steps.every((step, i) => {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep))
        return true;
      const { from, to } = step as unknown as { from: number; to: number };
      if (from === to) return true;
      let touchesHidden = false;
      tr.docs[i].nodesBetween(from, to, (node, _pos, parent) => {
        if (parent === tr.docs[i] && !OUTLINE.has(node.type.name))
          touchesHidden = true;
        return false;
      });
      return !touchesHidden;
    });
  },
  appendTransaction(_trs, _old, state) {
    const at = outlineCaret(state.doc, state.selection.head);
    return at === null
      ? null
      : state.tr.setSelection(TextSelection.create(state.doc, at));
  },
});

/** Where the caret goes from a hidden paragraph: the nearest shown one, back first; null if it is shown. */
export function outlineCaret(doc: Node, pos: number): number | null {
  const index = blockIndex(doc, pos);
  if (OUTLINE.has(doc.child(index).type.name)) return null;
  const starts: number[] = [];
  doc.forEach((_n, offset) => starts.push(offset));
  for (let i = index - 1; i >= 0; i--) {
    const n = doc.child(i);
    if (OUTLINE.has(n.type.name)) return starts[i] + n.nodeSize - 1;
  }
  for (let i = index + 1; i < doc.childCount; i++) {
    if (OUTLINE.has(doc.child(i).type.name)) return starts[i] + 1;
  }
  return null;
}

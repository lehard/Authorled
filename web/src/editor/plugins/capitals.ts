import { Plugin, TextSelection, type Transaction } from "prosemirror-state";

import { outlineGuardKey } from "./visibility.ts";

// Scene headings, characters and transitions are stored in capitals, as they are shown
// (web/screenplay-editor, «Заглавные при наборе»). Only what the author changed is touched:
// a text from outside (load, replace) and marks put outside the history are left as they are.

const CAPITALS = new Set(["sceneHeading", "character", "transition"]);

/** Capitals of `text`, keeping the letters whose capital has another length. */
export function capitals(text: string): string {
  return Array.from(text, (ch) => {
    const up = ch.toUpperCase();
    return up.length === ch.length ? up : ch;
  }).join("");
}

function byAuthor(tr: Transaction): boolean {
  return (
    tr.docChanged &&
    tr.getMeta("addToHistory") !== false &&
    tr.getMeta(outlineGuardKey) === undefined
  );
}

export const capitalsPlugin = new Plugin({
  appendTransaction(trs, _old, state) {
    // Changed places, in positions of the final document.
    const ranges: [number, number][] = [];
    trs.forEach((tr, i) => {
      if (!byAuthor(tr)) return;
      tr.mapping.maps.forEach((map, step) => {
        const rest = tr.mapping.slice(step + 1);
        map.forEach((_oldFrom, _oldTo, from, to) => {
          let start = rest.map(from, -1);
          let end = rest.map(to, 1);
          for (const later of trs.slice(i + 1)) {
            start = later.mapping.map(start, -1);
            end = later.mapping.map(end, 1);
          }
          ranges.push([start, end]);
        });
      });
    });
    if (ranges.length === 0) return null;

    const tr = state.tr;
    const seen = new Set<number>();
    for (const [from, to] of ranges) {
      const size = state.doc.content.size;
      // An empty range (a deletion) still names the paragraph it is in.
      const end = Math.min(Math.max(to, from + 1), size);
      state.doc.nodesBetween(Math.min(from, size), end, (node, pos) => {
        if (!node.isTextblock) return true;
        if (seen.has(pos) || !CAPITALS.has(node.type.name)) return false;
        seen.add(pos);
        node.forEach((child, offset) => {
          const text = child.text ?? "";
          const up = capitals(text);
          if (up !== text)
            tr.replaceWith(
              pos + 1 + offset,
              pos + 1 + offset + text.length,
              state.schema.text(up, child.marks),
            );
        });
        return false;
      });
    }
    if (!tr.docChanged) return null;
    const { selection } = state;
    if (selection instanceof TextSelection)
      tr.setSelection(
        TextSelection.create(tr.doc, selection.anchor, selection.head),
      );
    return tr;
  },
});

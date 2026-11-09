import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { cardGapKey } from "./cardGap.ts";

/** Draws the gap of `cardGapStatePlugin`: an empty block between paragraphs. */
export const cardGapPlugin = new Plugin({
  props: {
    decorations(state) {
      const gap = cardGapKey.getState(state);
      if (gap === undefined) throw new Error("Плагин cardGap не подключён");
      if (gap === null) return DecorationSet.empty;
      return DecorationSet.create(state.doc, [
        Decoration.widget(
          gap.pos,
          () => {
            const el = document.createElement("div");
            el.className = "pw-card-gap";
            el.dataset.for = gap.id;
            el.contentEditable = "false";
            el.style.height = `${gap.height}px`;
            return el;
          },
          {
            // Before a page break at the same place (side -1): the card stays on the page of its paragraph.
            side: -2,
            key: `card-gap-${gap.id}-${gap.height}`,
            ignoreSelection: true,
          },
        ),
      ]);
    },
  },
});

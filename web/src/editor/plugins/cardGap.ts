import { Plugin, PluginKey } from "prosemirror-state";

/**
 * A gap under a paragraph for the card of a comment or a suggestion when there is no room
 * beside the page (web/workspace, «Карточки у текста»). The gap is a widget between paragraphs,
 * not a node: the document, its saving and undo do not see it, and the page breaks do not count
 * it. One gap at a time; it follows the text while the author types.
 */
export type CardGap = {
  /** The comment thread or suggestion whose card stands in the gap. */
  id: string;
  /** Position between two top-level blocks: after the paragraph where the place ends. */
  pos: number;
  /** Height of the gap in page pixels (before the scale of the page). */
  height: number;
};

export type CardGapMeta = { show: CardGap } | { hide: string };

export const cardGapKey = new PluginKey<CardGap | null>("cardGap");

/** The state of the gap; `cardGapPlugin.ts` draws it. */
export const cardGapStatePlugin = new Plugin<CardGap | null>({
  key: cardGapKey,
  state: {
    init: () => null,
    apply(tr, gap) {
      const meta = tr.getMeta(cardGapKey) as CardGapMeta | undefined;
      if (meta !== undefined) {
        if ("show" in meta) return meta.show;
        // Only the card that opened the gap closes it: another card may have opened its own.
        return gap !== null && gap.id === meta.hide ? null : gap;
      }
      if (gap === null || !tr.docChanged) return gap;
      const mapped = tr.mapping.mapResult(gap.pos);
      return mapped.deleted ? null : { ...gap, pos: mapped.pos };
    },
  },
});

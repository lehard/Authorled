import type { CSSProperties } from "react";

import type { CommentAnchor } from "@/editor";

/** Width of a card beside the text: comment thread, co-author suggestion. */
export const CARD = 300;

/**
 * Where a card stands (screenplay-comments, decision 6): beside the page at the height of the
 * fragment, else over the page's right edge under it, else full width under it; without a
 * shown fragment — at the top right.
 */
export function cardPlace(a: CommentAnchor | null): CSSProperties {
  if (a === null)
    return { top: 8, right: 8, width: `min(${CARD}px, calc(100% - 16px))` };
  if (a.width - a.pageRight >= CARD + 16)
    return { top: Math.max(0, a.top - 8), left: a.pageRight + 16, width: CARD };
  if (a.width >= 560)
    return {
      top: a.bottom + 6,
      right: Math.max(8, a.width - a.pageRight + 8),
      width: CARD,
    };
  return { top: a.bottom + 6, left: 8, right: 8 };
}

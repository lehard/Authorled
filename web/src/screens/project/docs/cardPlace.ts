import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

import type { CommentAnchor } from "@/editor";
import type { ScreenplayEditorHandle } from "@/editor/ScreenplayEditor";

/** Width of a card beside the text: comment thread, co-author suggestion. */
export const CARD = 300;
/** Height of a gap before the card has measured itself. */
const FIRST_GAP = 160;

/** Whether a card fits beside the page, at the height of the fragment. */
function besidePage(a: CommentAnchor): boolean {
  return a.width - a.pageRight >= CARD + 16;
}

/**
 * A card beside the page at the height of the fragment (screenplay-comments, decision 6); without
 * a shown fragment — at the top right.
 */
export function cardPlace(a: CommentAnchor | null): CSSProperties {
  if (a === null)
    return { top: 8, right: 8, width: `min(${CARD}px, calc(100% - 16px))` };
  return { top: Math.max(0, a.top - 8), left: a.pageRight + 16, width: CARD };
}

/**
 * Where the open card of a comment or a suggestion stands (web/workspace, «Карточки у текста»):
 * beside the page when it fits, else in a gap under the paragraph of the fragment, so the card
 * never covers the text. The gap follows the height the card reports (`fit`).
 */
export function useCardPlace(editor: RefObject<ScreenplayEditorHandle | null>) {
  const [style, setStyle] = useState<CSSProperties>({});
  // The card standing in a gap, if any.
  const gap = useRef<string | null>(null);

  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };

  function release() {
    if (gap.current === null) return;
    // The editor is gone with its gap when the screen closes.
    editor.current?.hideCardGap(gap.current);
    gap.current = null;
  }

  function fit(height: number) {
    const id = gap.current;
    if (id === null) return;
    const at = view().showCardGap(id, height);
    if (at === null) {
      release();
      setStyle(cardPlace(null));
      return;
    }
    setStyle({ top: at.top, left: at.left, right: at.right });
  }

  function place(id: string, anchor: CommentAnchor | null) {
    release();
    if (anchor === null || besidePage(anchor)) {
      setStyle(cardPlace(anchor));
      return;
    }
    gap.current = id;
    fit(FIRST_GAP);
  }

  return { style, place, fit, release };
}

/** Reports the height of a card whenever it changes: its gap in the text follows it. */
export function useCardHeight(
  card: RefObject<HTMLElement | null>,
  onHeight: ((height: number) => void) | undefined,
) {
  const latest = useRef(onHeight);
  useEffect(() => {
    latest.current = onHeight;
  });
  useEffect(() => {
    const el = card.current;
    if (el === null) throw new Error("Карточка не отрисована");
    const observer = new ResizeObserver(() =>
      latest.current?.(el.getBoundingClientRect().height),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [card]);
}

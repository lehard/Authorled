import { useEffect, useRef, type RefObject } from "react";

// Places in the text that open a card: a press on them is not «outside».
const PLACES = ".pw-comment-open, .pw-suggestion-del, .pw-suggestion-ins";

/**
 * Escape and a press outside the card and outside open places in the text close it; menus and
 * dialogs of the card live in portals and do not count as outside. On mount the card scrolls
 * into view: under the fragment it may start below the fold.
 */
export function useCardDismiss(
  card: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    const inside = (target: EventTarget | null) =>
      target instanceof Element &&
      (card.current?.contains(target) === true ||
        target.closest(
          `${PLACES}, [data-radix-popper-content-wrapper], [role='alertdialog']`,
        ) !== null);
    const down = (e: MouseEvent) => {
      if (!inside(e.target)) latestClose.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // ProseMirror prevents every Escape typed in the text; there it closes the card unless
      // the list of suggestions is open (that Escape closes the list only).
      const inText =
        e.target instanceof Element &&
        e.target.closest(".ProseMirror") !== null;
      // The editor's list of suggestions stands next to its host `.pw-editor`.
      const listOpen =
        document.querySelector(".pw-editor ~ [role='listbox']") !== null;
      if (e.defaultPrevented && !(inText && !listOpen)) return;
      if (
        document.querySelector("[role='menu'], [role='alertdialog']") !== null
      )
        return;
      latestClose.current();
    };
    card.current?.scrollIntoView({ block: "nearest" });
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [card]);
}

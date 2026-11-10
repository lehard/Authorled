import { useEffect, useState } from "react";

const MAX = 2000;
/** How long the page may change before the fragment is looked for again. */
const RECHECK_MS = 300;

/** Text as seen, without the spaces and line breaks that differ between a selection and the page. */
function squash(text: string): string {
  return text.replace(/\s+/gu, "").toLowerCase();
}

/** Whether `fragment` is still in the open document (elements marked `data-chat-source`). */
function inOpenDocument(fragment: string): boolean {
  const sources = document.querySelectorAll<HTMLElement>("[data-chat-source]");
  const text = Array.from(sources, (source) => source.innerText).join("");
  return squash(text).includes(squash(fragment));
}

/**
 * Text the author selects inside elements marked `data-chat-source` (the workspace). It stays when
 * the selection goes (a click in the chat) and goes when the fragment is no longer in the open
 * document: deleted, rewritten or another document opened (web/workspace, «Контекст соавтора»).
 */
export function useSelectionIn(): [string, () => void] {
  // The document is its address: another one opened takes the fragment away.
  const [selection, setSelection] = useState({ text: "", path: "" });
  useEffect(() => {
    const onChange = () => {
      const s = document.getSelection();
      if (s === null || s.isCollapsed || s.rangeCount === 0) return;
      const node = s.getRangeAt(0).commonAncestorContainer;
      const element = node instanceof Element ? node : node.parentElement;
      if (element?.closest("[data-chat-source]") == null) return;
      const text = s.toString().trim();
      if (text !== "")
        setSelection({
          text: text.slice(0, MAX),
          path: window.location.pathname,
        });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);
  useEffect(() => {
    if (selection.text === "") return;
    let timer: number | undefined;
    const recheck = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (
          window.location.pathname !== selection.path ||
          !inOpenDocument(selection.text)
        )
          setSelection({ text: "", path: "" });
      }, RECHECK_MS);
    };
    const observer = new MutationObserver(recheck);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [selection]);
  return [selection.text, () => setSelection({ text: "", path: "" })];
}

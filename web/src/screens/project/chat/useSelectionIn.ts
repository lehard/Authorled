import { useEffect, useState } from "react";

const MAX = 2000;

/** Text the author selects inside elements marked `data-chat-source` (the workspace). */
export function useSelectionIn(): [string, () => void] {
  const [selection, setSelection] = useState("");
  useEffect(() => {
    const onChange = () => {
      const s = document.getSelection();
      if (s === null || s.isCollapsed || s.rangeCount === 0) return;
      const node = s.getRangeAt(0).commonAncestorContainer;
      const element = node instanceof Element ? node : node.parentElement;
      if (element?.closest("[data-chat-source]") == null) return;
      const text = s.toString().trim();
      if (text !== "") setSelection(text.slice(0, MAX));
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);
  return [selection, () => setSelection("")];
}

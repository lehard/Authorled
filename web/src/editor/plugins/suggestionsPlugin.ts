import { Plugin, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { suggestionRanges, suggestionsKey } from "./suggestions.ts";

// How open co-author suggestions look and open (coauthor-suggestions, decision 2): the old text
// struck through, the suggested text after it as a widget that cannot be edited.

function suggestedText(id: string, text: string, active: boolean) {
  const ins = document.createElement("ins");
  ins.className = active
    ? "pw-suggestion-ins pw-suggestion-active"
    : "pw-suggestion-ins";
  ins.dataset.suggestionId = id;
  ins.contentEditable = "false";
  ins.textContent = text;
  return ins;
}

/** The open suggestion under a clicked element, or null. */
function suggestionAt(
  target: EventTarget | null,
  root: HTMLElement,
  open: ReadonlyMap<string, string>,
) {
  let el = target instanceof Element ? target : null;
  while (el !== null && el !== root) {
    const id = el.getAttribute("data-suggestion-id");
    if (id !== null && open.has(id)) return id;
    el = el.parentElement;
  }
  return null;
}

export function suggestionsPlugin(onOpen: (id: string) => void): Plugin {
  return new Plugin({
    props: {
      decorations(state: EditorState) {
        const s = suggestionsKey.getState(state);
        if (s === undefined || s.open.size === 0) return DecorationSet.empty;
        const decorations: Decoration[] = [];
        for (const [id, text] of s.open) {
          const ranges = suggestionRanges(state.doc, id);
          const active = id === s.active;
          for (const r of ranges) {
            decorations.push(
              Decoration.inline(r.from, r.to, {
                class: active
                  ? "pw-suggestion-del pw-suggestion-active"
                  : "pw-suggestion-del",
              }),
            );
          }
          const last = ranges.at(-1);
          if (last !== undefined && text !== "") {
            decorations.push(
              Decoration.widget(
                last.to,
                () => suggestedText(id, text, active),
                {
                  side: -1,
                  key: `${id}:${active}:${text}`,
                  ignoreSelection: true,
                },
              ),
            );
          }
        }
        return DecorationSet.create(state.doc, decorations);
      },
      handleClick(view, _pos, event) {
        const s = suggestionsKey.getState(view.state);
        if (s === undefined) return false;
        const id = suggestionAt(event.target, view.dom, s.open);
        if (id !== null) onOpen(id);
        return false;
      },
    },
  });
}

// Marks «стр. N» on the right margin of the continuous sheet (openspec/specs/web/prose-editor, «Метки
// страниц на листе»; design of synopsis-editor, decision 7). They are drawn outside the editable text, so
// they never split a paragraph and never get into a selection, a copy or the context of the co-author.
import type { EditorView } from "prosemirror-view";

import type { ProseLayout } from "./layout.ts";
import { positionOf } from "./positions.ts";

export type PageMark = { page: number; top: number };

/** Heights of the lines that open pages 2, 3… relative to the top of `sheet`. */
export function pageMarks(
  view: EditorView,
  layout: ProseLayout,
  sheet: HTMLElement,
): PageMark[] {
  const sheetTop = sheet.getBoundingClientRect().top;
  return layout.pages.slice(1).map((start, index) => {
    const pos = positionOf(view.state.doc, start);
    // side 1: the character after the position, i.e. the first one of the new page.
    const coords = view.coordsAtPos(pos, 1);
    return { page: index + 2, top: coords.top - sheetTop };
  });
}

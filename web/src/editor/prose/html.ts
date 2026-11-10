// The synopsis page (openspec/specs/web/prose-editor, «Вёрстка страницы синопсиса»; design of
// synopsis-editor, decision 5): one CSS and one way to draw a block, for the hidden measuring block and
// for the print window alike, so the pages of both are the same.
import type { Node } from "prosemirror-model";

import { PRINT_FONT } from "./printFont.ts";

/** A4 with margins of 25 mm: the text column. */
export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 25,
} as const;
export const TEXT_WIDTH_MM = PAGE.widthMm - 2 * PAGE.marginMm;
export const TEXT_HEIGHT_MM = PAGE.heightMm - 2 * PAGE.marginMm;

/** Rules of the text column (`.pp-body`) and of its blocks; `.pp-first` drops the margin above. */
export const BODY_CSS = `
.pp-body { width: ${TEXT_WIDTH_MM}mm; font-family: "${PRINT_FONT}"; font-size: 12pt; line-height: 1.15; color: inherit; }
.pp-body > * { margin: 0 0 6pt; white-space: pre-wrap; overflow-wrap: break-word; }
.pp-body > h1, .pp-body > h2 { font-weight: 700; margin-top: 12pt; }
.pp-body > h1 { font-size: 16pt; }
.pp-body > h2 { font-size: 14pt; }
.pp-body > .pp-first { margin-top: 0; }
.pp-head { width: ${TEXT_WIDTH_MM}mm; font-family: "${PRINT_FONT}"; font-size: 12pt; line-height: 1.15; text-align: center; padding-bottom: 18pt; }
.pp-head-title { font-size: 14pt; font-weight: 700; margin-bottom: 4pt; }
`;

/** A text piece of a block in the DOM and where it starts in the block (ProseMirror offset). */
export type Piece = { node: globalThis.Node; start: number; size: number };

/** The element of a block, from `from` to `to` of its content, and its pieces. */
export function blockElement(
  doc: Document,
  block: Node,
  from = 0,
  to = block.content.size,
): { element: HTMLElement; pieces: Piece[] } {
  const tag =
    block.type.name === "heading" ? `h${block.attrs.level as number}` : "p";
  const element = doc.createElement(tag);
  const pieces: Piece[] = [];
  block.forEach((child, offset) => {
    const start = Math.max(offset, from);
    const end = Math.min(offset + child.nodeSize, to);
    if (start >= end) return;
    if (child.type.name === "hard_break") {
      const br = doc.createElement("br");
      element.appendChild(br);
      pieces.push({ node: br, start, size: 1 });
      return;
    }
    const text = (child.text ?? "").slice(start - offset, end - offset);
    let target: globalThis.Node = doc.createTextNode(text);
    pieces.push({ node: target, start, size: text.length });
    for (const mark of child.marks) {
      const name = mark.type.name === "strong" ? "strong" : "em";
      const wrapper = doc.createElement(name);
      wrapper.appendChild(target);
      target = wrapper;
    }
    element.appendChild(target);
  });
  // An empty paragraph is one line, as the editor shows it.
  if (pieces.length === 0) element.appendChild(doc.createElement("br"));
  return { element, pieces };
}

/** The head over the text of the first page: the title of the story and «Синопсис». */
export function headElement(doc: Document, title: string): HTMLElement {
  const head = doc.createElement("div");
  head.className = "pp-head";
  const name = doc.createElement("div");
  name.className = "pp-head-title";
  name.textContent = title;
  const kind = doc.createElement("div");
  kind.textContent = "Синопсис";
  head.append(name, kind);
  return head;
}

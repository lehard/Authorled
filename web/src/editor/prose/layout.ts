// Pages of the synopsis (openspec/specs/web/prose-editor, «Вёрстка страницы синопсиса»; design of
// synopsis-editor, decision 5). The blocks are drawn in a hidden column of the print page and their lines
// are laid on pages of A4. The count on the toolbar, the marks on the sheet and the print take the result,
// so they agree.
import type { Node } from "prosemirror-model";

import {
  BODY_CSS,
  blockElement,
  headElement,
  TEXT_HEIGHT_MM,
  type Piece,
} from "./html.ts";
import { countChars, countWords, proseText } from "./markdown.ts";
import { loadPrintFont } from "./printFont.ts";

/** Where a page starts: a top-level block and an offset in its content. */
export type PageStart = { block: number; offset: number };

export type ProseLayout = {
  /** The document laid out: a layout of an older document is not used for the current one. */
  doc: Node;
  /** One start per page; the first is always the start of the text. */
  pages: PageStart[];
  words: number;
  chars: number;
};

const PX_PER_MM = 96 / 25.4;
const PAGE_HEIGHT = TEXT_HEIGHT_MM * PX_PER_MM;

type Line = { top: number; bottom: number };
type Measured = {
  heading: boolean;
  marginTop: number;
  marginBottom: number;
  lines: Line[];
  pieces: Piece[];
  element: HTMLElement;
};

let column: HTMLElement | null = null;

function measuringColumn(): HTMLElement {
  if (column !== null && column.isConnected) return column;
  const style = document.createElement("style");
  style.textContent = BODY_CSS;
  document.head.appendChild(style);
  column = document.createElement("div");
  column.setAttribute("aria-hidden", "true");
  // Out of the screen but laid out: `visibility: hidden` keeps the geometry. `contain: strict` keeps the
  // layout inside the column, so a measure does not lay out the whole page of the app again (the budget of
  // web/prose-editor: up to 100 ms for 15 pages); the boxes of the clipped text still have their places.
  column.style.cssText =
    "position: fixed; left: -10000px; top: 0; width: 200mm; height: 1px; overflow: hidden; contain: strict; visibility: hidden; pointer-events: none;";
  document.body.appendChild(column);
  return column;
}

/** Lines of an element from the boxes of its text, relative to the top of the element. */
function linesOf(element: HTMLElement): Line[] {
  const top = element.getBoundingClientRect().top;
  const range = document.createRange();
  range.selectNodeContents(element);
  const boxes = Array.from(range.getClientRects())
    .filter((r) => r.height > 0)
    .map((r) => ({ top: r.top - top, bottom: r.bottom - top }))
    .sort((a, b) => a.top - b.top);
  const lines: Line[] = [];
  for (const box of boxes) {
    const last = lines.at(-1);
    // Boxes of one line overlap vertically (bold and italic pieces of the same size).
    if (last !== undefined && box.top < last.bottom - 1)
      last.bottom = Math.max(last.bottom, box.bottom);
    else lines.push({ ...box });
  }
  if (lines.length === 0)
    throw new Error("Вёрстка синопсиса: у абзаца нет строк");
  return lines;
}

/** The first offset of the block whose character is on the line starting at `lineTop`. */
function offsetOfLine(measured: Measured, lineTop: number): number {
  const elementTop = measured.element.getBoundingClientRect().top;
  const range = document.createRange();
  const topOf = (piece: Piece, at: number): number => {
    if (piece.node.nodeName === "BR") {
      range.selectNode(piece.node);
    } else {
      range.setStart(piece.node, at);
      range.setEnd(piece.node, at + 1);
    }
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.height > 0,
    );
    const rect = rects.at(-1) ?? range.getBoundingClientRect();
    return rect.top - elementTop;
  };
  for (const piece of measured.pieces) {
    if (piece.size === 0) continue;
    if (piece.node.nodeName === "BR") {
      if (topOf(piece, 0) >= lineTop - 1) return piece.start;
      continue;
    }
    if (topOf(piece, piece.size - 1) < lineTop - 1) continue;
    // Binary search inside the piece: tops grow with the offset.
    let low = 0;
    let high = piece.size - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (topOf(piece, middle) >= lineTop - 1) high = middle;
      else low = middle + 1;
    }
    return piece.start + low;
  }
  throw new Error(
    `Вёрстка синопсиса: строка на высоте ${lineTop.toFixed(1)} не найдена в абзаце`,
  );
}

/** Lays the document out on A4 pages; `title` is the head of the first page. */
export async function layoutProse(
  doc: Node,
  title: string,
): Promise<ProseLayout> {
  await loadPrintFont();
  const host = measuringColumn();
  host.replaceChildren();
  const head = headElement(document, title);
  const body = document.createElement("div");
  body.className = "pp-body";
  host.append(head, body);
  const headHeight = head.getBoundingClientRect().height;

  const measured: Measured[] = [];
  doc.forEach((block) => {
    const { element, pieces } = blockElement(document, block);
    body.appendChild(element);
    measured.push({
      heading: block.type.name === "heading",
      marginTop: 0,
      marginBottom: 0,
      lines: [],
      pieces,
      element,
    });
  });
  for (const m of measured) {
    const style = getComputedStyle(m.element);
    m.marginTop = parseFloat(style.marginTop);
    m.marginBottom = parseFloat(style.marginBottom);
    m.lines = linesOf(m.element);
  }

  const pages: PageStart[] = [{ block: 0, offset: 0 }];
  let height = PAGE_HEIGHT - headHeight;
  // Bottom of the text on the current page, and the margin under the last block placed.
  let used = 0;
  let below = 0;
  let firstOnPage = true;
  const newPage = (start: PageStart) => {
    pages.push(start);
    height = PAGE_HEIGHT;
    used = 0;
    below = 0;
    firstOnPage = true;
  };

  for (let index = 0; index < measured.length; index++) {
    const m = measured[index];
    let lineFrom = 0;
    while (lineFrom < m.lines.length) {
      // Margins collapse between blocks; the first block of a page has none above it.
      const gap = firstOnPage ? 0 : Math.max(below, m.marginTop);
      const origin = m.lines[lineFrom].top;
      let fits = lineFrom;
      while (
        fits < m.lines.length &&
        used + gap + (m.lines[fits].bottom - origin) <= height + 0.5
      )
        fits++;
      if (fits === m.lines.length) {
        used += gap + (m.lines[fits - 1].bottom - origin);
        below = m.marginBottom;
        firstOnPage = false;
        break;
      }
      if (fits === lineFrom) {
        if (firstOnPage)
          throw new Error("Вёрстка синопсиса: строка выше страницы");
        // A heading does not stay the last line of a page: it goes with the line after it.
        const previous = measured[index - 1];
        if (lineFrom === 0 && previous?.heading === true) {
          const startOfHeading = pages.at(-1)?.block !== index - 1;
          if (startOfHeading) {
            newPage({ block: index - 1, offset: 0 });
            index -= 2;
            lineFrom = m.lines.length;
            continue;
          }
        }
        newPage({
          block: index,
          offset: lineFrom === 0 ? 0 : offsetOfLine(m, m.lines[lineFrom].top),
        });
        continue;
      }
      // Part of the block fits: the rest opens the next page.
      newPage({ block: index, offset: offsetOfLine(m, m.lines[fits].top) });
      lineFrom = fits;
    }
  }

  const text = proseText(doc);
  return { doc, pages, words: countWords(text), chars: countChars(doc) };
}

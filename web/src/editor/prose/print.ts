// Printing the synopsis (openspec/specs/web/prose-editor, «Печать синопсиса»; design of synopsis-editor,
// decision 8): a window with the pages already laid out by layoutProse, so the print has the pages the
// toolbar counts. The window lays nothing out again.
import type { Node } from "prosemirror-model";

import { PrintError } from "../exporters/print.ts";
import { BODY_CSS, blockElement, headElement, PAGE } from "./html.ts";
import type { ProseLayout } from "./layout.ts";
import { PRINT_FONT, printFontFaces } from "./printFont.ts";

function printColours(): string {
  const css = getComputedStyle(document.documentElement);
  const pick = (name: string) => {
    const value = css.getPropertyValue(`--print-${name}`).trim();
    if (value === "")
      throw new Error(`Токен --print-${name} не задан в tokens.css`);
    return value;
  };
  return `:root { --ink: ${pick("ink")}; --sheet: ${pick("paper")}; --around: ${pick("desk")}; }`;
}

const STYLE = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "${PRINT_FONT}"; color: var(--ink); background: var(--sheet); }
.pp-page { position: relative; width: ${PAGE.widthMm}mm; height: ${PAGE.heightMm}mm; padding: ${PAGE.marginMm}mm; background: var(--sheet); overflow: hidden; break-after: page; }
.pp-page:last-child { break-after: auto; }
.pp-number { position: absolute; left: 0; right: 0; bottom: 12mm; text-align: center; font-family: inherit; font-size: 11pt; }
@media screen {
  html { background: var(--around); }
  body { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0 80px; background: var(--around); }
}
`;

/**
 * Opens the print window with the pages of `layout`; the title of the story heads the first page. The
 * dialog opens once every face of the page font is loaded in the window; a face that fails is an error.
 */
export async function printProse(
  doc: Node,
  layout: ProseLayout,
  title: string,
): Promise<void> {
  const win = window.open("", "_blank");
  if (win === null) {
    throw new PrintError(
      "Браузер не открыл окно печати: разрешите всплывающие окна для этого сайта и повторите.",
    );
  }
  const page = win.document;
  page.open();
  page.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title></title>
<style>${printFontFaces()}${printColours()}${BODY_CSS}${STYLE}</style></head><body></body></html>`);
  page.close();
  page.title = `${title} — Синопсис`;

  const blocks: Node[] = [];
  doc.forEach((block) => blocks.push(block));
  layout.pages.forEach((start, number) => {
    const end = layout.pages[number + 1] ?? {
      block: blocks.length,
      offset: 0,
    };
    const sheet = page.createElement("div");
    sheet.className = "pp-page";
    if (number === 0) sheet.appendChild(headElement(page, title));
    const body = page.createElement("div");
    body.className = "pp-body";
    for (let index = start.block; index <= end.block; index++) {
      if (index === blocks.length) break;
      const from = index === start.block ? start.offset : 0;
      const to = index === end.block ? end.offset : blocks[index].content.size;
      if (index === end.block && end.offset === 0) break;
      const { element } = blockElement(page, blocks[index], from, to);
      if (body.childElementCount === 0) element.classList.add("pp-first");
      body.appendChild(element);
    }
    const footer = page.createElement("div");
    footer.className = "pp-number";
    footer.textContent = String(number + 1);
    sheet.append(body, footer);
    page.body.appendChild(sheet);
  });
  const faces = ["normal 400", "italic 400", "normal 700", "italic 700"];
  let loaded: FontFace[][];
  try {
    loaded = await Promise.all(
      faces.map((face) =>
        page.fonts.load(`${face} 12pt "${PRINT_FONT}"`, "Аа"),
      ),
    );
  } catch (error) {
    win.close();
    throw new Error(
      `Печать синопсиса: шрифт страницы не загрузился в окне печати: ${String(error)}`,
      { cause: error },
    );
  }
  // `load` gives no face, not an error, when none matches.
  if (loaded.some((found) => found.length === 0)) {
    win.close();
    throw new Error(
      "Печать синопсиса: в окне печати нет шрифта страницы «Prose Print».",
    );
  }
  win.print();
}

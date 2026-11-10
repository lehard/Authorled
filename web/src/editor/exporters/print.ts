import type { Node } from "prosemirror-model";

import cyr400 from "@fontsource/cousine/files/cousine-cyrillic-400-normal.woff2?url";
import cyr400i from "@fontsource/cousine/files/cousine-cyrillic-400-italic.woff2?url";
import cyr700 from "@fontsource/cousine/files/cousine-cyrillic-700-normal.woff2?url";
import lat400 from "@fontsource/cousine/files/cousine-latin-400-normal.woff2?url";
import lat400i from "@fontsource/cousine/files/cousine-latin-400-italic.woff2?url";
import lat700 from "@fontsource/cousine/files/cousine-latin-700-normal.woff2?url";

import { elementClass, isElementName } from "../elements.ts";

// Printing to PDF from the browser: a separate window with the pages, then print().
// The font comes from our build, so printing reaches no third-party host.

export type TitlePage = {
  title: string;
  genre: string;
  author: string;
  contacts: string;
  place: string;
};

/** The browser did not open the print window (a pop-up blocker). */
export class PrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintError";
  }
}

const UNICODE = {
  latin:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
};

function fontFaces(): string {
  const abs = (url: string) => new URL(url, window.location.href).href;
  const faces: [string, keyof typeof UNICODE, number, string][] = [
    [lat400, "latin", 400, "normal"],
    [lat400i, "latin", 400, "italic"],
    [lat700, "latin", 700, "normal"],
    [cyr400, "cyrillic", 400, "normal"],
    [cyr400i, "cyrillic", 400, "italic"],
    [cyr700, "cyrillic", 700, "normal"],
  ];
  return faces
    .map(
      ([url, range, weight, style]) =>
        `@font-face { font-family: "Cousine"; font-weight: ${weight}; font-style: ${style}; src: url("${abs(url)}") format("woff2"); unicode-range: ${UNICODE[range]}; }`,
    )
    .join("\n");
}

// Print colours are design-system tokens (--print-*), the same in every theme.
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

function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Text colour and fill are the author's marks on screen; the manuscript prints in black.
function inline(node: Node): string {
  const parts: string[] = [];
  node.forEach((child) => {
    let html = escapeHTML(child.text ?? "");
    for (const mark of child.marks) {
      if (mark.type.name === "bold") html = `<strong>${html}</strong>`;
      if (mark.type.name === "italic") html = `<em>${html}</em>`;
      if (mark.type.name === "underline") html = `<u>${html}</u>`;
    }
    parts.push(html);
  });
  return parts.join("");
}

function body(doc: Node): string {
  const blocks: string[] = [];
  let scene = 0;
  doc.forEach((node) => {
    const name = node.type.name;
    if (name === "pageBreak") return;
    if (!isElementName(name))
      throw new Error(`Нет оформления печати для «${name}»`);
    const cls = elementClass(name);
    if (name === "sceneHeading") {
      scene++;
      blocks.push(
        `<p class="${cls}" data-type="${name}"><span class="sn sn-l">${scene}</span>${inline(node)}<span class="sn sn-r">${scene}</span></p>`,
      );
    } else {
      blocks.push(`<p class="${cls}" data-type="${name}">${inline(node)}</p>`);
    }
  });
  return blocks.join("\n");
}

function titleHTML(t: TitlePage): string {
  const line = (cls: string, text: string) =>
    text.trim() === "" ? "" : `<p class="${cls}">${escapeHTML(text)}</p>`;
  const author =
    t.author.trim() === ""
      ? ""
      : `<p class="tp-by">Автор</p>${line("tp-author", t.author)}`;
  // The same composition as the sheet on the screen (web/workspace, «Композиция титульной страницы»):
  // the block starts at 42 % of the text area, the contacts bottom left, the place bottom right.
  return `<div class="page title-page">
<div></div>
<div class="tp-main">${line("tp-title", t.title)}${line("tp-genre", t.genre)}${author}</div>
<div></div>
<div class="tp-foot"><div class="tp-contacts-col">${line("tp-contacts", t.contacts)}</div>${line("tp-place", t.place)}</div>
</div>`;
}

const STYLE = `
@page { size: 8.5in 11in; margin: 1in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Cousine", monospace; font-size: 12pt; line-height: 16px; color: var(--ink); background: var(--sheet); }
p { line-height: 16px; min-height: 16px; position: relative; orphans: 2; widows: 2; white-space: pre-wrap; }
.pm-scene-heading { text-transform: uppercase; font-weight: bold; width: 6in; margin-top: 32px; page-break-after: avoid; }
.pm-scene-characters { text-transform: uppercase; width: 6in; }
.pm-action, .pm-unformatted, .pm-shot, .pm-inline-note, .pm-beat { width: 6in; margin-top: 16px; }
.pm-shot { text-transform: uppercase; }
.pm-inline-note, .pm-beat { font-style: italic; }
.pm-character { margin-left: 2.2in; width: 3.8in; text-transform: uppercase; margin-top: 16px; page-break-after: avoid; }
.pm-dialogue, .pm-lyrics { margin-left: 1in; width: 3.5in; page-break-before: avoid; }
.pm-lyrics { font-style: italic; }
.pm-parenthetical { margin-left: 1.6in; width: 2.3in; page-break-before: avoid; page-break-after: avoid; }
.pm-parenthetical::before { content: "("; }
.pm-parenthetical::after { content: ")"; }
.pm-transition { text-align: right; text-transform: uppercase; width: 6in; margin-top: 16px; }
.pm-act { text-align: center; text-transform: uppercase; font-weight: bold; width: 6in; margin-top: 32px; }
.pm-sequence { text-transform: uppercase; width: 6in; margin-top: 32px; }
.sn { position: absolute; top: 0; font-weight: bold; }
.sn-l { right: calc(100% + 12px); }
.sn-r { left: calc(100% + 12px); }
.page-number { display: block; text-align: right; margin-bottom: 16px; }
.title-page { display: grid; grid-template-rows: minmax(0, 42%) auto minmax(32px, 1fr) auto; text-align: center; }
.tp-title { font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
.tp-genre { margin-bottom: 32px; }
.tp-foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; text-align: left; }
.tp-contacts-col { flex: 1; min-width: 0; }
.tp-place { max-width: 50%; text-align: right; }
.title-page p { overflow-wrap: anywhere; }
@media screen {
  html { background: var(--around); }
  body { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0 80px; }
  .page { width: 8.5in; height: 11in; padding: 1in 1in 1in 1.5in; background: var(--sheet); overflow: hidden; }
}
@media print {
  .page { page-break-after: always; height: 9in; padding-left: 0.5in; overflow: hidden; }
  .title-page { padding-left: 0; }
  .page:last-child { page-break-after: auto; }
}
`;

// Runs inside the print window: lays the paragraphs out on pages, then opens the print dialog.
// Character cues stay with their speech.
const PAGINATE = `
function paginate() {
  var probe = document.createElement("div");
  probe.className = "page";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  var cs = getComputedStyle(probe);
  var number = document.createElement("span");
  number.className = "page-number";
  number.textContent = "1.";
  probe.appendChild(number);
  var height = probe.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    - number.offsetHeight - parseFloat(getComputedStyle(number).marginBottom);
  probe.remove();
  if (!(height > 0)) throw new Error("Печать: не удалось измерить высоту страницы");

  var paras = Array.from(document.querySelectorAll("#script > p"));
  document.getElementById("script").remove();
  var pages = 0, page, used = 0;
  function newPage() {
    pages++;
    page = document.createElement("div");
    page.className = "page";
    var n = document.createElement("span");
    n.className = "page-number";
    n.textContent = pages + ".";
    page.appendChild(n);
    document.body.appendChild(page);
    used = 0;
  }
  function size(p) {
    var s = getComputedStyle(p);
    return p.getBoundingClientRect().height + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
  }
  var SPEECH = ["dialogue", "parenthetical", "lyrics"];
  newPage();
  paras.forEach(function (p) {
    page.appendChild(p);
    var h = size(p);
    if (used + h <= height || used === 0) { used += h; return; }
    var moved = [p];
    if (SPEECH.indexOf(p.dataset.type) !== -1) {
      var prev = p.previousElementSibling;
      while (prev && prev.tagName === "P") {
        var t = prev.dataset.type;
        if (t !== "character" && SPEECH.indexOf(t) === -1) break;
        moved.unshift(prev);
        if (t === "character") break;
        prev = prev.previousElementSibling;
      }
      // Without its cue on this page, or when the cue opens the page, only this paragraph moves.
      if (moved[0].dataset.type !== "character" || moved[0] === page.querySelector("p")) moved = [p];
    }
    newPage();
    used = 0;
    moved.forEach(function (m) { page.appendChild(m); used += size(m); });
  });
  document.querySelectorAll(".page").forEach(function (pg) {
    var first = pg.querySelector("p");
    if (first) first.style.marginTop = "0";
  });
}
document.fonts.ready.then(function () { paginate(); window.print(); });
`;

/** Opens the print window: the title page (when it has any field) and the pages numbered from 1. */
export function printScreenplay(doc: Node, titlePage: TitlePage): void {
  const win = window.open("", "_blank");
  if (win === null) {
    throw new PrintError(
      "Браузер не открыл окно печати: разрешите всплывающие окна для этого сайта и повторите.",
    );
  }
  const hasTitle = Object.values(titlePage).some((v) => v.trim() !== "");
  const title = titlePage.title.trim() === "" ? "Сценарий" : titlePage.title;
  win.document.write(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${escapeHTML(title)}</title>
<style>${fontFaces()}${printColours()}${STYLE}</style></head>
<body>${hasTitle ? titleHTML(titlePage) : ""}<div id="script">${body(doc)}</div>
<script>${PAGINATE}</script></body></html>`);
  win.document.close();
}

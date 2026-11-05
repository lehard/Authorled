// Export samples of the editor (design of story-data-web, decision 9): one document with all 14
// paragraph types, exported to Fountain and FDX. The core tests import these files
// (agno/tests/test_import.py), so the round trip is checked against the current export.
// `npm run check:editor` compares them; `npm run samples:export` writes them again.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { plainDoc, toNode } from "../src/editor/document.ts";
import type { ElementName } from "../src/editor/elements.ts";
import { docToFDX } from "../src/editor/exporters/fdx.ts";
import { docToFountain } from "../src/editor/exporters/fountain.ts";

const DIR = new URL("../../agno/tests/fixtures/import/", import.meta.url);

export const SAMPLE_ROWS: [ElementName, string][] = [
  ["act", "Акт первый"],
  ["sequence", "Утро"],
  ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — РАССВЕТ"],
  ["sceneCharacters", "Вера, Миша"],
  ["beat", "Вера приходит к воде"],
  ["action", "Туман над водой. Вера стоит у края мостков."],
  ["shot", "КРУПНО: её руки"],
  ["character", "ВЕРА"],
  ["parenthetical", "тихо"],
  ["dialogue", "Двадцать лет."],
  ["lyrics", "Ой, вода, вода"],
  ["inlineNote", "Проверить время рассвета"],
  ["unformatted", "Простой текст"],
  ["transition", "CUT TO:"],
  ["sceneHeading", "ИНТ. ДОМ ВЕРЫ — ДЕНЬ"],
  ["character", "МИША (ЗК)"],
  ["dialogue", "Мама, ты где?"],
];

/** File path → what the current export writes for the sample document. */
export function exportedSamples(): Map<string, string> {
  const doc = toNode(plainDoc(SAMPLE_ROWS));
  return new Map([
    [fileURLToPath(new URL("all-types.fountain", DIR)), docToFountain(doc)],
    [fileURLToPath(new URL("all-types.fdx", DIR)), docToFDX(doc)],
  ]);
}

/** Samples whose file differs from the current export. */
export function staleSamples(): string[] {
  return [...exportedSamples()].flatMap(([path, text]) =>
    readFileSync(path, "utf8") === text ? [] : [path],
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [path, text] of exportedSamples()) {
    writeFileSync(path, text);
    console.log(`samples: ${path}`);
  }
}

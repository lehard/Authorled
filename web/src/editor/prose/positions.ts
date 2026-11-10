// Positions in the prose document: where a page starts (for the marks on the sheet, design of
// synopsis-editor, decision 7) and where a query of the story search is (decision 10).
import type { Node } from "prosemirror-model";

import { foldText } from "../fold.ts";
import type { PageStart } from "./layout.ts";

/** Document position of a page start: inside its block, at its offset. */
export function positionOf(doc: Node, start: PageStart): number {
  if (start.block >= doc.childCount)
    throw new Error(
      `Начало страницы: в документе нет блока ${start.block}, блоков ${doc.childCount}`,
    );
  let pos = 0;
  for (let index = 0; index < start.block; index++)
    pos += doc.child(index).nodeSize;
  return pos + 1 + start.offset;
}

/** The plain text of the document and the position of each of its characters. */
function textWithPositions(doc: Node): { text: string; at: number[] } {
  let text = "";
  const at: number[] = [];
  doc.forEach((block, offset, index) => {
    if (index > 0) {
      // The empty line between blocks stands at the start of the next block.
      text += "\n\n";
      at.push(offset + 1, offset + 1);
    }
    block.forEach((child, childOffset) => {
      const start = offset + 1 + childOffset;
      if (child.isText) {
        const value = child.text ?? "";
        text += value;
        for (let i = 0; i < value.length; i++) at.push(start + i);
      } else {
        text += "\n";
        at.push(start);
      }
    });
  });
  return { text, at };
}

/** The first match of `query` ignoring case and «ё», as a document range, or null. */
export function findInProse(
  doc: Node,
  query: string,
): { from: number; to: number } | null {
  if (query === "") return null;
  const { text, at } = textWithPositions(doc);
  const found = foldText(text).indexOf(foldText(query));
  if (found < 0) return null;
  return { from: at[found], to: at[found + query.length - 1] + 1 };
}

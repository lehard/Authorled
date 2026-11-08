import type { Node } from "prosemirror-model";

// Without DOM: `scripts/check-editor.ts` checks the numbering in Node.

/** A scene heading of the document: its position, its number in order, and whether it is empty. */
export type SceneHeading = { pos: number; number: number; empty: boolean };

/** The scene headings of `doc` in order, numbered from 1. */
export function sceneHeadings(doc: Node): SceneHeading[] {
  const headings: SceneHeading[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "sceneHeading")
      headings.push({
        pos: offset,
        number: headings.length + 1,
        empty: node.content.size === 0,
      });
  });
  return headings;
}

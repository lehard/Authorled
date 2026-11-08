// Places of co-author suggestions and comments by their anchor (openspec/specs/web/workspace,
// «Предложение по якорю», «Комментарий соавтора по якорю»; design of story-data-web, decision 5):
// the co-author names a scene by its `uid` and the exact words; the text screen puts the
// `suggestion` or `comment` mark there. No DOM here: check:editor runs these in Node.
import type { Node } from "prosemirror-model";
import type { Transform } from "prosemirror-transform";

import { commentRanges } from "./plugins/comments.ts";
import { suggestionRanges } from "./plugins/suggestions.ts";
import { schema } from "./schema/index.ts";

export type SuggestionAnchor = { id: string; sceneUid: string; quote: string };

/**
 * The first match of `quote` inside one paragraph of the scene with `sceneUid` (its heading and
 * the text up to the next heading, group or act); null without the scene or the words.
 */
export function findAnchor(
  doc: Node,
  sceneUid: string,
  quote: string,
): { from: number; to: number } | null {
  if (quote === "") return null;
  let inScene = false;
  let found: { from: number; to: number } | null = null;
  doc.forEach((node, offset) => {
    if (found !== null) return;
    const type = node.type.name;
    if (type === "sceneHeading") inScene = node.attrs.uid === sceneUid;
    else if (type === "act" || type === "sequence") inScene = false;
    if (!inScene || !node.isTextblock) return;
    // Paragraphs hold text only, so a character offset is a position offset.
    const at = node.textContent.indexOf(quote);
    if (at >= 0)
      found = { from: offset + 1 + at, to: offset + 1 + at + quote.length };
  });
  return found;
}

/**
 * Marks the place of every anchor that has no mark in the text yet, in `tr`; returns the ids of
 * anchors without a place: no scene, no words, or words another suggestion already covers.
 */
export function placeAnchors(
  tr: Transform,
  anchors: SuggestionAnchor[],
): string[] {
  const missing: string[] = [];
  for (const a of anchors) {
    if (suggestionRanges(tr.doc, a.id).length > 0) continue;
    const place = findAnchor(tr.doc, a.sceneUid, a.quote);
    if (
      place === null ||
      tr.doc.rangeHasMark(place.from, place.to, schema.marks.suggestion)
    ) {
      missing.push(a.id);
      continue;
    }
    tr.addMark(
      place.from,
      place.to,
      schema.marks.suggestion.create({ id: a.id }),
    );
  }
  return missing;
}

/**
 * Marks the place of every comment anchor that has no mark in the text yet, in `tr`; returns the
 * ids without a place (no scene or no words). Comments may cover the same words as others.
 */
export function placeCommentAnchors(
  tr: Transform,
  anchors: SuggestionAnchor[],
): string[] {
  const missing: string[] = [];
  for (const a of anchors) {
    if (commentRanges(tr.doc, a.id).length > 0) continue;
    const place = findAnchor(tr.doc, a.sceneUid, a.quote);
    if (place === null) {
      missing.push(a.id);
      continue;
    }
    tr.addMark(place.from, place.to, schema.marks.comment.create({ id: a.id }));
  }
  return missing;
}

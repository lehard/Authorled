import { InputRule, inputRules } from "prosemirror-inputrules";

import { schema } from "../schema/index.ts";

/** A paragraph that starts like this becomes a scene heading; the typed text stays. */
export const SCENE_HEADING_START =
  /^(ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.|INT\.\/EXT\.|INT\.|EXT\.)\s$/iu;
export const TRANSITION_START =
  /^(FADE OUT\.|FADE IN:|CUT TO:|SMASH CUT TO:|DISSOLVE TO:)\s$/;

function becomes(pattern: RegExp, name: "sceneHeading" | "transition") {
  return new InputRule(pattern, (state, match, start, end) => {
    const type = schema.nodes[name];
    if (state.doc.resolve(start).parent.type === type) return null;
    // The typed text has not reached the document yet: the part of the match after `end`
    // (one character when typing, more when text is inserted at once) is added here.
    return state.tr
      .setBlockType(start, end, type)
      .insertText(match[0].slice(end - start), end);
  });
}

export const screenplayInputRules = inputRules({
  rules: [
    becomes(SCENE_HEADING_START, "sceneHeading"),
    becomes(TRANSITION_START, "transition"),
  ],
});

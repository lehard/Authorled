// Commands of the prose editor: the toolbar and the keys run the same ones.
import { setBlockType, toggleMark } from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import type { Command } from "prosemirror-state";

import { proseSchema, type HeadingLevel } from "./schema.ts";

export const hardBreak: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type !== proseSchema.nodes.paragraph) return false;
  dispatch?.(
    state.tr
      .replaceSelectionWith(proseSchema.nodes.hard_break.create())
      .scrollIntoView(),
  );
  return true;
};

const heading = (level: HeadingLevel) =>
  setBlockType(proseSchema.nodes.heading, { level });
const paragraph = setBlockType(proseSchema.nodes.paragraph);

export const PROSE_COMMANDS = {
  undo,
  redo,
  bold: toggleMark(proseSchema.marks.strong),
  italic: toggleMark(proseSchema.marks.em),
  heading1: heading(1),
  heading2: heading(2),
  paragraph,
};

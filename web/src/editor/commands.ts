import type { MarkType } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import type { MarkColor } from "./elements.ts";

/** Gives the selection text colour or fill `color`, replacing the previous one. */
export function setColour(type: MarkType, color: MarkColor): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const mark = type.create({ color });
      dispatch(
        empty
          ? state.tr.removeStoredMark(type).addStoredMark(mark)
          : state.tr.removeMark(from, to, type).addMark(from, to, mark),
      );
    }
    return true;
  };
}

/** Removes text colour or fill from the selection; other marks stay. */
export function clearColour(type: MarkType): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      dispatch(
        empty
          ? state.tr.removeStoredMark(type)
          : state.tr.removeMark(from, to, type),
      );
    }
    return true;
  };
}

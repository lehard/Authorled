import { toggleMark } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import type { NodeType } from "prosemirror-model";
import {
  TextSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";

import {
  ELEMENT_NAMES,
  ELEMENTS,
  isElementName,
  type ElementName,
} from "../elements.ts";
import { schema } from "../schema/index.ts";

// Tab and Enter after STARC (openspec/specs/web/screenplay-editor, «Переходы Tab и Enter»).

function current(state: EditorState): ElementName | null {
  const name = state.selection.$from.parent.type.name;
  return isElementName(name) ? name : null;
}

function nodeType(name: ElementName): NodeType {
  return schema.nodes[name];
}

/** Sets the type of the paragraphs in the selection. */
export function setElement(name: ElementName): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const { from, to } = state.selection;
      dispatch(
        state.tr.setBlockType(from, to, nodeType(name)).scrollIntoView(),
      );
    }
    return true;
  };
}

function step(key: "Enter" | "Tab"): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    // A range selection: let the default commands replace it.
    if (!empty) return false;
    const type = current(state);
    if (type === null) return false;
    const rule = ELEMENTS[type];
    const parent = $from.parent;

    if (parent.content.size === 0) {
      const next = key === "Enter" ? rule.ce : rule.ct;
      if (next !== type && dispatch) {
        dispatch(
          state.tr
            .setNodeMarkup($from.before(), nodeType(next))
            .scrollIntoView(),
        );
      }
      return true;
    }
    if ($from.parentOffset === parent.content.size) {
      const next = key === "Enter" ? rule.je : rule.jt;
      if (dispatch) {
        dispatch(
          state.tr
            .split($from.pos, 1, [{ type: nodeType(next) }])
            .scrollIntoView(),
        );
      }
      return true;
    }
    // Inside the text: Enter splits the paragraph into two of the same type, Tab does nothing.
    if (key === "Enter" && dispatch) {
      dispatch(
        state.tr.split($from.pos, 1, [{ type: parent.type }]).scrollIntoView(),
      );
    }
    return true;
  };
}

export const enter = step("Enter");
export const tab = step("Tab");

/** Shift+Tab: the previous type of the list. */
export const shiftTab: Command = (state, dispatch) => {
  const type = current(state);
  if (type === null) return false;
  const i = ELEMENT_NAMES.indexOf(type);
  const prev =
    ELEMENT_NAMES[(i - 1 + ELEMENT_NAMES.length) % ELEMENT_NAMES.length];
  return setElement(prev)(state, dispatch);
};

// Backspace at the start of a paragraph keeps its type instead of joining it into the previous one.
const backspace: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;
  if (current(state) === "action") return false;

  const nodePos = $from.before();
  const prev = state.doc.resolve(nodePos).nodeBefore;
  if (prev === null) return true;

  if (prev.content.size === 0) {
    if (dispatch)
      dispatch(
        state.tr.delete(nodePos - prev.nodeSize, nodePos).scrollIntoView(),
      );
    return true;
  }
  if ($from.parent.content.size === 0) {
    if (dispatch) {
      const tr = state.tr.delete(nodePos, nodePos + $from.parent.nodeSize);
      dispatch(
        tr
          .setSelection(TextSelection.near(tr.doc.resolve(nodePos - 1), -1))
          .scrollIntoView(),
      );
    }
    return true;
  }
  if (dispatch) {
    dispatch(
      state.tr
        .setSelection(TextSelection.near(state.doc.resolve(nodePos - 1), -1))
        .scrollIntoView(),
    );
  }
  return true;
};

/** Key bindings of the paragraph types, as listed in ELEMENTS. */
export const ELEMENT_KEYS: Record<string, ElementName> = Object.fromEntries(
  ELEMENT_NAMES.map((name) => [ELEMENTS[name].key, name]),
);

export const screenplayKeymap = keymap({
  Enter: enter,
  Tab: tab,
  "Shift-Tab": shiftTab,
  Backspace: backspace,
  "Mod-b": toggleMark(schema.marks.bold),
  "Mod-i": toggleMark(schema.marks.italic),
  "Mod-u": toggleMark(schema.marks.underline),
  ...Object.fromEntries(
    Object.entries(ELEMENT_KEYS).map(([key, name]) => [key, setElement(name)]),
  ),
});

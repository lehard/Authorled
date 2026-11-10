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
  OUTLINE_RULES,
  OUTLINE_TYPES,
  type EditorMode,
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

function rules(type: ElementName, mode: EditorMode) {
  if (mode === "text") return ELEMENTS[type];
  const rule = OUTLINE_RULES[type];
  if (rule === undefined)
    throw new Error(`В поэпизоднике нет правил Tab/Enter для «${type}»`);
  return rule;
}

function step(key: "Enter" | "Tab", mode: EditorMode = "text"): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    // A range selection: let the default commands replace it.
    if (!empty) return false;
    const type = current(state);
    if (type === null) return false;
    const rule = rules(type, mode);
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
    // Inside the text: Enter splits the paragraph into two of the same type; Tab puts a
    // parenthetical into a dialogue and does nothing elsewhere.
    if (key === "Tab") {
      // At the very start of a dialogue there is nothing to split: Tab does nothing there.
      if (type === "dialogue") parentheticalInDialogue(state, dispatch);
      return true;
    }
    if (key === "Enter" && dispatch) {
      dispatch(
        state.tr.split($from.pos, 1, [{ type: parent.type }]).scrollIntoView(),
      );
    }
    return true;
  };
}

const WHITESPACE = /\s/u;

/**
 * Caret inside the text of a dialogue: dialogue before it, an empty parenthetical with the caret,
 * dialogue after it, in one transaction (web/screenplay-editor, «Ремарка внутри реплики»).
 * Spaces at the split go away; marks stay on their parts.
 */
export const parentheticalInDialogue: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const parent = $from.parent;
  if (
    !empty ||
    parent.type.name !== "dialogue" ||
    $from.parentOffset === 0 ||
    $from.parentOffset === parent.content.size
  )
    return false;
  if (!dispatch) return true;
  const text = parent.textContent;
  let before = $from.parentOffset;
  while (before > 0 && WHITESPACE.test(text[before - 1])) before -= 1;
  let after = $from.parentOffset;
  while (after < text.length && WHITESPACE.test(text[after])) after += 1;
  const start = $from.start();
  const tr = state.tr.delete(start + before, start + after);
  const at = start + before;
  tr.split(at, 1, [{ type: nodeType("parenthetical") }]);
  tr.split(at + 2, 1, [{ type: nodeType("dialogue") }]);
  tr.setSelection(TextSelection.create(tr.doc, at + 2));
  dispatch(tr.scrollIntoView());
  return true;
};

/** Paragraphs where Shift+Enter breaks no line: one line by their nature. */
const ONE_LINE: readonly ElementName[] = [
  "sceneHeading",
  "transition",
  "character",
];

/**
 * Shift+Enter: a line break inside the paragraph, its type kept (web/screenplay-editor,
 * «Перенос строки в абзаце»). In one-line paragraphs the key is taken and nothing changes,
 * so the browser does not put in a break of its own.
 */
export const lineBreak: Command = (state, dispatch) => {
  const type = current(state);
  if (type === null) return false;
  if (ONE_LINE.includes(type)) return true;
  if (dispatch) dispatch(state.tr.insertText("\n").scrollIntoView());
  return true;
};

export const enter = step("Enter");
export const tab = step("Tab");
export const outlineEnter = step("Enter", "outline");
export const outlineTab = step("Tab", "outline");

/** The types of the list in a mode. */
export function elementsOf(mode: EditorMode): ElementName[] {
  return mode === "text" ? ELEMENT_NAMES : OUTLINE_TYPES;
}

/** Shift+Tab: the previous type of the list. */
function shiftTabIn(mode: EditorMode): Command {
  return (state, dispatch) => {
    const type = current(state);
    if (type === null) return false;
    const list = elementsOf(mode);
    const i = list.indexOf(type);
    if (i < 0) return true;
    return setElement(list[(i - 1 + list.length) % list.length])(
      state,
      dispatch,
    );
  };
}
export const shiftTab = shiftTabIn("text");

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

/** Keys of the editor in a mode; the treatment binds only its four types. */
export function screenplayKeymap(mode: EditorMode) {
  return keymap({
    Enter: step("Enter", mode),
    Tab: step("Tab", mode),
    "Shift-Tab": shiftTabIn(mode),
    "Shift-Enter": lineBreak,
    Backspace: backspace,
    "Mod-b": toggleMark(schema.marks.bold),
    "Mod-i": toggleMark(schema.marks.italic),
    "Mod-u": toggleMark(schema.marks.underline),
    ...Object.fromEntries(
      Object.entries(ELEMENT_KEYS)
        .filter(([, name]) => elementsOf(mode).includes(name))
        .map(([key, name]) => [key, setElement(name)]),
    ),
  });
}

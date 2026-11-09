import type { Node } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import type { ElementName } from "../elements.ts";
import { foldText } from "../fold.ts";
import { openSuggestionRanges, type SuggestionRange } from "./suggestions.ts";
import { hiddenIn } from "./visibility.ts";

// Find and replace (design of screenplay-text-tools, decisions 3 and 4).

export const FIND_SCOPES = {
  all: "Во всём тексте",
  sceneHeading: "В заголовках сцен",
  action: "В описании действия",
  character: "В персонажах",
  dialogue: "В репликах",
} as const;
export type FindScope = keyof typeof FIND_SCOPES;

const SCOPE_TYPES: Record<Exclude<FindScope, "all">, ElementName[]> = {
  sceneHeading: ["sceneHeading"],
  action: ["action"],
  character: ["character"],
  dialogue: ["dialogue", "parenthetical", "lyrics"],
};

export type Match = { from: number; to: number };

/**
 * Matches of `query` in the visible paragraphs of `scope`, ignoring case and the difference of
 * «ё» and «е» (`foldText`); matches touching a
 * range of `skip` (open co-author suggestions, which cannot be edited) are left out.
 */
export function findMatches(
  doc: Node,
  query: string,
  scope: FindScope,
  hidden: Set<number>,
  skip: SuggestionRange[],
): Match[] {
  if (query === "") return [];
  const q = foldText(query);
  const types = scope === "all" ? null : SCOPE_TYPES[scope];
  const out: Match[] = [];
  doc.forEach((node, offset, i) => {
    if (hidden.has(i) || !node.isTextblock) return;
    if (types !== null && !types.includes(node.type.name as ElementName))
      return;
    const text = foldText(node.textContent);
    for (
      let at = text.indexOf(q);
      at >= 0;
      at = text.indexOf(q, at + q.length)
    ) {
      const m = { from: offset + 1 + at, to: offset + 1 + at + q.length };
      if (skip.every((r) => m.to <= r.from || m.from >= r.to)) out.push(m);
    }
  });
  return out;
}

export type FindState = {
  query: string;
  scope: FindScope;
  current: number;
  matches: Match[];
};

export const findKey = new PluginKey<FindState>("find");

type FindMeta = Partial<Pick<FindState, "query" | "scope" | "current">>;

function recount(
  state: EditorState,
  value: Omit<FindState, "matches">,
): FindState {
  const matches = findMatches(
    state.doc,
    value.query,
    value.scope,
    hiddenIn(state),
    openSuggestionRanges(state),
  );
  const current =
    matches.length === 0
      ? 0
      : Math.min(Math.max(value.current, 0), matches.length - 1);
  return { ...value, current, matches };
}

export const findPlugin = new Plugin<FindState>({
  key: findKey,
  state: {
    init: () => ({ query: "", scope: "all", current: 0, matches: [] }),
    apply(tr, value, _old, state) {
      const meta = tr.getMeta(findKey) as FindMeta | undefined;
      if (meta === undefined && value.query === "") return value;
      return recount(state, { ...value, ...meta });
    },
  },
  props: {
    decorations(state) {
      const find = findKey.getState(state);
      if (find === undefined || find.matches.length === 0)
        return DecorationSet.empty;
      return DecorationSet.create(
        state.doc,
        find.matches.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class: i === find.current ? "pw-find pw-find-current" : "pw-find",
          }),
        ),
      );
    },
  },
});

function findState(state: EditorState): FindState {
  const find = findKey.getState(state);
  if (find === undefined) throw new Error("Плагин find не подключён");
  return find;
}

/** Sets the query or scope, or moves to the match `current`; the match is selected. */
export function setFind(meta: FindMeta): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const tr = state.tr.setMeta(findKey, meta);
      const next = state.apply(tr);
      const find = findState(next);
      const match = find.matches[find.current];
      if (match !== undefined && meta.current !== undefined) {
        tr.setSelection(
          TextSelection.create(tr.doc, match.from, match.to),
        ).scrollIntoView();
      }
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Ends the search: the query is cleared, and the current match, when it is what is selected,
 * becomes the caret after it, so a closed search leaves no selection behind (the chat would
 * take it as the author's). A selection of the author's own stays.
 */
export function closeFind(): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const find = findState(state);
      const match = find.matches[find.current];
      const tr = state.tr.setMeta(findKey, { query: "" });
      const { from, to } = state.selection;
      if (match !== undefined && match.from === from && match.to === to)
        tr.setSelection(TextSelection.create(tr.doc, to));
      dispatch(tr);
    }
    return true;
  };
}

/** Replaces the current match. */
export function replaceCurrent(text: string): Command {
  return (state, dispatch) => {
    const find = findState(state);
    const match = find.matches[find.current];
    if (match === undefined) return false;
    if (dispatch)
      dispatch(
        state.tr.insertText(text, match.from, match.to).scrollIntoView(),
      );
    return true;
  };
}

/** Replaces every match in one step, so one undo brings them all back. */
export function replaceAll(text: string): Command {
  return (state, dispatch) => {
    const { matches } = findState(state);
    if (matches.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const m of [...matches].reverse()) tr.insertText(text, m.from, m.to);
      dispatch(tr);
    }
    return true;
  };
}

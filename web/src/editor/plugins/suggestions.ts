import type { Mark, Node } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from "prosemirror-state";
import { ReplaceAroundStep, ReplaceStep } from "prosemirror-transform";

import { schema } from "../schema/index.ts";

// Co-author suggestions (design of coauthor-suggestions, decisions 1–4): the mark `suggestion`
// covers the text a suggestion would replace; the suggested text, the reason and the status
// live in the app's data. No DOM here: check:editor runs these in Node.

export type SuggestionRange = { from: number; to: number };

export type SuggestionsState = {
  /** Open suggestions shown in the text: id → suggested text. */
  open: ReadonlyMap<string, string>;
  /** The suggestion whose card is open. */
  active: string | null;
  /** Ids of every suggestion place in the text, in text order, each once. */
  order: string[];
};

export type SuggestionsMeta = {
  open?: Record<string, string>;
  active?: string | null;
};

export const suggestionsKey = new PluginKey<SuggestionsState>("suggestions");
/** Meta `true` lets a transaction change text inside open suggestions («Принять»). */
export const suggestionGuardKey = new PluginKey("suggestionGuard");

const isPlace = (mark: Mark, id: string) =>
  mark.type === schema.marks.suggestion && mark.attrs.id === id;

/** Ranges of the suggestion's mark, adjacent pieces merged. */
export function suggestionRanges(doc: Node, id: string): SuggestionRange[] {
  const ranges: SuggestionRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    if (!node.marks.some((m) => isPlace(m, id))) return false;
    const last = ranges.at(-1);
    if (last !== undefined && last.to === pos) last.to = pos + node.nodeSize;
    else ranges.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return ranges;
}

function suggestionOrder(doc: Node): string[] {
  const order: string[] = [];
  doc.descendants((node) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      const id = m.attrs.id as string;
      if (m.type === schema.marks.suggestion && !order.includes(id))
        order.push(id);
    }
    return false;
  });
  return order;
}

function suggestions(state: EditorState): SuggestionsState {
  const s = suggestionsKey.getState(state);
  if (s === undefined) throw new Error("Плагин suggestions не подключён");
  return s;
}

/** Ranges of every open suggestion: find skips them, the guard keeps them whole. */
export function openSuggestionRanges(
  state: EditorState,
  doc: Node = state.doc,
): SuggestionRange[] {
  return [...suggestions(state).open.keys()].flatMap((id) =>
    suggestionRanges(doc, id),
  );
}

/**
 * Replaces every place of suggestion `id` with `text`, keeping the marks the whole old text
 * shares. An ordinary edit: undo brings the old text back.
 */
export function acceptSuggestion(id: string, text: string): Command {
  return (state, dispatch) => {
    const ranges = suggestionRanges(state.doc, id);
    if (ranges.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const r of [...ranges].reverse()) {
        const sets: (readonly Mark[])[] = [];
        state.doc.nodesBetween(r.from, r.to, (node) => {
          if (node.isText) sets.push(node.marks);
          return !node.isText;
        });
        const marks = (sets[0] ?? []).filter(
          (m) =>
            m.type !== schema.marks.suggestion &&
            sets.every((set) => m.isInSet(set)),
        );
        if (text === "") tr.delete(r.from, r.to);
        else tr.replaceWith(r.from, r.to, schema.text(text, marks));
      }
      dispatch(tr.setMeta(suggestionGuardKey, true));
    }
    return true;
  };
}

/** Removes the suggestion's mark, outside the undo history; the text stays. */
export function rejectSuggestion(id: string): Command {
  return (state, dispatch) => {
    const ranges = suggestionRanges(state.doc, id);
    if (ranges.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      const mark = schema.marks.suggestion.create({ id });
      for (const r of ranges) tr.removeMark(r.from, r.to, mark);
      dispatch(tr.setMeta("addToHistory", false));
    }
    return true;
  };
}

export function setSuggestions(meta: SuggestionsMeta): Command {
  return (state, dispatch) => {
    dispatch?.(state.tr.setMeta(suggestionsKey, meta));
    return true;
  };
}

/**
 * State of suggestions and the guard: a replacement that starts or ends strictly inside an
 * open suggestion is dropped; one that covers it whole, or typing at its edges, passes.
 */
export const suggestionsStatePlugin = new Plugin<SuggestionsState>({
  key: suggestionsKey,
  state: {
    init: (_config, state) => ({
      open: new Map(),
      active: null,
      order: suggestionOrder(state.doc),
    }),
    apply(tr, value) {
      const meta = tr.getMeta(suggestionsKey) as SuggestionsMeta | undefined;
      if (meta === undefined && !tr.docChanged) return value;
      return {
        open:
          meta?.open === undefined
            ? value.open
            : new Map(Object.entries(meta.open)),
        active: meta?.active === undefined ? value.active : meta.active,
        order: tr.docChanged ? suggestionOrder(tr.doc) : value.order,
      };
    },
  },
  filterTransaction(tr, state) {
    if (tr.getMeta(suggestionGuardKey) === true) return true;
    if (suggestions(state).open.size === 0) return true;
    return tr.steps.every((step, i) => {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep))
        return true;
      const { from, to } = step as unknown as { from: number; to: number };
      return openSuggestionRanges(state, tr.docs[i]).every((r) => {
        const inside = (p: number) => p > r.from && p < r.to;
        return !inside(from) && !inside(to);
      });
    });
  },
});

import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "prosemirror-state";

import { schema } from "../schema/index.ts";

// Autocomplete of names and places (design of screenplay-text-tools, decision 6), after the
// mockup's acUpdate: characters of the story in a character cue; ИНТ./НАТ., locations and
// time of day in a scene heading.

export type SuggestData = { characters: string[]; locations: string[] };
export type Suggestion = { insert: string; label: string; hint?: string };
export type SuggestList = { head: string; items: Suggestion[] };

const PLACES: [string, string][] = [
  ["ИНТ.", "в помещении"],
  ["НАТ.", "на улице"],
  ["ИНТ./НАТ.", "и там и там"],
];
const TIMES = ["ДЕНЬ", "НОЧЬ", "УТРО", "ВЕЧЕР", "РАССВЕТ", "СУМЕРКИ"];
const LIMIT = 8;

const starts = (name: string, q: string) => {
  const n = name.toUpperCase();
  return n.startsWith(q) && n !== q;
};

/** What to offer for a paragraph of `type` with `text` (the caret at its end), or null. */
export function suggestions(
  type: string,
  text: string,
  data: SuggestData,
): SuggestList | null {
  if (text.trim() === "") return null;
  let list: SuggestList | null = null;
  if (type === "character") {
    const q = text.trim().toUpperCase();
    list = {
      head: "Персонажи",
      items: data.characters
        .filter((c) => starts(c, q))
        .map((c) => ({ insert: c, label: c })),
    };
  } else if (type === "sceneHeading") {
    const up = text.toUpperCase();
    const m = /^(ИНТ\.\/НАТ\.|ИНТ\.|НАТ\.)\s*(.*)$/u.exec(up);
    if (m === null) {
      const q = up.trim();
      list = {
        head: "Где",
        items: PLACES.filter(([p]) => starts(p, q)).map(([p, hint]) => ({
          insert: `${p} `,
          label: p,
          hint,
        })),
      };
    } else if (!/\s[—-](\s|$)/u.test(m[2])) {
      const q = m[2].trim();
      list = {
        head: "Локации",
        items: data.locations
          .filter((l) => starts(l, q))
          .map((l) => ({ insert: `${m[1]} ${l.toUpperCase()} — `, label: l })),
      };
    } else {
      const base = up.replace(/[^—-]*$/u, "");
      const q = up.slice(base.length).trim();
      list = {
        head: "Время",
        items: TIMES.filter((t) => starts(t, q)).map((t) => ({
          insert: `${base.trimEnd()} ${t}`,
          label: t,
        })),
      };
    }
  }
  if (list === null || list.items.length === 0) return null;
  return { head: list.head, items: list.items.slice(0, LIMIT) };
}

type SuggestState = {
  data: SuggestData;
  list: SuggestList | null;
  index: number;
  /** Escape closed the list for this text; it opens again when the text changes. */
  closedFor: string | null;
};
type SuggestMeta = { data?: SuggestData; index?: number; close?: boolean };

export const suggestKey = new PluginKey<SuggestState>("suggest");

function context(state: EditorState): { type: string; text: string } | null {
  const { $head, empty } = state.selection;
  if (!empty || $head.parentOffset !== $head.parent.content.size) return null;
  return { type: $head.parent.type.name, text: $head.parent.textContent };
}

export const suggestPlugin = new Plugin<SuggestState>({
  key: suggestKey,
  state: {
    init: () => ({
      data: { characters: [], locations: [] },
      list: null,
      index: 0,
      closedFor: null,
    }),
    apply(tr, value, _old, state) {
      const meta = (tr.getMeta(suggestKey) ?? {}) as SuggestMeta;
      const data = meta.data ?? value.data;
      const here = context(state);
      const key = here === null ? null : `${here.type}:${here.text}`;
      const closedFor = meta.close
        ? key
        : value.closedFor === key
          ? value.closedFor
          : null;
      const list =
        here === null || closedFor !== null
          ? null
          : suggestions(here.type, here.text, data);
      const sameList =
        list !== null &&
        value.list !== null &&
        list.head === value.list.head &&
        !tr.docChanged;
      const index = meta.index ?? (sameList ? value.index : 0);
      return {
        data,
        list,
        index: list === null ? 0 : Math.min(index, list.items.length - 1),
        closedFor,
      };
    },
  },
  props: {
    handleKeyDown(view, event) {
      const s = suggestKey.getState(view.state);
      if (s === undefined || s.list === null) return false;
      const n = s.list.items.length;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const step = event.key === "ArrowDown" ? 1 : -1;
        view.dispatch(
          view.state.tr.setMeta(suggestKey, {
            index: (s.index + step + n) % n,
          }),
        );
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        view.dispatch(pick(view.state, s.index));
        return true;
      }
      if (event.key === "Escape") {
        view.dispatch(view.state.tr.setMeta(suggestKey, { close: true }));
        return true;
      }
      return false;
    },
  },
});

/** Replaces the paragraph text with suggestion `index`; the caret stays at the end. */
export function pick(state: EditorState, index: number): Transaction {
  const s = suggestKey.getState(state);
  const item = s?.list?.items[index];
  if (item === undefined) throw new Error(`Нет подсказки с номером ${index}`);
  const { $head } = state.selection;
  const start = $head.start();
  const tr = state.tr.replaceWith(start, $head.end(), schema.text(item.insert));
  return tr
    .setSelection(TextSelection.create(tr.doc, start + item.insert.length))
    .scrollIntoView();
}

export function setSuggestData(data: SuggestData) {
  return (state: EditorState) => state.tr.setMeta(suggestKey, { data });
}

import { keepPreviousData } from "@tanstack/react-query";
import { useCustom } from "@refinedev/core";
import { useEffect, useState } from "react";

import type { EntityKind } from "./model";

// Search of a draft and its story through the `custom` operation `search` of the data source (design of
// project-search, decision 6). The core finds and cuts the pieces of text; the screen only shows them.
// The `fixtures` source refuses it: a search of sample data would be a second copy of the core's rules.

/** Characters the field needs before it asks the core (openspec/specs/api/stories, «Отказы поиска»). */
export const MIN_QUERY = 2;
const DELAY_MS = 250;

/** Text around the first match: `match` as it is written, `…` where the core cut the text. */
export type SearchSnippet = { before: string; match: string; after: string };

/** A scene; number 0 without uid gathers the paragraphs outside scenes. */
export type SceneHit = {
  uid: string | null;
  number: number;
  heading: string;
  count: number;
  snippet: SearchSnippet;
};

/** A character, location or world; `field` is the key of the screen's field (name, one, long, age, overview or a profile key). */
export type EntityHit = {
  type: "entity";
  entity: EntityKind;
  id: string;
  name: string;
  field: string;
  count: number;
  snippet: SearchSnippet;
};

/** The logline or the synopsis of the screenplay of the draft. */
export type PartHit = {
  type: "part";
  part: "logline" | "synopsis";
  count: number;
  snippet: SearchSnippet;
};

export type NoteHit = {
  id: string;
  title: string;
  field: "title" | "body";
  count: number;
  snippet: SearchSnippet;
};

export type SearchResult = {
  query: string;
  scenes: SceneHit[];
  documents: (EntityHit | PartHit)[];
  notes: NoteHit[];
};

/** The field holds a query long enough: the navigator shows results instead of the tree. */
export function searchActive(text: string): boolean {
  return text.trim().length >= MIN_QUERY;
}

export type SearchOperation = {
  operation: "search";
  payload: { draftId: string; q: string };
};

/**
 * Results of `text` in the draft, asked 250 ms after the last keystroke and only from 2 characters on;
 * while a new answer is on its way the previous results stay.
 */
export function useStorySearch(draftId: string, text: string) {
  const typed = text.trim();
  const [query, setQuery] = useState(typed);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed), DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  const enabled = query.length >= MIN_QUERY;
  const payload: SearchOperation["payload"] = { draftId, q: query };
  // The answer is read from the query itself: Refine's `result.data` is `{}` until it comes.
  const { query: asked } = useCustom<SearchResult>({
    url: "search",
    method: "get",
    config: { payload },
    meta: { operation: "search" },
    queryOptions: {
      enabled,
      placeholderData: keepPreviousData,
      retry: false,
    },
    successNotification: false,
    errorNotification: false,
  });
  return {
    result: enabled ? asked.data?.data : undefined,
    error: enabled ? asked.error : null,
    pending: asked.isFetching || typed !== query,
  };
}

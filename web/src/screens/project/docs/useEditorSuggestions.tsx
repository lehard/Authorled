import { useUpdate } from "@refinedev/core";
import { useEffect, useState, type RefObject } from "react";

import { useSuggestions } from "@/data/hooks";
import type { Suggestion } from "@/data/model";
import type { SuggestionAnchor } from "@/editor";
import type {
  EditorSuggestions,
  ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";

import { useCardPlace } from "./cardPlace";
import { SuggestionCard, SuggestionsButton } from "./SuggestionViews";

// Co-author suggestions of one editor (openspec/specs/web/workspace, «Предложение правки в
// тексте» … «Обсудить предложение в чате»; design of coauthor-suggestions, decisions 4–8).

const quiet = { successNotification: false, errorNotification: false } as const;

/**
 * What the editor shows, the card of the open suggestion (`overlay`) and the walk button
 * (`tools`).
 */
export function useEditorSuggestions(
  draftId: string,
  editor: RefObject<ScreenplayEditorHandle | null>,
  /** A suggestion card opens: another card of the editor closes. */
  onOpened: () => void,
  /** «Обсудить в чате»: shows the chat where it is hidden; null without a chat (a reader). */
  openChat: (() => void) | null,
  /** A locked draft or a role without the right to edit: no decision. */
  readOnly: boolean,
  /** Anchored suggestions get their marks: not in a locked draft; a reviewer's window does not save them. */
  placeMarks: boolean,
) {
  const { suggestions } = useSuggestions(draftId);
  const { mutateAsync: update } = useUpdate();
  const [active, setActive] = useState<string | null>(null);
  const spot = useCardPlace(editor);
  const [places, setPlaces] = useState<[string, string][]>([]);
  const [error, setError] = useState<string | null>(null);

  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };
  const open = suggestions.filter((s) => s.status === "open");
  const shown = places.filter(([id]) => open.some((s) => s.id === id));

  // Open suggestions without a mark get one by their anchor after the text opens and after every
  // change of the list (design of story-data-web, decision 5); the rest have no place.
  const anchors = JSON.stringify(
    open.map((s) => ({ id: s.id, sceneUid: s.sceneUid, quote: s.quote })),
  );
  useEffect(() => {
    if (!placeMarks) return;
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    editor.current.placeSuggestions(JSON.parse(anchors) as SuggestionAnchor[]);
  }, [editor, anchors, placeMarks]);
  // A closed card gives its gap back to the text, whichever way it closed.
  useEffect(() => {
    if (active === null) spot.release();
  });
  const [marked, setMarked] = useState<string[] | null>(null);
  const missing =
    marked === null ? [] : open.filter((s) => !marked.includes(s.id));

  function show(id: string, scroll: boolean) {
    onOpened();
    setError(null);
    setActive(id);
    if (scroll) view().scrollToSuggestion(id);
    spot.place(id, view().suggestionAnchor(id));
  }

  function close() {
    setActive(null);
  }

  function record(s: Suggestion, accept: boolean) {
    update({
      resource: "suggestions",
      id: s.id,
      values: {
        status: accept ? "accepted" : "rejected",
        decidedAt: new Date().toISOString(),
      },
      meta: { draftId },
      ...quiet,
    }).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }

  function decide(s: Suggestion, accept: boolean) {
    const done = accept
      ? view().acceptSuggestion(s.id, s.text)
      : view().rejectSuggestion(s.id);
    if (!done) {
      setError("Этого фрагмента в тексте уже нет.");
      return;
    }
    setActive(null);
    record(s, accept);
  }

  const editorSuggestions: EditorSuggestions = {
    open: Object.fromEntries(open.map((s) => [s.id, s.text])),
    active,
    onOpen: (id) => show(id, false),
    onPlaces: setPlaces,
    onMarked: setMarked,
  };

  const current = open.find((s) => s.id === active);
  const old = shown.find(([id]) => id === active)?.[1];
  return {
    close,
    suggestions: editorSuggestions,
    overlay:
      current === undefined || old === undefined ? null : (
        <SuggestionCard
          key={current.id}
          style={spot.style}
          onHeight={spot.fit}
          suggestion={current}
          old={old}
          error={error}
          readOnly={readOnly}
          onClose={close}
          onDiscuss={
            openChat === null
              ? undefined
              : () => {
                  setActive(null);
                  view().selectSuggestion(current.id);
                  openChat();
                }
          }
          onDecide={(accept) => decide(current, accept)}
        />
      ),
    tools: (
      <SuggestionsButton
        count={shown.length}
        missing={missing}
        readOnly={readOnly}
        onReject={(s) => record(s, false)}
        onNext={() => {
          const ids = shown.map(([id]) => id);
          const at = active === null ? -1 : ids.indexOf(active);
          show(ids[(at + 1) % ids.length], true);
        }}
      />
    ),
  };
}

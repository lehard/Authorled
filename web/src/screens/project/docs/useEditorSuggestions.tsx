import { useUpdate } from "@refinedev/core";
import { useState, type CSSProperties, type RefObject } from "react";

import { useSuggestions } from "@/data/hooks";
import type { Suggestion } from "@/data/model";
import type {
  EditorSuggestions,
  ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";

import { cardPlace } from "./cardPlace";
import { SuggestionCard, SuggestionsButton } from "./SuggestionViews";

// Co-author suggestions of one editor (openspec/specs/web/workspace, «Предложение правки в
// тексте» … «Обсудить предложение в чате»; design of coauthor-suggestions, decisions 4–8).

const quiet = { successNotification: false, errorNotification: false } as const;

/**
 * What the editor shows, the card of the open suggestion (`overlay`) and the walk button
 * (`tools`).
 */
export function useEditorSuggestions(
  projectId: string,
  editor: RefObject<ScreenplayEditorHandle | null>,
  /** A suggestion card opens: another card of the editor closes. */
  onOpened: () => void,
  /** «Обсудить в чате»: shows the chat where it is hidden. */
  openChat: () => void,
) {
  const { suggestions } = useSuggestions(projectId);
  const { mutateAsync: update } = useUpdate();
  const [active, setActive] = useState<string | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [places, setPlaces] = useState<[string, string][]>([]);
  const [error, setError] = useState<string | null>(null);

  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };
  const open = suggestions.filter((s) => s.status === "open");
  const shown = places.filter(([id]) => open.some((s) => s.id === id));

  function show(id: string, scroll: boolean) {
    onOpened();
    setError(null);
    setActive(id);
    if (scroll) view().scrollToSuggestion(id);
    setStyle(cardPlace(view().suggestionAnchor(id)));
  }

  function close() {
    setActive(null);
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
    update({
      resource: "suggestions",
      id: s.id,
      values: {
        status: accept ? "accepted" : "rejected",
        decidedAt: new Date().toISOString(),
      },
      ...quiet,
    }).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }

  const editorSuggestions: EditorSuggestions = {
    open: Object.fromEntries(open.map((s) => [s.id, s.text])),
    active,
    onOpen: (id) => show(id, false),
    onPlaces: setPlaces,
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
          style={style}
          suggestion={current}
          old={old}
          error={error}
          onClose={close}
          onDiscuss={() => {
            setActive(null);
            view().selectSuggestion(current.id);
            openChat();
          }}
          onDecide={(accept) => decide(current, accept)}
        />
      ),
    tools: (
      <SuggestionsButton
        count={shown.length}
        onNext={() => {
          const ids = shown.map(([id]) => id);
          const at = active === null ? -1 : ids.indexOf(active);
          show(ids[(at + 1) % ids.length], true);
        }}
      />
    ),
  };
}

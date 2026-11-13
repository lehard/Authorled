import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { appConfig } from "@/app/config";
import { HttpError } from "@/data/apiClient";
import { openReadLink } from "@/data/apiProvider";
import { openFixtureLink } from "@/data/fixturesProvider";
import type { SharedText } from "@/data/model";
import { ScreenplayEditor } from "@/editor/ScreenplayEditor";
import { DataErrorScreen } from "@/screens/system/DataErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";
import "@/screens/workspace.css";

const BROKEN = "Ссылка не работает: её отключили или она неверная";

type State =
  | { kind: "loading" }
  | { kind: "text"; shared: SharedText }
  | { kind: "broken" }
  | { kind: "failed"; error: Error };

/**
 * The screenplay of a draft by its link «почитать», without signing in
 * (openspec/specs/web/workspace, «Страница чтения по ссылке»): the titles and the text, read-only;
 * no navigator, chat, review, account menu or names of the participants.
 */
export function ReadScreen() {
  const { dataSource } = appConfig();
  const { key } = useParams();
  if (key === undefined) throw new Error("Маршрут чтения без :key.");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    const read = async (): Promise<SharedText> =>
      dataSource === "api" ? openReadLink(key) : openFixtureLink(key);
    read().then(
      (shared) => {
        if (!stale) setState({ kind: "text", shared });
      },
      (e: unknown) => {
        if (stale) return;
        const status =
          e instanceof HttpError
            ? e.statusCode
            : (e as { statusCode?: unknown }).statusCode;
        if (status === 404) setState({ kind: "broken" });
        else
          setState({
            kind: "failed",
            error: e instanceof Error ? e : new Error(String(e)),
          });
      },
    );
    return () => {
      stale = true;
    };
  }, [dataSource, key, attempt]);

  if (state.kind === "loading")
    return <MessageScreen loading title="Открываем сценарий…" />;
  if (state.kind === "broken") return <MessageScreen title={BROKEN} />;
  if (state.kind === "failed")
    return (
      <DataErrorScreen
        title="Сценарий не открылся"
        error={state.error}
        onRetry={() => {
          setState({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  const { shared } = state;
  return (
    <div className="min-h-dvh p-3">
      <header className="mx-auto mb-3 grid max-w-[900px] gap-0.5 px-2 pt-2">
        <h1 className="font-heading text-heading-1 font-semibold">
          {shared.storyTitle}
        </h1>
        <small className="text-caption text-muted-foreground">
          {shared.draftName} · только чтение
        </small>
      </header>
      <main>
        <ScreenplayEditor mode="text" doc={shared.text} readOnly />
      </main>
    </div>
  );
}

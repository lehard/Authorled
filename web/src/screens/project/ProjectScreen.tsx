import { Menu, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDrafts, useEntities, useProject, useScript } from "@/data/hooks";
import type { Character, Location, Script, World } from "@/data/model";
import type { ScreenplayDoc } from "@/editor/document.ts";
import { useAutosave } from "@/screens/shared/useAutosave";
import { useMediaQuery } from "@/screens/shared/useMediaQuery";
import { UserMenu } from "@/screens/shared/UserMenu";
import { DataErrorScreen } from "@/screens/system/DataErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";
import { NotFoundScreen } from "@/screens/system/NotFoundScreen";
import "@/screens/workspace.css";

import { CoauthorChat } from "./chat/CoauthorChat";
import { CoauthorProvider } from "./chat/CoauthorProvider";
import { useSelectionIn } from "./chat/useSelectionIn";
import { DocView } from "./docs/DocView";
import { CURRENT, parseDoc } from "./docRef";
import { docTitle } from "./docTitle";
import { Navigator } from "./Navigator";
import { ProjectContext, type ProjectData } from "./ProjectContext";

/** Window of a story: navigator, workspace, chat (openspec/specs/web/workspace, «Окно истории»). */
export function ProjectScreen() {
  const { projectId, doc } = useParams();
  if (projectId === undefined || doc === undefined)
    throw new Error("Маршрут истории без :projectId или :doc.");
  const ref = parseDoc(doc);
  const { project, query: pq } = useProject(projectId);
  const { script, query: sq } = useScript(projectId);
  const chars = useEntities<Character>("char", projectId);
  const locs = useEntities<Location>("loc", projectId);
  const worlds = useEntities<World>("world", projectId);
  const trashChars = useEntities("char", projectId, true);
  const trashLocs = useEntities("loc", projectId, true);
  const trashWorlds = useEntities("world", projectId, true);
  const drafts = useDrafts(projectId);
  const trashDrafts = useDrafts(projectId, true);
  const narrow = useMediaQuery("(max-width: 900px)");
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selection, clearSelection] = useSelectionIn();
  const [currentScene, setCurrentScene] = useState<number | null>(null);
  // The working copy of the text belongs to one story; another story starts from its data.
  const [draft, setDraft] = useState<{
    id: string;
    text: ScreenplayDoc;
  } | null>(null);
  const {
    save: saveText,
    status: textStatus,
    discard: discardText,
  } = useAutosave<Script>("scripts", projectId);
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);

  // An unknown story is «Не найдено»; any other failure is shown with «Повторить» for all.
  if (pq.isError && pq.error.statusCode === 404) return <NotFoundScreen />;
  const lists = [
    sq,
    chars.query,
    locs.query,
    worlds.query,
    trashChars.query,
    trashLocs.query,
    trashWorlds.query,
    drafts.query,
    trashDrafts.query,
  ];
  const failed = [pq, ...lists].find((q) => q.isError);
  if (failed?.error)
    return (
      <DataErrorScreen
        title="История не загрузилась"
        error={failed.error}
        onRetry={() => {
          for (const q of [pq, ...lists]) if (q.isError) void q.refetch();
        }}
      />
    );
  // Refine keeps the previous story's data while the next one loads; never show it as this one.
  if (
    project?.id !== projectId ||
    script?.id !== projectId ||
    lists.some((q) => q.isPending || q.isPlaceholderData)
  )
    return <MessageScreen loading title="Открываем историю…" />;
  if (project.deletedAt !== null || ref === null) return <NotFoundScreen />;
  if (ref.kind === "part" && !script.show[ref.part]) return <NotFoundScreen />;
  if (ref.kind === "entity") {
    const { items, query } = { char: chars, loc: locs, world: worlds }[
      ref.entity
    ];
    if (!items.some((x) => x.id === ref.id)) {
      // A document just added is missing until its list refetches; only then is it «Не найдено».
      if (query.isFetching)
        return <MessageScreen loading title="Открываем документ…" />;
      return <NotFoundScreen />;
    }
  }
  // A draft or a side of a comparison: the same rule as a document just added.
  const draftIds = [
    ...(ref.kind === "draft" ? [ref.id] : []),
    ...(ref.kind === "compare"
      ? [ref.a, ref.b].filter((x) => x !== CURRENT)
      : []),
  ];
  if (!draftIds.every((id) => drafts.drafts.some((d) => d.id === id))) {
    if (drafts.query.isFetching)
      return <MessageScreen loading title="Открываем документ…" />;
    return <NotFoundScreen />;
  }

  const base = {
    project,
    script,
    chars: chars.items,
    locs: locs.items,
    worlds: worlds.items,
    drafts: drafts.drafts,
    trash: {
      char: trashChars.items,
      loc: trashLocs.items,
      world: trashWorlds.items,
      draft: trashDrafts.drafts,
    },
  };
  const data: ProjectData = {
    ...base,
    doc: ref,
    docSegment: doc,
    text: draft?.id === script.id ? draft.text : script.text,
    setText: (text) => {
      setDraft({ id: script.id, text });
      saveText({ text });
    },
    textStatus,
    currentScene,
    setCurrentScene,
    openChat: () => {
      if (narrow) setChatOpen(true);
    },
    openFresh: () => {
      // Every query of the window is read again before the document opens anew; a failed read
      // shows the error screen of the window.
      void queryClient.invalidateQueries().then(() => {
        discardText();
        setDraft(null);
        setGeneration((g) => g + 1);
      });
    },
    generation,
  };
  const title = docTitle(base, ref);
  const navigator = <Navigator onNavigate={() => setNavOpen(false)} />;

  return (
    <ProjectContext.Provider value={data}>
      <CoauthorProvider>
        {narrow ? (
          <div className="flex h-dvh flex-col">
            <header className="flex items-center gap-1.5 bg-panel px-2 py-1.5 shadow-panel">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Навигатор"
                onClick={() => setNavOpen(true)}
              >
                <Menu />
              </Button>
              <b className="min-w-0 flex-1 truncate">{title}</b>
              <UserMenu compact />
            </header>
            <main className="min-h-0 flex-1 overflow-auto">
              <DocView />
            </main>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex h-12 items-center gap-2 rounded-t-panel bg-panel px-4 text-left shadow-panel"
            >
              <Sparkles className="size-4 text-ai" />
              <b>Соавтор</b>
              <small className="truncate text-xs text-muted-foreground">
                Видит: {title}
              </small>
            </button>
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetContent
                side="left"
                className="gap-0 rounded-r-panel border-0 bg-panel p-0 data-[side=left]:w-[min(320px,86vw)]"
              >
                <SheetTitle className="sr-only">Навигатор</SheetTitle>
                <SheetDescription className="sr-only">
                  Документы истории «{project.title}»
                </SheetDescription>
                {navigator}
              </SheetContent>
            </Sheet>
            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetContent
                side="bottom"
                showCloseButton={false}
                className="gap-0 rounded-t-panel border-0 bg-panel p-0 data-[side=bottom]:h-[70vh]"
              >
                <SheetTitle className="sr-only">Соавтор</SheetTitle>
                <SheetDescription className="sr-only">
                  Чат с соавтором
                </SheetDescription>
                <CoauthorChat
                  sees={title}
                  selection={selection}
                  clearSelection={clearSelection}
                  onClose={() => setChatOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div className="grid h-dvh grid-cols-[240px_minmax(0,1fr)_320px] gap-3 p-3 min-[1241px]:grid-cols-[284px_minmax(0,1fr)_360px]">
            <aside className="min-h-0 overflow-hidden rounded-panel bg-panel shadow-panel">
              {navigator}
            </aside>
            <main className="relative min-h-0 overflow-auto">
              <div className="absolute top-0 right-0 z-10">
                <UserMenu compact />
              </div>
              <DocView />
            </main>
            <aside className="min-h-0 overflow-hidden rounded-panel bg-panel shadow-panel">
              <CoauthorChat
                sees={title}
                selection={selection}
                clearSelection={clearSelection}
              />
            </aside>
          </div>
        )}
      </CoauthorProvider>
    </ProjectContext.Provider>
  );
}

import { Menu, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useDrafts,
  useEntities,
  useNotes,
  useProject,
  useScript,
} from "@/data/hooks";
import type { Character, Location, Script, World } from "@/data/model";
import { useSaveActions } from "@/data/saves";
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
import { parseDoc } from "./docRef";
import { docTitle } from "./docTitle";
import { Navigator } from "./Navigator";
import { ProjectContext, type ProjectData } from "./ProjectContext";

/** Window of a story: navigator, workspace, chat (openspec/specs/web/workspace, «Окно истории»). */
export function ProjectScreen() {
  const { projectId, draftId, doc } = useParams();
  if (projectId === undefined || draftId === undefined || doc === undefined)
    throw new Error("Маршрут истории без :projectId, :draftId или :doc.");
  const ref = parseDoc(doc);
  const { project, query: pq } = useProject(projectId);
  const { script, query: sq } = useScript(draftId);
  const chars = useEntities<Character>("char", draftId);
  const locs = useEntities<Location>("loc", draftId);
  const worlds = useEntities<World>("world", draftId);
  const trashChars = useEntities("char", draftId, true);
  const trashLocs = useEntities("loc", draftId, true);
  const trashWorlds = useEntities("world", draftId, true);
  const drafts = useDrafts(projectId);
  const trashDrafts = useDrafts(projectId, true);
  const notes = useNotes(projectId);
  const trashNotes = useNotes(projectId, true);
  const narrow = useMediaQuery("(max-width: 900px)");
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selection, clearSelection] = useSelectionIn();
  const [currentScene, setCurrentScene] = useState<number | null>(null);
  // The working copy of the text belongs to one draft; another draft starts from its data.
  const [working, setWorking] = useState<{
    id: string;
    text: ScreenplayDoc;
  } | null>(null);
  const {
    save: saveText,
    status: textStatus,
    discard: discardText,
  } = useAutosave<Script>("scripts", draftId);
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const { open: rememberDraft } = useSaveActions();
  const draft = drafts.drafts.find((d) => d.id === draftId);
  const opened = draft?.id;

  // The story opens in this draft next time; a refused request stays an unhandled rejection.
  useEffect(() => {
    if (opened !== undefined) void rememberDraft(opened);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // An unknown story or draft is «Не найдено»; any other failure is shown with «Повторить» for all.
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
    notes.query,
    trashNotes.query,
  ];
  if ([pq, ...lists].some((q) => q.isError && q.error?.statusCode === 404))
    return <NotFoundScreen />;
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
    script?.id !== draftId ||
    lists.some((q) => q.isPending || q.isPlaceholderData)
  )
    return <MessageScreen loading title="Открываем историю…" />;
  if (project.deletedAt !== null || ref === null || draft === undefined) {
    // A draft just made is missing until its list refetches; only then is it «Не найдено».
    if (ref !== null && drafts.query.isFetching)
      return <MessageScreen loading title="Открываем драфт…" />;
    return <NotFoundScreen />;
  }
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
  if (ref.kind === "note" && !notes.notes.some((n) => n.id === ref.id)) {
    // A note just added is missing until its list refetches; only then is it «Не найдено».
    if (notes.query.isFetching)
      return <MessageScreen loading title="Открываем заметку…" />;
    return <NotFoundScreen />;
  }
  const base = {
    project,
    draft,
    script,
    chars: chars.items,
    locs: locs.items,
    worlds: worlds.items,
    drafts: drafts.drafts,
    notes: notes.notes,
    trash: {
      char: trashChars.items,
      loc: trashLocs.items,
      world: trashWorlds.items,
      draft: trashDrafts.drafts,
      note: trashNotes.notes,
    },
  };
  const data: ProjectData = {
    ...base,
    doc: ref,
    docSegment: doc,
    text: working?.id === script.id ? working.text : script.text,
    setText: (text) => {
      setWorking({ id: script.id, text });
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
        setWorking(null);
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
                  key={draft.id}
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
                key={draft.id}
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

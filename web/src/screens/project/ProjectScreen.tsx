import { Menu, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useComments,
  useDrafts,
  useEntities,
  useNotes,
  useProject,
  useScript,
  useSuggestions,
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
import {
  ProjectContext,
  type CoauthorRequest,
  type ProjectData,
} from "./ProjectContext";

/** Key of `localStorage` for the folded chat of a wide window. */
const CHAT_FOLDED_KEY = "authorled.chatCollapsed";

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
  // The editor's comments and suggestions are read with the rest of the window, not after the
  // editor opens (web/workspace, «Загрузка окна истории»); the window does not wait for them.
  const scriptOpen =
    ref?.kind === "part" && (ref.part === "text" || ref.part === "treatment");
  useComments(draftId, scriptOpen);
  useSuggestions(draftId, scriptOpen);
  const narrow = useMediaQuery("(max-width: 900px)");
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // A wide window may fold the chat into a strip; the choice stays in this browser for every
  // story (web/workspace, «Окно истории»). No key is the chat as it opens first: unfolded.
  const [chatFolded, setChatFolded] = useState(
    () => window.localStorage.getItem(CHAT_FOLDED_KEY) === "1",
  );
  const foldChat = (folded: boolean) => {
    if (folded) window.localStorage.setItem(CHAT_FOLDED_KEY, "1");
    else window.localStorage.removeItem(CHAT_FOLDED_KEY);
    setChatFolded(folded);
  };
  const [selection, clearSelection] = useSelectionIn();
  // A check from a document waits here until the chat sends it; the chat reports when it cannot
  // send (web/workspace, «Проверки над выделением»).
  const [coauthorRequest, setCoauthorRequest] =
    useState<CoauthorRequest | null>(null);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [currentScene, setCurrentScene] = useState<number | null>(null);
  // «Поиск по истории» (web/workspace, «Поиск по истории в навигаторе»).
  const [searchText, setSearchText] = useState("");
  const [searchFocusAsked, setSearchFocusAsked] = useState(false);
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

  // ⌘K or Ctrl+K anywhere in the window puts the caret into the search field; on a narrow screen
  // the navigator opens first. The key is read by its place, so a Russian layout works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.code !== "KeyK") return;
      e.preventDefault();
      if (narrow) setNavOpen(true);
      setSearchFocusAsked(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narrow]);

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
  const openChat = () => {
    if (narrow) setChatOpen(true);
    else foldChat(false);
  };
  const coauthorBusy = chatBlocked || coauthorRequest !== null;
  const chatRequest = {
    request: coauthorRequest,
    onRequestTaken: (id: string) =>
      setCoauthorRequest((r) => (r?.id === id ? null : r)),
    onBlockedChange: setChatBlocked,
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
    openChat,
    askCoauthor: (text) => {
      if (coauthorBusy)
        throw new Error("Соавтор ещё отвечает: новая просьба не отправлена.");
      setCoauthorRequest({ id: crypto.randomUUID(), text });
      openChat();
    },
    coauthorBusy,
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
    searchText,
    setSearchText,
    searchFocusAsked,
    searchFocusTaken: () => setSearchFocusAsked(false),
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
            {/* The account menu is in the header: the document head keeps no room for it. */}
            <main className="min-h-0 flex-1 overflow-auto [--account-space:0px]">
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
                  {...chatRequest}
                  onClose={() => setChatOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        ) : (
          <div
            className={
              chatFolded
                ? "grid h-dvh grid-cols-[240px_minmax(0,1fr)_48px] gap-3 p-3 min-[1241px]:grid-cols-[284px_minmax(0,1fr)_48px]"
                : "grid h-dvh grid-cols-[240px_minmax(0,1fr)_320px] gap-3 p-3 min-[1241px]:grid-cols-[284px_minmax(0,1fr)_360px]"
            }
          >
            <aside className="min-h-0 overflow-hidden rounded-panel bg-panel shadow-panel">
              {navigator}
            </aside>
            {/* --account-space: the width of the account menu (h-9 button: pl-1 + size-7 + pr-3 =
                44px) and a gap of 8px. The document head keeps it free on its right
                (openspec/specs/web/workspace, «Шапка документа»); change it with the button. */}
            <main className="relative min-h-0 overflow-auto [--account-space:--spacing(13)]">
              <div className="absolute top-0 right-0 z-10">
                <UserMenu compact />
              </div>
              <DocView />
            </main>
            <aside className="min-h-0 overflow-hidden rounded-panel bg-panel shadow-panel">
              {chatFolded && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-full w-full items-start rounded-panel pt-4"
                        aria-label="Открыть соавтора"
                        onClick={() => foldChat(false)}
                      >
                        <Sparkles className="size-5 text-ai" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Открыть соавтора
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Hidden, not unmounted: the conversation, the typed text and a running answer stay. */}
              <div hidden={chatFolded} className="h-full">
                <CoauthorChat
                  key={draft.id}
                  sees={title}
                  selection={selection}
                  clearSelection={clearSelection}
                  {...chatRequest}
                  onCollapse={() => foldChat(true)}
                />
              </div>
            </aside>
          </div>
        )}
      </CoauthorProvider>
    </ProjectContext.Provider>
  );
}

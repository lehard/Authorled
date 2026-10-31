import { Menu, Sparkles } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEntities, useProject, useScript } from "@/data/hooks";
import type { Character, Location, World } from "@/data/model";
import { useMediaQuery } from "@/screens/shared/useMediaQuery";
import { UserMenu } from "@/screens/shared/UserMenu";
import { MessageScreen } from "@/screens/system/MessageScreen";
import { NotFoundScreen } from "@/screens/system/NotFoundScreen";
import "@/screens/workspace.css";

import { ChatColumn } from "./ChatColumn";
import { DocView } from "./docs/DocView";
import { parseDoc } from "./docRef";
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
  const narrow = useMediaQuery("(max-width: 900px)");
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // An unknown story is «Не найдено»; any other failure is shown as it is.
  if (pq.isError) {
    if (pq.error.statusCode === 404) return <NotFoundScreen />;
    return (
      <MessageScreen title="История не загрузилась" text={pq.error.message} />
    );
  }
  const lists = [
    sq,
    chars.query,
    locs.query,
    worlds.query,
    trashChars.query,
    trashLocs.query,
    trashWorlds.query,
  ];
  const failed = lists.find((q) => q.isError);
  if (failed?.error)
    return (
      <MessageScreen
        title="История не загрузилась"
        text={failed.error.message}
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

  const base = {
    project,
    script,
    chars: chars.items,
    locs: locs.items,
    worlds: worlds.items,
    trash: {
      char: trashChars.items,
      loc: trashLocs.items,
      world: trashWorlds.items,
    },
  };
  const data: ProjectData = { ...base, doc: ref, docSegment: doc };
  const title = docTitle(base, ref);
  const navigator = <Navigator onNavigate={() => setNavOpen(false)} />;

  return (
    <ProjectContext.Provider value={data}>
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
              className="w-[min(320px,86vw)] gap-0 rounded-r-panel border-0 bg-panel p-0"
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
              className="h-[70vh] gap-0 rounded-t-panel border-0 bg-panel p-0"
            >
              <SheetTitle className="sr-only">Соавтор</SheetTitle>
              <SheetDescription className="sr-only">
                Чат с соавтором
              </SheetDescription>
              <ChatColumn sees={title} />
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
            <ChatColumn sees={title} />
          </aside>
        </div>
      )}
    </ProjectContext.Provider>
  );
}

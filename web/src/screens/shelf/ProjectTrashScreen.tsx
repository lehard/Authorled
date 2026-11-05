import { useDelete } from "@refinedev/core";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { useProjects } from "@/data/hooks";
import type { Project } from "@/data/model";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";
import { DataErrorScreen } from "@/screens/system/DataErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";

import { TopBar } from "./TopBar";
import { useStoryActions } from "./storyActions";

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/** Trash of stories (openspec/specs/web/workspace, «Корзина историй»). */
export function ProjectTrashScreen() {
  const { projects, query } = useProjects(true);
  const { trashStory } = useStoryActions();
  const { mutate: remove } = useDelete();
  const [confirm, setConfirm] = useState<Project | "all" | null>(null);

  if (query.isError)
    return (
      <DataErrorScreen
        title="Корзина не загрузилась"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending)
    return <MessageScreen loading title="Открываем корзину…" />;

  const purge = (p: Project) =>
    remove({
      resource: "projects",
      id: p.id,
      successNotification: false,
      errorNotification: false,
    });

  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-16 md:px-10 md:pt-7">
        <Button
          asChild
          variant="ghost"
          className="-ml-2 rounded-full text-muted-foreground"
        >
          <Link to="/">
            <ArrowLeft />
            Истории
          </Link>
        </Button>
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-heading-1">Корзина историй</h1>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={projects.length === 0}
            onClick={() => setConfirm("all")}
          >
            Очистить корзину
          </Button>
        </div>
        {projects.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            <b className="mb-2 block text-heading-3 text-foreground">
              Корзина пуста
            </b>
            Сюда попадают удалённые истории.
          </p>
        ) : (
          <>
            <p className="mb-4 text-muted-foreground">
              Истории лежат здесь, пока вы не восстановите их или не удалите
              навсегда.
            </p>
            <ul className="grid gap-2.5">
              {projects.map((p) => {
                if (p.deletedAt === null)
                  throw new Error(
                    `История «${p.title}» в корзине без даты удаления.`,
                  );
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-panel px-4 py-3 shadow-panel"
                  >
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <b className="truncate font-semibold">{p.title}</b>
                      <small className="text-caption text-muted-foreground">
                        Удалена {date.format(new Date(p.deletedAt))}
                      </small>
                    </span>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void trashStory(p.id, false)}
                    >
                      <RotateCcw />
                      Восстановить
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-full text-destructive"
                      onClick={() => setConfirm(p)}
                    >
                      Удалить навсегда
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "all" ? "Очистить корзину?" : "Удалить навсегда?"}
        text={
          confirm === "all"
            ? `Все истории из корзины (${projects.length}) удалятся без возможности восстановления.`
            : `История «${confirm?.title ?? ""}» удалится без возможности восстановления.`
        }
        actionLabel="Удалить навсегда"
        onConfirm={() => {
          if (confirm === "all") projects.forEach(purge);
          else if (confirm !== null) purge(confirm);
          setConfirm(null);
        }}
      />
    </div>
  );
}

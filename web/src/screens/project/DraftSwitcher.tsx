import { useCreate, useInvalidate } from "@refinedev/core";
import {
  Check,
  ChevronsUpDown,
  History,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Point } from "@/data/model";
import { NameDialog } from "@/screens/shared/NameDialog";

import { docPath } from "./docRef";
import { useDraftActions } from "./draftActions";
import { NewDraftDialog, PointsDialog } from "./DraftDialogs";
import { useProjectData } from "./ProjectContext";

const created = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
});

/** «от Драфта 1» for a numbered draft, «от «После читки»» for a named one. */
function forkLabel(name: string): string {
  const numbered = /^Драфт (\d+)$/.exec(name);
  return numbered === null ? `от «${name}»` : `от Драфта ${numbered[1]}`;
}

/** Drafts of a story at the top of the navigator (openspec/specs/web/workspace, «Переключатель драфтов»). */
export function DraftSwitcher({ onNavigate }: { onNavigate: () => void }) {
  const data = useProjectData();
  const { draft, drafts, can } = data;
  const navigate = useNavigate();
  const actions = useDraftActions(data);
  const { mutateAsync: create } = useCreate();
  const invalidate = useInvalidate();
  const [drafting, setDrafting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string) => {
    onNavigate();
    navigate(
      docPath(
        { id, projectId: data.project.id },
        { kind: "part", part: "text" },
      ),
    );
  };

  function attempt(action: Promise<unknown>) {
    setError(null);
    action.catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }

  async function removeOpen() {
    await actions.trash(draft.id, true);
    // The story then opens in the draft the core names.
    onNavigate();
    navigate(`/p/${data.project.id}`);
  }

  return (
    <div className="px-2 pb-1">
      <div className="flex items-center gap-1 rounded-xl bg-paper shadow-panel">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Драфт: ${draft.name}. Переключить драфт`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-accent"
            >
              {draft.locked && (
                <>
                  <Lock
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="sr-only">Правка запрещена.</span>
                </>
              )}
              <b className="min-w-0 flex-1 truncate font-semibold">
                {draft.name}
              </b>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[min(280px,80vw)]">
            {drafts.map((d) => (
              <DropdownMenuItem
                key={d.id}
                onSelect={() => {
                  if (d.id !== draft.id) open(d.id);
                }}
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{d.name}</span>
                    {d.locked && (
                      <>
                        <Lock aria-hidden className="size-3.5 shrink-0" />
                        <span className="sr-only">, правка запрещена</span>
                      </>
                    )}
                  </span>
                  <small className="truncate text-caption text-muted-foreground">
                    {created.format(new Date(d.createdAt))}
                    {d.forkedFromName !== null &&
                      ` · ${forkLabel(d.forkedFromName)}`}
                  </small>
                </span>
                {d.id === draft.id && <Check aria-label="Открыт" />}
              </DropdownMenuItem>
            ))}
            {can.edit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDrafting(true)}>
                  <Plus />
                  Новый драфт
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {can.edit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Действия с драфтом"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil />
                Переименовать
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => attempt(actions.lock(draft.id, !draft.locked))}
              >
                {draft.locked ? <LockOpen /> : <Lock />}
                {draft.locked ? "Разрешить правку" : "Запретить правку"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaving(true)}>
                <Save />
                Сохранить точку
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setListing(true)}>
                <History />
                Точки драфта
              </DropdownMenuItem>
              {drafts.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => attempt(removeOpen())}
                  >
                    <Trash2 />
                    Удалить в корзину
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="px-2 pt-1 text-caption text-destructive">
          {error}
        </p>
      )}
      <NewDraftDialog
        open={drafting}
        onOpenChange={setDrafting}
        drafts={drafts}
        base={draft.id}
        onSubmit={async (name, baseId) =>
          open(await actions.create(name, baseId))
        }
      />
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Переименовать драфт"
        label="Название драфта"
        initial={draft.name}
        submitLabel="Сохранить"
        emptyError="Назовите драфт."
        onSubmit={async (name) => {
          await actions.rename(draft.id, name);
        }}
      />
      <NameDialog
        open={saving}
        onOpenChange={setSaving}
        title="Сохранить точку"
        description="Точка хранит весь драфт: к ней можно вернуться целиком."
        label="Название точки"
        submitLabel="Сохранить"
        emptyError="Назовите точку."
        onSubmit={async (name) => {
          const values: Pick<Point, "draftId" | "name"> = {
            draftId: draft.id,
            name,
          };
          await create({
            resource: "points",
            values,
            successNotification: false,
            errorNotification: false,
          });
          await invalidate({ resource: "points", invalidates: ["list"] });
        }}
      />
      <PointsDialog open={listing} onOpenChange={setListing} />
    </div>
  );
}

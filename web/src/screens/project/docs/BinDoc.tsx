import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { DOC_WORDS } from "../docRef";
import {
  emptyTrashText,
  trashItems,
  trashName,
  useTrashActions,
  type TrashItem,
} from "../draftActions";
import { firstLine } from "../noteActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

const kindName = (i: TrashItem) =>
  i.kind === "draft" ? "Драфт" : DOC_WORDS[i.kind].one;

function summary(i: TrashItem): string {
  if (i.kind === "draft") return "Сценарий, карточки и беседы этого драфта";
  if (i.kind === "note") return firstLine(i.x.body);
  return i.x.one === "" ? "Без описания" : i.x.one;
}

/** Trash of a story: documents of the open draft, deleted drafts and notes of the story. */
export function BinDoc() {
  const data = useProjectData();
  const actions = useTrashActions(data);
  const items = trashItems(data.trash);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TrashItem | "all" | null>(null);
  const current = items.find((i) => i.x.id === selected) ?? items[0];

  if (items.length === 0) {
    return (
      <>
        <DocHead title="Корзина" wide />
        <p className="py-16 text-center text-muted-foreground">
          <b className="mb-2 block text-heading-3 text-foreground">
            Корзина пуста
          </b>
          Сюда попадают удалённые персонажи, локации, миры, заметки и драфты.
          Удалить можно из меню документа.
        </p>
      </>
    );
  }

  return (
    <>
      <DocHead title="Корзина" wide>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={data.readOnly || !data.can.owner}
          onClick={() => setConfirm("all")}
        >
          Очистить корзину
        </Button>
      </DocHead>
      <div className="mx-auto grid max-w-[1000px] gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <ul className="grid content-start gap-1.5">
          {items.map((i) => (
            <li key={i.x.id}>
              <button
                type="button"
                aria-current={i === current ? "true" : undefined}
                onClick={() => setSelected(i.x.id)}
                className="grid w-full gap-0.5 rounded-2xl bg-paper px-4 py-2.5 text-left shadow-panel aria-current:ring-2 aria-current:ring-primary"
              >
                <b className="truncate">{trashName(i)}</b>
                <small className="text-caption text-muted-foreground">
                  {kindName(i)} · {i.kind === "note" ? "удалена" : "удалён"}{" "}
                  {i.x.deletedAt === null
                    ? ""
                    : date.format(new Date(i.x.deletedAt))}
                </small>
              </button>
            </li>
          ))}
        </ul>
        <div className="grid content-start gap-3 rounded-2xl bg-paper p-5 shadow-panel">
          <span className="text-caption text-muted-foreground">
            {kindName(current)}
          </span>
          <h2 className="text-heading-2">{trashName(current)}</h2>
          <p>{summary(current)}</p>
          {/* Restoring changes the story; deleting for good is the owner's (web/workspace, «Экран истории по роли»). */}
          <div className="flex flex-wrap gap-2">
            {data.can.edit && (
              <Button
                className="rounded-full"
                onClick={() => void actions.restore(current)}
              >
                <RotateCcw />
                Восстановить
              </Button>
            )}
            {data.can.owner && (
              <Button
                variant="ghost"
                className="rounded-full text-destructive"
                onClick={() => setConfirm(current)}
              >
                Удалить навсегда
              </Button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "all" ? "Очистить корзину?" : "Удалить навсегда?"}
        text={
          confirm === "all"
            ? emptyTrashText(items)
            : `«${confirm === null ? "" : trashName(confirm)}» удалится без возможности восстановления.`
        }
        actionLabel="Удалить навсегда"
        onConfirm={() => {
          const list =
            confirm === "all" ? items : confirm === null ? [] : [confirm];
          list.forEach((i) => void actions.purge(i));
          setConfirm(null);
        }}
      />
    </>
  );
}

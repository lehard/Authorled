import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Entity, EntityKind } from "@/data/model";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { ENTITY_WORDS } from "../docRef";
import { useEntityActions } from "../entityActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

type Item = { kind: EntityKind; x: Entity };

/** Trash of a story: deleted characters, locations and worlds. */
export function BinDoc() {
  const data = useProjectData();
  const actions = useEntityActions(data.project.id);
  const items: Item[] = (Object.keys(data.trash) as EntityKind[]).flatMap(
    (kind) => data.trash[kind].map((x) => ({ kind, x })),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Item | "all" | null>(null);
  const current = items.find((i) => i.x.id === selected) ?? items[0];

  if (items.length === 0) {
    return (
      <>
        <DocHead title="Корзина" wide />
        <p className="py-16 text-center text-muted-foreground">
          <b className="mb-2 block text-heading-3 text-foreground">
            Корзина пуста
          </b>
          Сюда попадают удалённые персонажи, локации и миры. Удалить можно из
          меню документа.
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
                <b className="truncate">{i.x.name}</b>
                <small className="text-caption text-muted-foreground">
                  {ENTITY_WORDS[i.kind].one} · удалён{" "}
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
            {ENTITY_WORDS[current.kind].one}
          </span>
          <h2 className="text-heading-2">{current.x.name}</h2>
          <p>{current.x.one === "" ? "Без описания" : current.x.one}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              onClick={() =>
                void actions.trash(current.kind, current.x.id, false)
              }
            >
              <RotateCcw />
              Восстановить
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-destructive"
              onClick={() => setConfirm(current)}
            >
              Удалить навсегда
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "all" ? "Очистить корзину?" : "Удалить навсегда?"}
        text={
          confirm === "all"
            ? `Документы из корзины (${items.length}) удалятся без возможности восстановления.`
            : `«${confirm?.x.name ?? ""}» удалится без возможности восстановления.`
        }
        actionLabel="Удалить навсегда"
        onConfirm={() => {
          const list =
            confirm === "all" ? items : confirm === null ? [] : [confirm];
          list.forEach((i) => void actions.purge(i.kind, i.x.id));
          setConfirm(null);
        }}
      />
    </>
  );
}

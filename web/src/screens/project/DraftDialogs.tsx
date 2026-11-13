import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePoints } from "@/data/hooks";
import type { Draft, Point } from "@/data/model";
import { useSaveActions } from "@/data/saves";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { useProjectData } from "./ProjectContext";

// Dialogs of the drafts. Content unmounts on close, so every opening starts from the defaults.

type Open = { open: boolean; onOpenChange: (open: boolean) => void };

/** The next free number: «Драфт 3» after two drafts. */
function nextName(drafts: Draft[]): string {
  const names = new Set(drafts.map((d) => d.name));
  let n = drafts.length + 1;
  while (names.has(`Драфт ${n}`)) n += 1;
  return `Драфт ${n}`;
}

function NewDraftForm({
  onOpenChange,
  drafts,
  base,
  onSubmit,
}: Pick<Open, "onOpenChange"> & {
  drafts: Draft[];
  base: string;
  onSubmit: (name: string, baseId: string) => Promise<void>;
}) {
  const nameId = useId();
  const baseId = useId();
  const [name, setName] = useState(nextName(drafts));
  const [from, setFrom] = useState(base);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === "") {
      setError("Назовите драфт.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), from);
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-heading-2">Новый драфт</DialogTitle>
        <DialogDescription>
          Отдельная версия истории: копия сценария и карточек. Дальше драфты
          развиваются независимо.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>Название</Label>
        <Input
          id={nameId}
          autoFocus
          value={name}
          aria-invalid={error !== null}
          onChange={(e) => setName(e.target.value)}
          className="bg-paper"
        />
        {error !== null && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={baseId}>На основе</Label>
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger id={baseId} className="w-full bg-paper">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {drafts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="rounded-full">
            Отмена
          </Button>
        </DialogClose>
        <Button type="submit" className="rounded-full" disabled={busy}>
          Создать
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewDraftDialog({
  open,
  onOpenChange,
  drafts,
  base,
  onSubmit,
}: Open & {
  drafts: Draft[];
  base: string;
  onSubmit: (name: string, baseId: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        <NewDraftForm
          onOpenChange={onOpenChange}
          drafts={drafts}
          base={base}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

const when = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function PointList({ onOpenChange }: Pick<Open, "onOpenChange">) {
  const { draft, openFresh, readOnly } = useProjectData();
  const { points, query } = usePoints(draft.id);
  const { restorePoint } = useSaveActions();
  const [asking, setAsking] = useState<Point | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(point: Point) {
    setError(null);
    try {
      await restorePoint(point.id);
      openFresh();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-heading-2">Точки драфта</DialogTitle>
        <DialogDescription>
          Точка хранит весь драфт: сценарий и все карточки.
        </DialogDescription>
      </DialogHeader>
      {query.isError && (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      )}
      {query.isSuccess && points.length === 0 && (
        <p className="text-muted-foreground">
          Точек пока нет. Сохраните точку перед большой правкой.
        </p>
      )}
      <ul className="grid max-h-[50vh] gap-1.5 overflow-auto">
        {points.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-2xl bg-panel px-4 py-2.5"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <b className="truncate">{p.name}</b>
              <small className="text-caption text-muted-foreground">
                {p.createdByName} · {when.format(new Date(p.createdAt))}
              </small>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={readOnly}
              onClick={() => setAsking(p)}
            >
              Вернуться
            </Button>
          </li>
        ))}
      </ul>
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(o) => !o && setAsking(null)}
        title={`Вернуться к точке «${asking?.name ?? ""}»?`}
        text="Откатится весь драфт: сценарий и все карточки. Нынешнее состояние сохранится отдельной точкой, поэтому откат можно отменить."
        actionLabel="Вернуться"
        onConfirm={() => {
          if (asking !== null) void restore(asking);
          setAsking(null);
        }}
      />
    </div>
  );
}

export function PointsDialog({ open, onOpenChange }: Open) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        <PointList onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

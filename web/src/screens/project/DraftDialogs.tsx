import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Draft } from "@/data/model";

import { CURRENT } from "./docRef";

// Dialogs of the drafts (screenplay-drafts, decision 6). Content unmounts on close, so every
// opening starts from the defaults.

type Open = { open: boolean; onOpenChange: (open: boolean) => void };

function Shell({
  open,
  onOpenChange,
  children,
}: Open & { children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {children}
      </DialogContent>
    </Dialog>
  );
}

function TextSelect({
  id,
  value,
  drafts,
  onChange,
}: {
  id: string;
  value: string;
  drafts: Draft[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full bg-paper">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CURRENT}>Текущий текст</SelectItem>
        {drafts.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Failure({ id, error }: { id?: string; error: string | null }) {
  if (error === null) return null;
  return (
    <p id={id} role="alert" className="text-caption text-destructive">
      {error}
    </p>
  );
}

function Actions({ submit, busy }: { submit: string; busy?: boolean }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="ghost" className="rounded-full">
          Отмена
        </Button>
      </DialogClose>
      <Button type="submit" className="rounded-full" disabled={busy}>
        {submit}
      </Button>
    </DialogFooter>
  );
}

/** «Создать драфт»: name, «На основе», «Запретить правку текста драфта». */
export function CreateDraftDialog({
  drafts,
  onSubmit,
  ...open
}: Open & {
  drafts: Draft[];
  onSubmit: (name: string, base: string, locked: boolean) => Promise<void>;
}) {
  return (
    <Shell {...open}>
      <CreateDraftForm
        drafts={drafts}
        onSubmit={onSubmit}
        onDone={() => open.onOpenChange(false)}
      />
    </Shell>
  );
}

function CreateDraftForm({
  drafts,
  onSubmit,
  onDone,
}: {
  drafts: Draft[];
  onSubmit: (name: string, base: string, locked: boolean) => Promise<void>;
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [base, setBase] = useState(CURRENT);
  const [locked, setLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value === "") {
      setError("Назовите драфт.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value, base, locked);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-heading-2">Создать драфт</DialogTitle>
        <DialogDescription>
          Сохраните текст отдельным драфтом, чтобы не потерять этап работы.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>Название драфта</Label>
        <Input
          id={`${id}-name`}
          value={name}
          autoFocus
          placeholder="Например, После читки"
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${id}-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <Failure id={`${id}-error`} error={error} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-base`}>На основе</Label>
        <TextSelect
          id={`${id}-base`}
          value={base}
          drafts={drafts}
          onChange={setBase}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-lock`}
          checked={locked}
          onCheckedChange={(c) => setLocked(c === true)}
        />
        <Label htmlFor={`${id}-lock`} className="font-normal">
          Запретить правку текста драфта
        </Label>
      </div>
      <Actions submit="Создать" busy={busy} />
    </form>
  );
}

/** «Сравнить драфты»: two different texts, «Было» and «Стало». */
export function CompareDialog({
  drafts,
  onSubmit,
  ...open
}: Open & {
  drafts: Draft[];
  onSubmit: (a: string, b: string) => void;
}) {
  return (
    <Shell {...open}>
      <CompareForm drafts={drafts} onSubmit={onSubmit} />
    </Shell>
  );
}

function CompareForm({
  drafts,
  onSubmit,
}: {
  drafts: Draft[];
  onSubmit: (a: string, b: string) => void;
}) {
  const id = useId();
  const [a, setA] = useState(() => {
    if (drafts.length === 0)
      throw new Error("«Сравнить драфты» открыт без драфтов.");
    return drafts[0].id;
  });
  const [b, setB] = useState(CURRENT);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (a === b) {
      setError("Выберите два разных текста.");
      return;
    }
    onSubmit(a, b);
  }

  const pick = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-heading-2">Сравнить драфты</DialogTitle>
        <DialogDescription>
          Абзацы, которых нет в другом тексте, будут зачёркнуты слева и
          подчёркнуты справа.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-a`}>Было</Label>
        <TextSelect
          id={`${id}-a`}
          value={a}
          drafts={drafts}
          onChange={pick(setA)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-b`}>Стало</Label>
        <TextSelect
          id={`${id}-b`}
          value={b}
          drafts={drafts}
          onChange={pick(setB)}
        />
      </div>
      <Failure error={error} />
      <Actions submit="Сравнить" />
    </form>
  );
}

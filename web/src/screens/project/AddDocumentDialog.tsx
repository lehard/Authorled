import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EntityKind } from "@/data/model";

import { ENTITY_WORDS } from "./docRef";

const KINDS: EntityKind[] = ["char", "loc", "world"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: EntityKind;
  onSubmit: (kind: EntityKind, name: string) => Promise<void>;
};

/** «Добавить документ»: only structured entities, no free documents or folders. */
export function AddDocumentDialog({ open, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {/* Content unmounts on close, so every opening starts empty with `initialKind`. */}
        <AddDocumentForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function AddDocumentForm({
  onOpenChange,
  initialKind,
  onSubmit,
}: Omit<Props, "open">) {
  const id = useId();
  const [kind, setKind] = useState<EntityKind>(initialKind);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value === "") {
      setError(`Введите ${kind === "char" ? "имя" : "название"}.`);
      return;
    }
    try {
      await onSubmit(kind, value);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-heading-2">Добавить документ</DialogTitle>
        <DialogDescription>
          Персонаж, локация или мир — у каждого свой профиль.
        </DialogDescription>
      </DialogHeader>
      <div
        role="radiogroup"
        aria-label="Что добавить"
        className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1"
      >
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className="h-8 rounded-full text-sm aria-checked:bg-paper aria-checked:font-medium aria-checked:shadow-panel"
          >
            {ENTITY_WORDS[k].one}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id}>{ENTITY_WORDS[kind].nameLabel}</Label>
        <Input
          id={id}
          value={name}
          autoFocus
          aria-invalid={error !== null}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        {error !== null && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => onOpenChange(false)}
        >
          Отмена
        </Button>
        <Button type="submit" className="rounded-full">
          Добавить
        </Button>
      </DialogFooter>
    </form>
  );
}

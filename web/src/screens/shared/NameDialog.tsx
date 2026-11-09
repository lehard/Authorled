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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  initial?: string;
  submitLabel: string;
  emptyError: string;
  /** A refusal is shown under the name. */
  onSubmit: (name: string) => Promise<void>;
};

/** One required name field: creating a document, renaming. A new story has its own dialog (shelf/NewStoryDialog). */
export function NameDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {/* Content unmounts on close, so every opening starts from `initial`. */}
        <NameForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  onOpenChange,
  title,
  description,
  label,
  initial = "",
  submitLabel,
  emptyError,
  onSubmit,
}: Props) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (name === "") {
      setError(emptyError);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="text-heading-2">{title}</DialogTitle>
        {description !== undefined && (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={value}
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error !== null && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-caption text-destructive"
          >
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
        <Button type="submit" className="rounded-full" disabled={busy}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

import { FileUp, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

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
  /** An optional file next to the name (a manuscript of a new story). */
  file?: { label: string; accept: string; hint: string };
  /** A refusal is shown under the file field when a file was chosen, under the name otherwise. */
  onSubmit: (name: string, file: File | null) => Promise<void>;
};

/** One required name field (and an optional file): creating a story or a document, renaming. */
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
  file: fileField,
  onSubmit,
}: Props) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
      await onSubmit(name, file);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (file === null) setError(message);
      else setFileError(message);
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
      {fileField !== undefined && (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-file`}>{fileField.label}</Label>
          <input
            ref={fileInput}
            id={`${id}-file`}
            type="file"
            accept={fileField.accept}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFileError(null);
            }}
          />
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
              aria-invalid={fileError !== null}
              aria-describedby={`${id}-file-${fileError !== null ? "error" : "hint"}`}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp />
              {file === null ? "Выбрать файл" : "Другой файл"}
            </Button>
            {file !== null && (
              <>
                <span className="min-w-0 truncate text-body">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label={`Убрать файл «${file.name}»`}
                  onClick={() => {
                    setFile(null);
                    setFileError(null);
                    if (fileInput.current !== null)
                      fileInput.current.value = "";
                  }}
                >
                  <X />
                </Button>
              </>
            )}
          </div>
          {fileError !== null ? (
            <p
              id={`${id}-file-error`}
              role="alert"
              className="text-caption text-destructive"
            >
              {fileError}
            </p>
          ) : (
            <p
              id={`${id}-file-hint`}
              className="text-caption text-muted-foreground"
            >
              {fileField.hint}
            </p>
          )}
        </div>
      )}
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

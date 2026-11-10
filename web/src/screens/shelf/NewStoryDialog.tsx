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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANUSCRIPT_TYPES } from "@/data/files";
import { useStoryTemplates } from "@/data/hooks";

/** The choice «Без каркаса»: no template is sent and the core writes one empty scene heading. */
const NO_TEMPLATE = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A refusal is shown under the file field when a file was chosen, under the name otherwise. */
  onSubmit: (
    title: string,
    file: File | null,
    template: string | null,
  ) => Promise<void>;
};

/** A new story: a title, a manuscript or a structure template (openspec/specs/web/workspace, «Выбор каркаса»). */
export function NewStoryDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {/* Content unmounts on close, so every opening starts empty. */}
        <NewStoryForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NewStoryForm({ onOpenChange, onSubmit }: Props) {
  const id = useId();
  const { templates, query } = useStoryTemplates();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState(NO_TEMPLATE);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = templates.find((t) => t.id === template);
  const templatesError = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : String(query.error)
    : null;
  const choiceLocked =
    file !== null || query.isPending || templatesError !== null;

  function chooseFile(next: File | null) {
    setFile(next);
    setFileError(null);
    // A story from a manuscript starts from its text, never from a template.
    if (next !== null) setTemplate(NO_TEMPLATE);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (name === "") {
      setError("Введите название истории.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(name, file, template === NO_TEMPLATE ? null : template);
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
        <DialogTitle className="text-heading-2">Новая история</DialogTitle>
        <DialogDescription>
          Полнометражный сценарий. Название можно поменять потом.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={id}>Название</Label>
        <Input
          id={id}
          value={title}
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${id}-error` : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
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
      <div className="grid gap-2">
        <Label htmlFor={`${id}-template`}>Каркас</Label>
        <Select
          value={template}
          onValueChange={setTemplate}
          disabled={choiceLocked}
        >
          <SelectTrigger
            id={`${id}-template`}
            className="w-full bg-paper"
            aria-describedby={`${id}-template-note`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TEMPLATE}>Без каркаса</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {templatesError !== null ? (
          <p
            id={`${id}-template-note`}
            role="status"
            className="text-caption text-destructive"
          >
            {templatesError}
          </p>
        ) : (
          <p
            id={`${id}-template-note`}
            className="text-caption text-muted-foreground"
          >
            {file !== null
              ? "История из рукописи начинается с её текста, без каркаса."
              : chosen !== undefined
                ? chosen.description
                : "Пустой сценарий с одной сценой. С каркасом история начнётся с актов и сцен-заготовок с подсказками."}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-file`}>Рукопись (необязательно)</Label>
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept={MANUSCRIPT_TYPES}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
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
                  chooseFile(null);
                  if (fileInput.current !== null) fileInput.current.value = "";
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
            Fountain, Final Draft, STARC, DOCX или TXT: история создастся из
            текста файла.
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
          Создать
        </Button>
      </DialogFooter>
    </form>
  );
}

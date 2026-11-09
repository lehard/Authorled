import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NOTE_FILE_TYPES } from "@/data/files";

import { useNoteActions } from "./noteActions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The new note: the caller opens it. */
  onDone: (noteId: string) => void;
};

/**
 * «Загрузить файл» of the notes (openspec/specs/web/workspace, «Загрузка файла в заметки»): the core
 * checks the file like a file of the chat, its text becomes the note and the file its original.
 */
export function NoteUploadDialog({ open, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent className="rounded-panel bg-paper shadow-paper sm:max-w-md">
        {/* Content unmounts on close, so every opening starts without a status. */}
        <NoteUploadForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NoteUploadForm({
  onOpenChange,
  projectId,
  onDone,
}: Omit<Props, "open">) {
  const actions = useNoteActions(projectId);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(file.name);
    try {
      const id = await actions.fromFile(file);
      onOpenChange(false);
      onDone(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="text-heading-2">
          Загрузить файл в заметки
        </DialogTitle>
        <DialogDescription>
          DOCX, PDF, TXT, MD, Fountain, Final Draft или STARC до 20 МБ. Текст
          файла станет текстом заметки, а сам файл останется оригиналом.
        </DialogDescription>
      </DialogHeader>
      <input
        ref={input}
        type="file"
        accept={NOTE_FILE_TYPES}
        className="hidden"
        aria-label="Файл для заметки"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file !== undefined) void upload(file);
        }}
      />
      {uploading !== null && (
        <p role="status" className="text-caption text-muted-foreground">
          Проверяем «{uploading}»…
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
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
        <Button
          type="button"
          className="rounded-full"
          disabled={uploading !== null}
          onClick={() => input.current?.click()}
        >
          <Upload />
          Выбрать файл
        </Button>
      </DialogFooter>
    </div>
  );
}

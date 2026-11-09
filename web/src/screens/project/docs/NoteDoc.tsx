import {
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStoryFiles } from "@/data/files";
import type { Note, NoteFile } from "@/data/model";
import { GrowingTextarea } from "@/design-system";
import { useAutosave } from "@/screens/shared/useAutosave";
import { useServerChanges } from "@/screens/shared/useServerChanges";

import { DOC_WORDS, docPath } from "../docRef";
import { useNoteActions } from "../noteActions";
import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";
import { useFindInDoc } from "./useFindInDoc";

/**
 * A note with an original longer than this opens for reading (web/workspace, «Длинный материал для
 * чтения»; design of story-materials, decision 9): the growing field measures its height on every
 * key and takes about 1.5 s a key on 500 000 characters.
 */
const READ_ONLY_CHARS = 50_000;

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

/** The original of a note made from a file, with «Скачать оригинал» (web/workspace, «Оригинал заметки»). */
function Original({ file }: { file: NoteFile }) {
  const files = useStoryFiles();
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    try {
      const url = URL.createObjectURL(await files.content(file.id));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold">{file.name}</b>
        <span className="text-muted-foreground"> · {size(file.sizeBytes)}</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => void download()}
      >
        <Download />
        Скачать оригинал
      </Button>
      {error !== null && (
        <p role="alert" className="w-full text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A note: title and plain text on a sheet of paper; no draft and no lock of a draft close it. */
export function NoteDoc({ id }: { id: string }) {
  const { project, draft, notes } = useProjectData();
  const note = notes.find((n) => n.id === id);
  if (note === undefined) throw new Error(`Нет заметки ${id}.`);
  const navigate = useNavigate();
  const actions = useNoteActions(project.id);
  const { save, status } = useAutosave<Note>("notes", id);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  // The co-author may change the note while it is open: its changes show without a reload.
  useServerChanges(note.title, setTitle);
  useServerChanges(note.body, setBody);
  useFindInDoc();
  const words = DOC_WORDS.note;
  // A jump from the search of the story selects the match in the field (useFindInDoc), so it opens the
  // field during this render, before the effect looks for it, also in a note that is open already.
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(false);
  if (params.get("find") !== null && !editing) setEditing(true);
  const reading =
    note.file !== null && body.length > READ_ONLY_CHARS && !editing;

  return (
    <>
      <DocHead title={title.trim() === "" ? words.one : title} status={status}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Действия с заметкой"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                void actions
                  .trash(id, true)
                  .then(() => navigate(docPath(draft, { kind: "notes" })))
              }
            >
              <Trash2 />
              Удалить в корзину
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DocHead>
      <div className="mx-auto mb-4 max-w-[900px]">
        <FieldCard>
          <Field
            name="title"
            label={words.nameLabel}
            value={title}
            onChange={(v) => {
              setTitle(v);
              // An empty title is not saved: the navigator always needs a name.
              if (v.trim() !== "") save({ title: v.trim() });
            }}
          />
          {note.file !== null && <Original file={note.file} />}
          {reading && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 text-caption text-muted-foreground">
                Длинный материал открыт для чтения: правка такого текста идёт
                медленно.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditing(true)}
              >
                <Pencil />
                Править текст
              </Button>
            </div>
          )}
        </FieldCard>
      </div>
      <div className="sheet sheet-prose">
        {reading ? (
          <div
            aria-label="Текст заметки"
            className="break-words whitespace-pre-wrap"
          >
            {body}
          </div>
        ) : (
          <GrowingTextarea
            aria-label="Текст заметки"
            data-field="body"
            placeholder="Начните заметку"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              save({ body: e.target.value });
            }}
            variant="bare"
            // About the 320 px of the empty sheet: 11 lines of body-prose (18 px × 1.65).
            minRows={11}
            limit="none"
            placeholderClassName="placeholder:text-muted-foreground/60"
          />
        )}
      </div>
    </>
  );
}

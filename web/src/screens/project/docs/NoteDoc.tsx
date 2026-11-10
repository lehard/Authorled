import { FileX, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Note, NoteFile } from "@/data/model";
import { GrowingTextarea } from "@/design-system";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";
import { useAutosave } from "@/screens/shared/useAutosave";
import { useServerChanges } from "@/screens/shared/useServerChanges";

import { DOC_WORDS, docPath } from "../docRef";
import { useNoteActions } from "../noteActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { fileSize, hasOriginalView } from "./noteFile";
import { NoteIcon } from "./NoteIcon";
import { DownloadButton, NoteOriginal } from "./NoteOriginal";
import { useFindInDoc } from "./useFindInDoc";

/**
 * A note with an original longer than this opens for reading (web/workspace, «Длинный материал для
 * чтения»; design of story-materials, decision 9): the growing field measures its height on every
 * key and takes about 1.5 s a key on 500 000 characters.
 */
const READ_ONLY_CHARS = 50_000;

/** The line of the original under the heading: the kind, the name, the size and «Скачать». */
function OriginalLine({ file }: { file: NoteFile }) {
  return (
    <div className="mx-auto -mt-2 mb-4 flex max-w-[900px] flex-wrap items-center gap-2 text-caption text-muted-foreground">
      <NoteIcon file={file} className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="text-foreground">{file.name}</span> ·{" "}
        {fileSize(file.sizeBytes)}
      </span>
      <DownloadButton file={file} />
    </div>
  );
}

const FOR_COAUTHOR =
  "Этот текст видит соавтор: он отвечает по нему, а не по оригиналу.";

/** A note: title in the heading, plain text on a sheet; a note from a file shows its original too. */
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
  const file = note.file;
  const tabs = file !== null && hasOriginalView(file);
  // A jump from the search of the story selects the match in the field (useFindInDoc), so it opens the
  // text and its field during this render, before the effect looks for it, also in a note open already.
  const [params] = useSearchParams();
  const fromSearch = params.get("find") !== null;
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"original" | "text">("original");
  if (fromSearch && params.get("field") !== "title") {
    if (!editing) setEditing(true);
    if (tab !== "text") setTab("text");
  }
  const reading = file !== null && body.length > READ_ONLY_CHARS && !editing;
  const [confirm, setConfirm] = useState<"file" | "text" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function act(run: () => Promise<void>) {
    setFailure(null);
    try {
      await run();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }

  const text = (
    <div className="grid gap-3">
      {file !== null && (
        <div className="mx-auto flex w-full max-w-[760px] flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 text-caption text-muted-foreground">
            {FOR_COAUTHOR}
            {reading &&
              " Длинный материал открыт для чтения: правка такого текста идёт медленно."}
          </span>
          {reading && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setEditing(true)}
            >
              <Pencil />
              Править текст
            </Button>
          )}
        </div>
      )}
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
    </div>
  );

  return (
    <>
      <DocHead
        title={words.one}
        status={status}
        edit={{
          value: title,
          label: words.nameLabel,
          name: "title",
          onChange: (v) => {
            setTitle(v);
            // An empty title is not saved: the navigator always needs a name.
            if (v.trim() !== "") save({ title: v.trim() });
          },
          onBlur: () => {
            if (title.trim() === "") setTitle(note.title);
          },
        }}
      >
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
          <DropdownMenuContent align="end" className="w-auto">
            {file !== null && (
              <>
                <DropdownMenuItem onSelect={() => setConfirm("text")}>
                  <RotateCcw />
                  Вернуть текст из оригинала
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirm("file")}
                >
                  <FileX />
                  Удалить оригинал, оставить текст
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
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
      {file !== null && <OriginalLine file={file} />}
      {failure !== null && (
        <p
          role="alert"
          className="mx-auto mb-4 max-w-[900px] text-caption text-destructive"
        >
          {failure}
        </p>
      )}
      {tabs ? (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v === "text" ? "text" : "original")}
          className="gap-4"
        >
          <TabsList className="mx-auto">
            <TabsTrigger value="original">Оригинал</TabsTrigger>
            <TabsTrigger value="text">Текст для соавтора</TabsTrigger>
          </TabsList>
          <TabsContent value="original">
            <NoteOriginal key={file.id} file={file} />
          </TabsContent>
          <TabsContent value="text">{text}</TabsContent>
        </Tabs>
      ) : (
        text
      )}
      {file !== null && (
        <>
          <ConfirmDialog
            open={confirm === "file"}
            onOpenChange={(open) => setConfirm(open ? "file" : null)}
            title="Удалить оригинал?"
            text={`Файл «${file.name}» (${fileSize(file.sizeBytes)}) удалится навсегда, вернуть его нельзя. Название и текст заметки останутся.`}
            actionLabel="Удалить оригинал"
            onConfirm={() => void act(() => actions.removeFile(id))}
          />
          <ConfirmDialog
            open={confirm === "text"}
            onOpenChange={(open) => setConfirm(open ? "text" : null)}
            title="Вернуть текст из оригинала?"
            text={`Текст заметки заменится текстом из «${file.name}». Правки текста пропадут.`}
            actionLabel="Вернуть текст"
            onConfirm={() => void act(() => actions.textFromFile(id))}
          />
        </>
      )}
    </>
  );
}

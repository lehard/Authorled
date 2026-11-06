import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Note } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { DOC_WORDS, docPath } from "../docRef";
import { useNoteActions } from "../noteActions";
import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";

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
  const words = DOC_WORDS.note;

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
            label={words.nameLabel}
            value={title}
            onChange={(v) => {
              setTitle(v);
              // An empty title is not saved: the navigator always needs a name.
              if (v.trim() !== "") save({ title: v.trim() });
            }}
          />
        </FieldCard>
      </div>
      <div className="sheet sheet-prose">
        <textarea
          aria-label="Текст заметки"
          placeholder="Начните заметку"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            save({ body: e.target.value });
          }}
          className="block field-sizing-content min-h-80 w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </>
  );
}

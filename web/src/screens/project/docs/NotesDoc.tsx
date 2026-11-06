import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { NameDialog } from "@/screens/shared/NameDialog";

import { DOC_WORDS, docPath } from "../docRef";
import { firstLine, useNoteActions } from "../noteActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

/** «Заметки»: the notes of the story, the same in every draft. */
export function NotesDoc() {
  const { project, draft, notes } = useProjectData();
  const navigate = useNavigate();
  const actions = useNoteActions(project.id);
  const [adding, setAdding] = useState(false);
  const words = DOC_WORDS.note;

  return (
    <>
      <DocHead title={words.group}>
        <Button className="rounded-full" onClick={() => setAdding(true)}>
          <Plus />
          {words.add}
        </Button>
      </DocHead>
      <div className="mx-auto grid max-w-[900px] gap-2">
        {notes.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            <b className="mb-2 block text-heading-3 text-foreground">
              Пока пусто
            </b>
            Записывайте мысли по разработке сценария, чтобы они не терялись.
            Заметки общие для всех драфтов.
          </p>
        ) : (
          notes.map((n) => (
            <Link
              key={n.id}
              to={docPath(draft, { kind: "note", id: n.id })}
              className="grid gap-0.5 rounded-2xl bg-paper px-4 py-3 text-paper-foreground shadow-panel transition-shadow hover:shadow-paper"
            >
              <b className="truncate font-semibold">{n.title}</b>
              <small className="truncate text-caption text-muted-foreground">
                {firstLine(n.body)}
              </small>
            </Link>
          ))
        )}
      </div>
      <NameDialog
        open={adding}
        onOpenChange={setAdding}
        title={words.add}
        label={words.nameLabel}
        submitLabel="Добавить"
        emptyError="Введите название."
        onSubmit={async (title) => {
          const id = await actions.add(title);
          navigate(docPath(draft, { kind: "note", id }));
        }}
      />
    </>
  );
}

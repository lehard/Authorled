import { Columns2, Copy, Lock } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import type { Draft } from "@/data/model";
import type { ScreenplayDoc } from "@/editor/document.ts";
import { PrintError } from "@/editor";
import {
  ScreenplayEditor,
  type ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { useAutosave } from "@/screens/shared/useAutosave";

import { CURRENT, docPath } from "../docRef";
import { draftOf } from "../docTitle";
import { useDraftActions } from "../draftActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { ActionError, ExportItems } from "./ExportItems";

const created = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * A draft of the screenplay (screenplay-drafts, decision 5): the editor over its own copy of the
 * text, read-only while locked; edits are saved to the draft, never to the screenplay.
 */
export function DraftDoc({ id }: { id: string }) {
  const data = useProjectData();
  const draft = draftOf(data.drafts, id);
  const actions = useDraftActions(data);
  const navigate = useNavigate();
  const editor = useRef<ScreenplayEditorHandle>(null);
  // DocView remounts this screen per draft, so the working copy starts from the saved text.
  const [text, setText] = useState<ScreenplayDoc>(draft.text);
  const { save, status } = useAutosave<Draft>("drafts", id);
  const [error, setError] = useState<string | null>(null);
  const suggestData = useMemo(
    () => ({
      characters: data.chars.map((c) => c.name),
      locations: data.locs.map((l) => l.name),
    }),
    [data.chars, data.locs],
  );

  function act(action: () => void) {
    setError(null);
    try {
      action();
    } catch (e) {
      if (e instanceof PrintError) {
        setError(e.message);
        return;
      }
      throw e;
    }
  }

  function toggleLock() {
    setError(null);
    actions
      .lock(id, !draft.locked)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }

  const Icon = draft.locked ? Lock : Copy;
  return (
    <>
      <DocHead title={draft.name} status={status} wide />
      <div className="mx-auto mb-3 flex w-full max-w-[816px] flex-wrap items-center gap-2.5 rounded-2xl bg-panel px-3.5 py-2.5 shadow-panel">
        <span className="min-w-[min(100%,18rem)] flex-1">
          <Icon
            aria-hidden
            className="mr-2 inline size-4 align-[-3px] text-muted-foreground"
          />
          Драфт <b>«{draft.name}»</b> · создан{" "}
          {created.format(new Date(draft.createdAt))}
          {draft.locked && " · правка запрещена"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() =>
            navigate(
              docPath(data.project.id, { kind: "compare", a: id, b: CURRENT }),
            )
          }
        >
          <Columns2 />
          Сравнить с текущим
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={toggleLock}
        >
          {draft.locked ? "Разрешить правку" : "Запретить правку"}
        </Button>
      </div>
      <ScreenplayEditor
        ref={editor}
        mode="text"
        doc={text}
        readOnly={draft.locked}
        onChange={(next) => {
          setText(next);
          save({ text: next });
        }}
        suggestData={suggestData}
        menu={
          <ExportItems
            name={draft.name}
            editor={editor}
            titlePage={data.script.titlePage}
            act={act}
          />
        }
      />
      <ActionError error={error} onClose={() => setError(null)} />
    </>
  );
}

import { Printer } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SCRIPT_PARTS, type Script } from "@/data/model";
import { GrowingTextarea } from "@/design-system";
import {
  ProseEditor,
  type ProseEditorHandle,
} from "@/editor/prose/ProseEditor";
import { useAutosave } from "@/screens/shared/useAutosave";
import { useServerChanges } from "@/screens/shared/useServerChanges";

import { useProjectData } from "../ProjectContext";
import { DocSheetTasks, DocTasksButton } from "../chat/DocTasksMenu";
import { DocHead } from "./DocHead";
import { ActionError } from "./ExportItems";
import { SaveHistory } from "./SaveHistory";
import { useFindInDoc } from "./useFindInDoc";

const PLACEHOLDER = {
  logline: "Начните логлайн",
  synopsis: "Начните синопсис",
};

/** «Логлайн» or «Синопсис». */
export function ProseDoc({ part }: { part: "logline" | "synopsis" }) {
  return part === "logline" ? <LoglineDoc /> : <SynopsisDoc />;
}

/** «Логлайн»: prose on a sheet of paper; paragraphs are separated by an empty line. */
function LoglineDoc() {
  const part = "logline";
  const { draft, script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [text, setText] = useState(script[part]);
  // The co-author may write the logline while it is open: its text shows without a reload, and what
  // the author typed stays (web/workspace, «Экраны после действия соавтора»).
  useServerChanges(script[part], setText);
  useFindInDoc(part);
  return (
    <>
      <DocHead title={SCRIPT_PARTS[part]} status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
        <DocTasksButton part={part} />
      </DocHead>
      <div className="sheet sheet-prose">
        <GrowingTextarea
          aria-label={SCRIPT_PARTS[part]}
          data-field={part}
          placeholder={PLACEHOLDER[part]}
          readOnly={draft.locked}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            save({ [part]: e.target.value });
          }}
          variant="bare"
          // About the 320 px of the empty sheet: 11 lines of body-prose (18 px × 1.65).
          minRows={11}
          limit="none"
          placeholderClassName="placeholder:text-muted-foreground/60"
        />
        {text === "" && <DocSheetTasks part={part} />}
      </div>
    </>
  );
}

/**
 * «Синопсис» in the prose editor: Markdown in the field `synopsis`, the toolbar with the count of pages,
 * the marks of the page starts and the print (openspec/specs/web/prose-editor).
 */
function SynopsisDoc() {
  const part = "synopsis";
  const { draft, script, project } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [text, setText] = useState(script[part]);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<ProseEditorHandle>(null);
  useServerChanges(script[part], setText);
  const select = useCallback((find: string) => {
    if (editor.current === null)
      throw new Error("Переход из поиска: редактор синопсиса не готов.");
    editor.current.selectFind(find);
  }, []);
  useFindInDoc(part, select);

  async function print() {
    setError(null);
    if (editor.current === null)
      throw new Error("Печать синопсиса: редактор не готов.");
    try {
      await editor.current.print();
    } catch (e) {
      // A blocked window or a page font that did not load: the reason is shown, nothing is printed.
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <TooltipProvider>
      <DocHead title={SCRIPT_PARTS[part]} status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Печать"
              onClick={() => void print()}
            >
              <Printer />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Печать или PDF, листы A4</TooltipContent>
        </Tooltip>
        <DocTasksButton part={part} />
      </DocHead>
      <ProseEditor
        ref={editor}
        value={text}
        onChange={(markdown) => {
          setText(markdown);
          save({ [part]: markdown });
        }}
        readOnly={draft.locked}
        title={project.title}
        field={part}
        label={SCRIPT_PARTS[part]}
        placeholder={PLACEHOLDER[part]}
      >
        {text === "" && <DocSheetTasks part={part} />}
      </ProseEditor>
      <ActionError error={error} onClose={() => setError(null)} />
    </TooltipProvider>
  );
}

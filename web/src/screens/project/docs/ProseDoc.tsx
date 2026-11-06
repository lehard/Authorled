import { useState } from "react";

import { SCRIPT_PARTS, type Script } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { SaveHistory } from "./SaveHistory";

const PLACEHOLDER = {
  logline: "Начните логлайн",
  synopsis: "Начните синопсис",
};

/** «Логлайн» or «Синопсис»: prose on a sheet of paper; paragraphs are separated by an empty line. */
export function ProseDoc({ part }: { part: "logline" | "synopsis" }) {
  const { draft, script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [text, setText] = useState(script[part]);
  return (
    <>
      <DocHead title={SCRIPT_PARTS[part]} status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
      </DocHead>
      <div className="sheet sheet-prose">
        <textarea
          aria-label={SCRIPT_PARTS[part]}
          placeholder={PLACEHOLDER[part]}
          readOnly={draft.locked}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            save({ [part]: e.target.value });
          }}
          className="block field-sizing-content min-h-80 w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </>
  );
}

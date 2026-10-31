import { useState } from "react";

import type { Script } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

/** «Синопсис»: prose on a sheet of paper; paragraphs are separated by an empty line. */
export function SynopsisDoc() {
  const { script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [text, setText] = useState(script.synopsis);
  return (
    <>
      <DocHead title="Синопсис" status={status} />
      <div className="sheet sheet-prose">
        <textarea
          aria-label="Синопсис"
          placeholder="Начните синопсис"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            save({ synopsis: e.target.value });
          }}
          className="block field-sizing-content min-h-80 w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </>
  );
}

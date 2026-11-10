import type { ReactNode } from "react";

import { SaveStatus } from "@/screens/shared/SaveStatus";
import type { SaveStatus as Status } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { headPlace } from "./headPlace";

/** A title the author edits in the heading itself (web/workspace, «Название заметки в заголовке»). */
export type EditableTitle = {
  value: string;
  onChange: (value: string) => void;
  /** Leaving the field: an empty title goes back to the saved one there. */
  onBlur: () => void;
  label: string;
  /** Key of the field for a jump from the search of the story (`data-field`, useFindInDoc). */
  name?: string;
};

/** Heading row of a document: title, save status, actions; as tall as the account menu. */
export function DocHead({
  title,
  status,
  children,
  wide = false,
  edit,
}: {
  title: string;
  status?: Status;
  children?: ReactNode;
  wide?: boolean;
  edit?: EditableTitle;
}) {
  const { openFresh } = useProjectData();
  return (
    <div
      className={`mb-4 flex min-h-9 flex-wrap items-center gap-2.5 ${headPlace(wide)}`}
    >
      {edit === undefined ? (
        <h1 className="min-w-[min(100%,14rem)] flex-1 truncate text-heading-1 font-medium">
          {title}
        </h1>
      ) : (
        <h1 className="min-w-[min(100%,14rem)] flex-1 text-heading-1 font-medium">
          <input
            aria-label={edit.label}
            data-field={edit.name}
            value={edit.value}
            placeholder={title}
            onChange={(e) => edit.onChange(e.target.value)}
            onBlur={edit.onBlur}
            className="-mx-2 w-full truncate rounded-lg bg-transparent px-2 outline-none placeholder:text-muted-foreground/60 hover:bg-paper/60 focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-ring"
          />
        </h1>
      )}
      {status !== undefined && (
        <SaveStatus status={status} onFresh={openFresh} />
      )}
      {children}
    </div>
  );
}

/** A card of fields on the desk. */
export function FieldCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3.5 rounded-2xl bg-paper p-5 text-paper-foreground shadow-panel">
      {children}
    </div>
  );
}

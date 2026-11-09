import type { ReactNode } from "react";

import { SaveStatus } from "@/screens/shared/SaveStatus";
import type { SaveStatus as Status } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { headPlace } from "./headPlace";

/** Heading row of a document: title, save status, actions; as tall as the account menu. */
export function DocHead({
  title,
  status,
  children,
  wide = false,
}: {
  title: string;
  status?: Status;
  children?: ReactNode;
  wide?: boolean;
}) {
  const { openFresh } = useProjectData();
  return (
    <div
      className={`mb-4 flex min-h-9 flex-wrap items-center gap-2.5 ${headPlace(wide)}`}
    >
      <h1 className="min-w-[min(100%,14rem)] flex-1 truncate text-heading-1 font-medium">
        {title}
      </h1>
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

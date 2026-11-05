import { Lock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useDraftActions } from "../draftActions";
import { useProjectData } from "../ProjectContext";

/** Tells that a locked draft opens read-only and lets the author open it again. */
export function LockBanner() {
  const data = useProjectData();
  const actions = useDraftActions(data);
  const [error, setError] = useState<string | null>(null);
  if (!data.draft.locked) return null;
  return (
    <div className="mx-auto mb-3 flex w-full max-w-[1000px] flex-wrap items-center gap-2.5 rounded-2xl bg-panel px-3.5 py-2.5 shadow-panel">
      <span className="min-w-[min(100%,14rem)] flex-1">
        <Lock
          aria-hidden
          className="mr-2 inline size-4 align-[-3px] text-muted-foreground"
        />
        Драфт <b>«{data.draft.name}»</b>: правка запрещена
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => {
          setError(null);
          actions
            .lock(data.draft.id, false)
            .catch((e: unknown) =>
              setError(e instanceof Error ? e.message : String(e)),
            );
        }}
      >
        Разрешить правку
      </Button>
      {error !== null && (
        <p role="alert" className="w-full text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

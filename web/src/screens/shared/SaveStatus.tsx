import { useState } from "react";

import { Button } from "@/components/ui/button";

import { editText, type SaveStatus as Status } from "./useAutosave";

export function SaveStatus({
  status,
  onFresh,
}: {
  status: Status;
  /** «Открыть свежую версию» after a conflict (openspec/specs/web/workspace, «Конфликт правок»). */
  onFresh: () => void;
}) {
  if (typeof status === "object" && "conflict" in status)
    return <Conflict edit={status.conflict} onFresh={onFresh} />;
  if (typeof status === "object") {
    return (
      <span role="alert" className="text-caption text-destructive">
        Не сохранено: {status.error}
      </span>
    );
  }
  return (
    <span role="status" className="text-caption text-muted-foreground">
      {status === "saving" ? "Сохраняется…" : "Сохранено"}
    </span>
  );
}

function Conflict({
  edit,
  onFresh,
}: {
  edit: Record<string, unknown>;
  onFresh: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <span
      role="alert"
      className="flex flex-wrap items-center gap-2 text-caption text-destructive"
    >
      История изменилась в другой вкладке
      <Button size="xs" variant="outline" onClick={onFresh}>
        Открыть свежую версию
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(editText(edit)).then(
            () => setCopied("Скопировано"),
            (e: unknown) =>
              setCopied(
                `Не скопировалось: ${e instanceof Error ? e.message : String(e)}`,
              ),
          );
        }}
      >
        {copied ?? "Скопировать мою правку"}
      </Button>
    </span>
  );
}

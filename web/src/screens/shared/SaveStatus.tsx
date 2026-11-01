import type { SaveStatus as Status } from "./useAutosave";

export function SaveStatus({ status }: { status: Status }) {
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

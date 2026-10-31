import { useUpdate } from "@refinedev/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | { error: string };

const DELAY_MS = 600;

/**
 * Saves edits of one record after a pause in typing (design, decision 9). Pending fields are
 * merged, so quick edits of several fields go out as one update. A failed save stays visible.
 */
export function useAutosave<T extends object>(resource: string, id: string) {
  const { mutateAsync } = useUpdate();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<Partial<T>>({});
  const timer = useRef<number | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const values = pending.current;
    pending.current = {};
    setStatus("saving");
    try {
      await mutateAsync({
        resource,
        id,
        values,
        successNotification: false,
        errorNotification: false,
      });
      setStatus("saved");
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : String(e) });
    }
  }, [mutateAsync, resource, id]);

  const save = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), DELAY_MS);
    },
    [flush],
  );

  // Leaving the document saves what was typed instead of dropping it.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        void flush();
      }
    },
    [flush],
  );

  return { save, status };
}

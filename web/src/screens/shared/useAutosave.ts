import { useUpdate } from "@refinedev/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { isConflict } from "@/data/apiClient";
import { paragraphs, type ScreenplayDoc } from "@/editor/document.ts";

/**
 * `conflict`: the core refused the save because the record has a newer revision (another tab);
 * the unsaved edit waits there until the author opens the fresh version or copies it
 * (openspec/specs/web/workspace, «Конфликт правок»).
 */
export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | { error: string }
  | { conflict: Record<string, unknown> };

const DELAY_MS = 600;

const weight = (status: SaveStatus): number =>
  typeof status === "object"
    ? "conflict" in status
      ? 3
      : 2
    : status === "saving"
      ? 1
      : 0;

/** One status for a screen that saves two records: the one the author must see first. */
export function combineStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
  return weight(b) > weight(a) ? b : a;
}

/**
 * Saves edits of one record after a pause in typing (design, decision 9). Pending fields are
 * merged, so quick edits of several fields go out as one update. A failed save stays visible;
 * after a conflict nothing is sent until `discard`.
 */
export function useAutosave<T extends object>(resource: string, id: string) {
  const { mutateAsync } = useUpdate();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<Partial<T>>({});
  const timer = useRef<number | null>(null);
  // Saves sent and not answered yet: «Сохранено» only when none is left and none is waiting.
  const sending = useRef(0);
  // The edit the core refused, with what was typed after it.
  const conflict = useRef<Partial<T> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const values = pending.current;
    pending.current = {};
    setStatus("saving");
    sending.current += 1;
    try {
      await mutateAsync({
        resource,
        id,
        values,
        successNotification: false,
        errorNotification: false,
      });
      sending.current -= 1;
      if (
        conflict.current === null &&
        sending.current === 0 &&
        timer.current === null
      )
        setStatus("saved");
    } catch (e) {
      sending.current -= 1;
      // A save that was already on its way after a conflict joins the waiting edit.
      if (isConflict(e) || conflict.current !== null) {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        conflict.current = {
          ...conflict.current,
          ...values,
          ...pending.current,
        };
        pending.current = {};
        setStatus({ conflict: { ...conflict.current } });
        return;
      }
      setStatus({ error: e instanceof Error ? e.message : String(e) });
    }
  }, [mutateAsync, resource, id]);

  const save = useCallback(
    (patch: Partial<T>) => {
      if (conflict.current !== null) {
        conflict.current = { ...conflict.current, ...patch };
        setStatus({ conflict: { ...conflict.current } });
        return;
      }
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), DELAY_MS);
    },
    [flush],
  );

  /** After «Открыть свежую версию»: the unsaved edit is dropped and saving starts again. */
  const discard = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pending.current = {};
    conflict.current = null;
    setStatus("idle");
  }, []);

  // Leaving the document (or the record) saves what was typed instead of dropping it. Keyed
  // on the record, not on `flush`: Refine's `mutateAsync` is a new function on every render,
  // and a cleanup keyed on it sent every keystroke at once. The cleanup reads the `flush` of
  // the record being left: effect cleanups of a commit run before its effects update the ref.
  const flushLatest = useRef(flush);
  useEffect(() => {
    flushLatest.current = flush;
  });
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        void flushLatest.current();
      }
    },
    [resource, id],
  );

  return { save, status, discard };
}

/** «Скопировать мою правку»: the values of the edit as plain text, field by field. */
export function editText(values: Record<string, unknown>): string {
  const part = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (isDoc(value))
      return paragraphs(value)
        .map((p) => p.text)
        .join("\n");
    if (typeof value === "object" && value !== null)
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${part(v)}`)
        .join("\n");
    return JSON.stringify(value);
  };
  return Object.values(values).map(part).join("\n\n");
}

function isDoc(value: unknown): value is ScreenplayDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc"
  );
}

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

// A change made elsewhere (the co-author) reaches an open form without taking what the author
// typed there (openspec/specs/web/workspace, «Экраны после действия соавтора»).

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The form after the saved record went from `before` to `after`: a field the author has not
 * changed in the form takes the new saved value; a field the author changed keeps their input.
 * Objects (the profile fields) are merged field by field.
 */
export function takeServerChanges<T>(before: T, after: T, form: T): T {
  if (isObject(before) && isObject(after) && isObject(form)) {
    const merged: Record<string, unknown> = { ...form };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
      merged[key] = takeServerChanges(before[key], after[key], form[key]);
    return merged as T;
  }
  return !same(after, before) && same(form, before) ? after : form;
}

/** Keeps the form state of a record up to date with the saved record, as takeServerChanges. */
export function useServerChanges<T>(
  saved: T,
  setForm: Dispatch<SetStateAction<T>>,
): void {
  const base = useRef(saved);
  useEffect(() => {
    const before = base.current;
    if (same(before, saved)) return;
    base.current = saved;
    setForm((form) => takeServerChanges(before, saved, form));
  }, [saved, setForm]);
}

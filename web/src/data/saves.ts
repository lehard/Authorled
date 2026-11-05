import { useCustomMutation, useInvalidate } from "@refinedev/core";

import type { VersionTarget } from "./model";

// Actions of a draft that are no edits of a record, through the `custom` operations of the data
// source: remembering the open draft and the rollbacks. Both sources support them.

export type SaveOperation =
  | { operation: "openDraft"; payload: { draftId: string } }
  | {
      operation: "restoreVersion";
      payload: { id: string; target: VersionTarget };
    }
  | { operation: "restorePoint"; payload: { id: string } };

const quiet = { successNotification: false, errorNotification: false } as const;

export function useSaveActions() {
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const run = async (op: SaveOperation): Promise<void> => {
    await mutateAsync({
      url: op.operation,
      method: "post",
      values: op.payload,
      meta: { operation: op.operation },
      ...quiet,
    });
  };
  return {
    /** Remembers the draft: the story opens there next time, on any device. */
    async open(draftId: string) {
      await run({ operation: "openDraft", payload: { draftId } });
      await invalidate({
        resource: "projects",
        invalidates: ["list", "detail"],
      });
    },
    restoreVersion: (id: string, target: VersionTarget) =>
      run({ operation: "restoreVersion", payload: { id, target } }),
    restorePoint: (id: string) =>
      run({ operation: "restorePoint", payload: { id } }),
  };
}

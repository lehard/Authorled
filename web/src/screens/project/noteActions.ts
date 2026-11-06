import { useCreate, useDelete, useUpdate } from "@refinedev/core";

import type { NewNote } from "@/data/model";

const quiet = { successNotification: false, errorNotification: false } as const;

/** The first line with words of a note, for lists. */
export function firstLine(body: string): string {
  return body.split("\n").find((line) => line.trim() !== "") ?? "Без текста";
}

/** Notes of a story: add, move to the trash and back, delete for good. */
export function useNoteActions(projectId: string) {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();

  return {
    async add(title: string): Promise<string> {
      const values: NewNote = { projectId, title };
      const { data } = await create({ resource: "notes", values, ...quiet });
      return String(data.id);
    },
    async trash(id: string, inTrash: boolean) {
      const values = { deletedAt: inTrash ? new Date().toISOString() : null };
      await update({ resource: "notes", id, values, ...quiet });
    },
    async purge(id: string) {
      await remove({ resource: "notes", id, ...quiet });
    },
  };
}

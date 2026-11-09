import {
  useCreate,
  useDelete,
  useInvalidate,
  useUpdate,
} from "@refinedev/core";

import { useStoryFiles } from "@/data/files";
import type { NewNote } from "@/data/model";

const quiet = { successNotification: false, errorNotification: false } as const;

/** The first line with words of a note, for lists. */
export function firstLine(body: string): string {
  return body.split("\n").find((line) => line.trim() !== "") ?? "Без текста";
}

/** Notes of a story: add, from a file, move to the trash and back, delete for good. */
export function useNoteActions(projectId: string) {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const files = useStoryFiles();
  const invalidate = useInvalidate();
  const reload = () => invalidate({ resource: "notes", invalidates: ["list"] });

  return {
    async add(title: string): Promise<string> {
      const values: NewNote = { projectId, title };
      const { data } = await create({ resource: "notes", values, ...quiet });
      return String(data.id);
    },
    /** A note from a file, with the file as its original. */
    async fromFile(file: File): Promise<string> {
      const note = await files.noteFromUpload(projectId, file);
      await reload();
      return note.id;
    },
    /** A note from a file of the conversation, with a copy of the file. */
    async fromChatFile(fileId: string): Promise<string> {
      const note = await files.noteFromChatFile(fileId);
      await reload();
      return note.id;
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

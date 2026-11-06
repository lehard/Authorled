import {
  useCreate,
  useDelete,
  useInvalidate,
  useUpdate,
} from "@refinedev/core";

import type { Draft, Entity, EntityKind, NewDraft, Note } from "@/data/model";

import { useEntityActions } from "./entityActions";
import { useNoteActions } from "./noteActions";
import type { ProjectData } from "./ProjectContext";

const quiet = { successNotification: false, errorNotification: false } as const;

/** Drafts of a story: create, rename, lock, move to the story trash and back, delete. */
export function useDraftActions(data: Pick<ProjectData, "project">) {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const invalidate = useInvalidate();
  const patch = async (id: string, values: Partial<Draft>) => {
    await update({ resource: "drafts", id, values, ...quiet });
    // The shelf counts the drafts and knows where a story opens.
    await invalidate({ resource: "projects", invalidates: ["list", "detail"] });
  };

  return {
    /** An independent copy of `baseId`; the data source makes it. */
    async create(name: string, baseId: string): Promise<string> {
      const values: NewDraft = { projectId: data.project.id, name, baseId };
      const { data: row } = await create({
        resource: "drafts",
        values,
        ...quiet,
      });
      await invalidate({
        resource: "projects",
        invalidates: ["list", "detail"],
      });
      return String(row.id);
    },
    async rename(id: string, name: string) {
      await patch(id, { name });
    },
    async lock(id: string, locked: boolean) {
      await patch(id, { locked });
    },
    async trash(id: string, inTrash: boolean) {
      await patch(id, {
        deletedAt: inTrash ? new Date().toISOString() : null,
      });
    },
    async purge(id: string) {
      await remove({ resource: "drafts", id, ...quiet });
    },
  };
}

/** A document of the story trash. */
export type TrashItem =
  | { kind: EntityKind; x: Entity }
  | { kind: "note"; x: Note }
  | { kind: "draft"; x: Draft };

export const trashName = (i: TrashItem) =>
  i.kind === "note" ? i.x.title : i.x.name;

/** The confirmation of «Очистить корзину»: notes go for every draft of the story. */
export function emptyTrashText(items: TrashItem[]): string {
  const notes = items.filter((i) => i.kind === "note").length;
  const shared =
    notes === 0 ? "" : ` Заметки (${notes}) удалятся для всех драфтов.`;
  return `Документы из корзины (${items.length}) удалятся без возможности восстановления.${shared}`;
}

export function trashItems(trash: ProjectData["trash"]): TrashItem[] {
  return [
    ...(["char", "loc", "world"] as const).flatMap((kind) =>
      trash[kind].map((x): TrashItem => ({ kind, x })),
    ),
    ...trash.note.map((x): TrashItem => ({ kind: "note", x })),
    ...trash.draft.map((x): TrashItem => ({ kind: "draft", x })),
  ];
}

/** «Восстановить» and «Удалить навсегда» for any document of the trash. */
export function useTrashActions(data: ProjectData) {
  const entities = useEntityActions(data.draft.id);
  const drafts = useDraftActions(data);
  const notes = useNoteActions(data.project.id);
  return {
    restore: (i: TrashItem) =>
      i.kind === "draft"
        ? drafts.trash(i.x.id, false)
        : i.kind === "note"
          ? notes.trash(i.x.id, false)
          : entities.trash(i.kind, i.x.id, false),
    purge: (i: TrashItem) =>
      i.kind === "draft"
        ? drafts.purge(i.x.id)
        : i.kind === "note"
          ? notes.purge(i.x.id)
          : entities.purge(i.kind, i.x.id),
  };
}

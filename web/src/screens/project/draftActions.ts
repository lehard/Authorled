import {
  useCreate,
  useDelete,
  useInvalidate,
  useUpdate,
} from "@refinedev/core";

import type { Draft, Entity, EntityKind, NewDraft } from "@/data/model";

import { useEntityActions } from "./entityActions";
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
  { kind: EntityKind; x: Entity } | { kind: "draft"; x: Draft };

export function trashItems(trash: ProjectData["trash"]): TrashItem[] {
  return [
    ...(["char", "loc", "world"] as const).flatMap((kind) =>
      trash[kind].map((x): TrashItem => ({ kind, x })),
    ),
    ...trash.draft.map((x): TrashItem => ({ kind: "draft", x })),
  ];
}

/** «Восстановить» and «Удалить навсегда» for any document of the trash. */
export function useTrashActions(data: ProjectData) {
  const entities = useEntityActions(data.draft.id);
  const drafts = useDraftActions(data);
  return {
    restore: (i: TrashItem) =>
      i.kind === "draft"
        ? drafts.trash(i.x.id, false)
        : entities.trash(i.kind, i.x.id, false),
    purge: (i: TrashItem) =>
      i.kind === "draft"
        ? drafts.purge(i.x.id)
        : entities.purge(i.kind, i.x.id),
  };
}

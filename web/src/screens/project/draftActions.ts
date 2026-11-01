import { useCreate, useDelete, useUpdate } from "@refinedev/core";

import type { Draft, Entity, EntityKind } from "@/data/model";
import { stripMarks } from "@/editor/document.ts";

import { CURRENT } from "./docRef";
import { draftOf } from "./docTitle";
import { useEntityActions } from "./entityActions";
import type { ProjectData } from "./ProjectContext";

const quiet = { successNotification: false, errorNotification: false } as const;

/** Drafts of the screenplay: create, rename, lock, move to the story trash and back, delete. */
export function useDraftActions(data: ProjectData) {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();
  const patch = (id: string, values: Partial<Draft>) =>
    update({ resource: "drafts", id, values, ...quiet });

  return {
    /** A copy of the current text without comments and suggestions, or of another draft. */
    async create(name: string, base: string, locked: boolean): Promise<string> {
      const text =
        base === CURRENT
          ? stripMarks(data.text, ["comment", "suggestion"])
          : draftOf(data.drafts, base).text;
      const values: Omit<Draft, "id"> = {
        projectId: data.project.id,
        name,
        locked,
        createdAt: new Date().toISOString(),
        text,
        deletedAt: null,
      };
      const { data: row } = await create({
        resource: "drafts",
        values,
        ...quiet,
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
  const entities = useEntityActions(data.project.id);
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

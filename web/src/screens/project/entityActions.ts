import { useCreate, useDelete, useUpdate } from "@refinedev/core";

import {
  ENTITY_RESOURCE,
  type Character,
  type EntityKind,
  type Location,
  type World,
} from "@/data/model";

const quiet = { successNotification: false, errorNotification: false } as const;

type NewEntity =
  Omit<Character, "id"> | Omit<Location, "id"> | Omit<World, "id">;

function blank(kind: EntityKind, projectId: string, name: string): NewEntity {
  const base = { projectId, name, one: "", long: "", ext: {}, deletedAt: null };
  if (kind === "char")
    return { ...base, role: "secondary", age: "", gender: "" };
  if (kind === "loc") return { ...base, role: "secondary" };
  return { ...base, overview: "" };
}

/** Characters, locations and worlds: add, move to the story trash and back, delete for good. */
export function useEntityActions(projectId: string) {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: remove } = useDelete();

  return {
    async add(kind: EntityKind, name: string): Promise<string> {
      const { data } = await create({
        resource: ENTITY_RESOURCE[kind],
        values: blank(kind, projectId, name),
        ...quiet,
      });
      return String(data.id);
    },
    async trash(kind: EntityKind, id: string, inTrash: boolean) {
      const values = { deletedAt: inTrash ? new Date().toISOString() : null };
      await update({ resource: ENTITY_RESOURCE[kind], id, values, ...quiet });
    },
    async purge(kind: EntityKind, id: string) {
      await remove({ resource: ENTITY_RESOURCE[kind], id, ...quiet });
    },
  };
}

import { useCreate, useGetIdentity, useUpdate } from "@refinedev/core";

import type { Identity } from "@/auth/authProvider";
import type { Project, Script } from "@/data/model";

const quiet = { successNotification: false, errorNotification: false } as const;

/** Creating, renaming and moving stories to the trash and back. */
export function useStoryActions() {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { data: me } = useGetIdentity<Identity>();

  // Only a feature film for now (decision 2026-10-31); it opens on an empty scene heading.
  async function createStory(title: string): Promise<string> {
    if (me === undefined)
      throw new Error("Профиль пользователя ещё не загружен.");
    const project: Omit<Project, "id" | "updatedAt"> = {
      title,
      desc: "",
      cover: false,
      deletedAt: null,
    };
    const { data } = await create({
      resource: "projects",
      values: project,
      ...quiet,
    });
    const id = String(data.id);
    const script: Script = {
      id,
      projectId: id,
      name: title,
      tagline: "",
      logline: "",
      show: { title: true, synopsis: true, text: true },
      titlePage: {
        title,
        genre: "Полнометражный сценарий",
        author: me.name,
        contacts: me.email,
        place: "",
      },
      synopsis: "",
      blocks: [{ id: crypto.randomUUID(), t: "sh", text: "" }],
    };
    await create({ resource: "scripts", values: script, ...quiet });
    return id;
  }

  async function renameStory(id: string, title: string) {
    await update({ resource: "projects", id, values: { title }, ...quiet });
  }

  async function trashStory(id: string, inTrash: boolean) {
    await update({
      resource: "projects",
      id,
      values: { deletedAt: inTrash ? new Date().toISOString() : null },
      ...quiet,
    });
  }

  return { createStory, renameStory, trashStory };
}

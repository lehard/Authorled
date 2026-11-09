import { useCreate, useGetIdentity, useUpdate } from "@refinedev/core";

import type { Identity } from "@/auth/authProvider";
import { useStoryFiles, type NewStory } from "@/data/files";
import type { CoverColor, Project, Script } from "@/data/model";

const quiet = { successNotification: false, errorNotification: false } as const;

/** Creating, renaming and moving stories to the trash and back. */
export function useStoryActions() {
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();
  const { data: me } = useGetIdentity<Identity>();
  const files = useStoryFiles();

  // Only a feature film for now (decision 2026-10-31); the data source creates the screenplay
  // with one empty scene heading, as the core does, or from a manuscript (import of the core),
  // and the title page is filled here.
  async function createStory(
    title: string,
    file: File | null,
  ): Promise<string> {
    if (me === undefined)
      throw new Error("Профиль пользователя ещё не загружен.");
    let story: NewStory;
    if (file === null) {
      const project: Pick<Project, "title" | "desc"> = { title, desc: "" };
      const { data } = await create({
        resource: "projects",
        values: project,
        ...quiet,
      });
      story = data as unknown as NewStory;
    } else {
      story = await files.createFromFile(title, file);
    }
    const script: Pick<Script, "show" | "titlePage"> = {
      show: {
        title: true,
        logline: true,
        synopsis: true,
        treatment: true,
        text: true,
      },
      titlePage: {
        title,
        genre: "Полнометражный сценарий",
        author: me.name,
        contacts: me.email,
        place: "",
      },
    };
    await update({
      resource: "scripts",
      id: story.draftId,
      values: script,
      ...quiet,
    });
    return story.id;
  }

  async function renameStory(id: string, title: string) {
    await update({ resource: "projects", id, values: { title }, ...quiet });
  }

  async function setCoverColor(id: string, coverColor: CoverColor) {
    await update({
      resource: "projects",
      id,
      values: { coverColor },
      ...quiet,
    });
  }

  async function trashStory(id: string, inTrash: boolean) {
    await update({
      resource: "projects",
      id,
      values: { deletedAt: inTrash ? new Date().toISOString() : null },
      ...quiet,
    });
  }

  return { createStory, renameStory, setCoverColor, trashStory };
}

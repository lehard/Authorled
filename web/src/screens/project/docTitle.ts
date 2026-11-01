import { SCRIPT_PARTS } from "@/data/model";

import { CURRENT, ENTITY_WORDS, type DocRef } from "./docRef";
import type { ProjectData } from "./ProjectContext";

/** Name of the open document, for the mobile header and «Видит: …» of the chat. */
export function docTitle(
  data: Omit<
    ProjectData,
    | "doc"
    | "docSegment"
    | "currentScene"
    | "setCurrentScene"
    | "text"
    | "setText"
    | "textStatus"
    | "openChat"
  >,
  ref: DocRef,
): string {
  switch (ref.kind) {
    case "info":
      return data.project.title;
    case "sp":
      return data.script.name;
    case "part":
      return SCRIPT_PARTS[ref.part];
    case "group":
      return ENTITY_WORDS[ref.entity].group;
    case "trash":
      return "Корзина";
    case "draft":
      return `Драфт «${draftOf(data.drafts, ref.id).name}»`;
    case "compare":
      return "Сравнение драфтов";
    case "entity": {
      const list = { char: data.chars, loc: data.locs, world: data.worlds }[
        ref.entity
      ];
      const x = list.find((e) => e.id === ref.id);
      if (x === undefined)
        throw new Error(`Нет документа ${ref.entity}:${ref.id}.`);
      return x.name;
    }
  }
}

/** The draft `id` of the story; the window shows «Не найдено» before a missing one gets here. */
export function draftOf(drafts: ProjectData["drafts"], id: string) {
  const d = drafts.find((x) => x.id === id);
  if (d === undefined) throw new Error(`Нет драфта ${id}.`);
  return d;
}

/** Name of one side of a comparison. */
export function sideName(drafts: ProjectData["drafts"], id: string): string {
  return id === CURRENT
    ? "Текущий текст"
    : `Драфт «${draftOf(drafts, id).name}»`;
}

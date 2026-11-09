import { SCRIPT_PARTS } from "@/data/model";

import { DOC_WORDS, ENTITY_WORDS, type DocRef } from "./docRef";
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
    | "askCoauthor"
    | "coauthorBusy"
    | "openFresh"
    | "generation"
  >,
  ref: DocRef,
): string {
  switch (ref.kind) {
    case "info":
      return data.project.title;
    case "part":
      return SCRIPT_PARTS[ref.part];
    case "group":
      return ENTITY_WORDS[ref.entity].group;
    case "notes":
      return DOC_WORDS.note.group;
    case "note": {
      const note = data.notes.find((n) => n.id === ref.id);
      if (note === undefined) throw new Error(`Нет заметки ${ref.id}.`);
      return note.title;
    }
    case "trash":
      return "Корзина";
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

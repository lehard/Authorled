import { SCRIPT_PARTS, type Entity, type EntityKind } from "@/data/model";
import { PROFILE, ROLES } from "@/data/profiles";
import { paragraphs } from "@/editor/document.ts";
import { ELEMENTS, OUTLINE_TYPES } from "@/editor/elements.ts";

import { ENTITY_WORDS } from "../docRef";
import type { ProjectData } from "../ProjectContext";

// What the co-author sees (openspec/specs/web/workspace, «Контекст соавтора»): the story, the
// open document as plain text and the selected fragment. Long documents are cut at MAX_CHARS.

export const MAX_CHARS = 20_000;

function entityText(kind: EntityKind, x: Entity): string {
  const lines = [`${ENTITY_WORDS[kind].one}: ${x.name}`];
  if ("role" in x && kind !== "world") {
    const role = ROLES[kind].find((r) => r.value === x.role);
    if (role === undefined)
      throw new Error(`Неизвестная роль «${x.role}» у «${x.name}».`);
    lines.push(`Роль: ${role.label}`);
  }
  if ("age" in x && x.age !== "") lines.push(`Возраст: ${x.age}`);
  if (x.one !== "") lines.push(`Одной фразой: ${x.one}`);
  if (x.long !== "") lines.push(`Описание: ${x.long}`);
  if ("overview" in x && x.overview !== "")
    lines.push(`Обзор мира: ${x.overview}`);
  for (const section of PROFILE[kind]) {
    for (const f of section.fields) {
      const value = (x.ext[f.key] ?? "").trim();
      if (value !== "") lines.push(`${section.title} — ${f.label}: ${value}`);
    }
  }
  return lines.join("\n");
}

function documentText(data: ProjectData): { title: string; text: string } {
  const { doc, script, project } = data;
  switch (doc.kind) {
    case "info":
      return {
        title: "История",
        text: `Название: ${project.title}\nОписание: ${project.desc}`,
      };
    case "sp":
      return {
        title: "Сценарий",
        text: `Название: ${script.name}\nТэглайн: ${script.tagline}\nЛоглайн: ${script.logline}`,
      };
    case "part":
      if (doc.part === "title") {
        const t = script.titlePage;
        return {
          title: SCRIPT_PARTS.title,
          text: [t.title, t.genre, t.author, t.contacts, t.place]
            .filter((v) => v !== "")
            .join("\n"),
        };
      }
      if (doc.part === "synopsis")
        return { title: SCRIPT_PARTS.synopsis, text: script.synopsis };
      return {
        title: SCRIPT_PARTS[doc.part],
        text: paragraphs(data.text)
          // The treatment shows the co-author what the author sees: headings, beats, groups, acts.
          .filter((p) => doc.part === "text" || OUTLINE_TYPES.includes(p.type))
          .filter((p) => p.text.trim() !== "")
          .map((p) => `[${ELEMENTS[p.type].label}] ${p.text}`)
          .join("\n"),
      };
    case "group": {
      const list: Entity[] = {
        char: data.chars,
        loc: data.locs,
        world: data.worlds,
      }[doc.entity];
      return {
        title: ENTITY_WORDS[doc.entity].group,
        text: list
          .map((x) => `${x.name}${x.one === "" ? "" : ` — ${x.one}`}`)
          .join("\n"),
      };
    }
    case "entity": {
      const list: Entity[] = {
        char: data.chars,
        loc: data.locs,
        world: data.worlds,
      }[doc.entity];
      const x = list.find((e) => e.id === doc.id);
      if (x === undefined)
        throw new Error(`Нет документа ${doc.entity}:${doc.id}.`);
      return { title: x.name, text: entityText(doc.entity, x) };
    }
    case "trash":
      return {
        title: "Корзина",
        text: "Автор смотрит удалённые документы истории.",
      };
  }
}

/** The single context entry sent with every message of the chat. */
export function coauthorContext(data: ProjectData, selection: string): string {
  const { title, text } = documentText(data);
  const cut =
    text.length > MAX_CHARS
      ? `${text.slice(0, MAX_CHARS)}\n…(текст обрезан)`
      : text;
  return [
    `История: «${data.project.title}» (полнометражный сценарий).`,
    `Открыт документ: ${title}.`,
    "Содержимое документа:",
    cut === "" ? "(пусто)" : cut,
    ...(selection === "" ? [] : ["", "Автор выделил фрагмент:", selection]),
  ].join("\n");
}

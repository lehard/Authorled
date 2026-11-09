import type { Message, ToolCall } from "@ag-ui/client";

import type { EntityKind } from "@/data/model";
import { PROFILE } from "@/data/profiles";

import type { ProjectData } from "../ProjectContext";
import type { DocRef } from "../docRef";
import { readOutcome, type Target } from "./outcome";

// Actions of the co-author in the chat (openspec/specs/web/workspace, «Подтверждение действия
// соавтора», «Сделанное соавтором в чате»). The names are the changing tools of the backend
// (agno/agents/coauthor_tools.py, CHANGING_TOOLS): in the mode «Спрашивать» the run pauses on
// them and the author answers here.

export const CHANGING_TOOLS = [
  "create_story_note",
  "save_chat_file_to_notes",
  "update_story_note",
  "create_story_document",
  "update_story_document",
  "comment_on_screenplay",
] as const;
export type ToolName = (typeof CHANGING_TOOLS)[number];

export function isChanging(name: string): name is ToolName {
  return (CHANGING_TOOLS as readonly string[]).includes(name);
}

/** What the author sends back: Agno runs the call only on `accepted: true`. */
export const ALLOW = { accepted: true };
export const DENY = { accepted: false, note: "Автор отклонил это действие." };

export type Args = Record<string, unknown>;

const SERVER_KIND: Record<string, EntityKind> = {
  character: "char",
  location: "loc",
  world: "world",
};
const CREATE_WORDS: Record<string, string> = {
  character: "персонажа",
  location: "локацию",
  world: "мир",
};
// Names of the fields of a document as the screens show them; profile fields come from PROFILE.
const FIELD_WORDS: Record<string, string> = {
  name: "Имя",
  role: "Роль",
  summary: "Одной фразой",
  description: "Описание",
  age: "Возраст",
  gender: "Пол",
  overview: "Обзор",
  logline: "Логлайн",
  synopsis: "Синопсис",
  show: "Поэпизодник",
  title_page: "Титульный лист",
};

function text(args: Args, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function fieldLabel(key: string): string {
  for (const sections of Object.values(PROFILE))
    for (const section of sections)
      for (const field of section.fields)
        if (field.key === key) return field.label;
  return FIELD_WORDS[key] ?? key;
}

function documentName(data: ProjectData, id: string): string {
  const found = [...data.chars, ...data.locs, ...data.worlds].find(
    (d) => d.id === id,
  );
  if (found !== undefined) return found.name;
  return id === data.script.documentId ? "Сценарий" : "документ";
}

function noteName(data: ProjectData, id: string): string {
  return data.notes.find((n) => n.id === id)?.title ?? "заметка";
}

/** The action of a call in words, and what it carries (a text, a quote), for the card. */
export function describeAction(
  name: ToolName,
  args: Args,
  data: ProjectData,
): { title: string; detail: string } {
  switch (name) {
    case "create_story_note":
      return {
        title: `Создать заметку «${text(args, "title")}»`,
        detail: text(args, "body"),
      };
    case "save_chat_file_to_notes":
      return { title: "Сохранить файл в заметки", detail: "" };
    case "update_story_note": {
      const note = noteName(data, text(args, "note_id"));
      if (text(args, "append") !== "")
        return {
          title: `Дописать в заметку «${note}»`,
          detail: text(args, "append"),
        };
      const what = ["title", "body"]
        .filter((k) => k in args && args[k] !== null)
        .map((k) => (k === "title" ? "название" : "текст"));
      return {
        title: `Изменить заметку «${note}»: ${what.join(", ")}`,
        detail: text(args, "body") || text(args, "title"),
      };
    }
    case "create_story_document": {
      const kind = text(args, "kind");
      return {
        title: `Создать ${CREATE_WORDS[kind] ?? kind} «${text(args, "name")}»`,
        detail: text(args, "summary"),
      };
    }
    case "update_story_document": {
      const keys = ["name", "role", "summary"].filter(
        (k) => k in args && args[k] !== null,
      );
      const fields = args.fields;
      if (typeof fields === "object" && fields !== null)
        keys.push(...Object.keys(fields));
      return {
        title: `Изменить «${documentName(data, text(args, "document_id"))}»: ${keys.map(fieldLabel).join(", ")}`,
        detail:
          typeof fields === "object" && fields !== null
            ? Object.values(fields)
                .filter((v): v is string => typeof v === "string")
                .join(" · ")
            : text(args, "summary"),
      };
    }
    case "comment_on_screenplay":
      return {
        title: `Комментарий к «${text(args, "quote")}»`,
        detail: text(args, "text"),
      };
  }
}

export function parseArgs(raw: string): Args {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Args)
      : {};
  } catch {
    // The arguments stream in parts: until the last one they are not JSON yet.
    return {};
  }
}

type Decision = { accepted: boolean };

export function decisionOf(content: string): Decision | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { accepted?: unknown }).accepted === "boolean"
    )
      return { accepted: (parsed as Decision).accepted };
  } catch {
    // A refusal of the core is plain text, not a decision.
  }
  return null;
}

type Done = { done: string; target: Target };

/** What a done call did and where it opens; null for a refusal or a result the chat cannot read. */
export function doneOf(content: string): Done | null {
  const outcome = readOutcome(content);
  return outcome.kind === "done"
    ? { done: outcome.done, target: outcome.target }
    : null;
}

/** Where a changed thing opens: a card, a note or the screenplay text. */
export function targetRef(target: Target): DocRef {
  if (target.type === "note") return { kind: "note", id: target.id };
  if (target.type === "document") {
    const entity = SERVER_KIND[target.kind ?? ""];
    return entity === undefined
      ? { kind: "info" }
      : { kind: "entity", entity, id: target.id };
  }
  return { kind: "part", part: "text" };
}

/** What a done call changed, for the screens to read it again. */
export function changedResources(content: string): string[] {
  const done = doneOf(content);
  if (done === null) return [];
  if (done.target.type === "note") return ["notes"];
  if (done.target.type === "comment") return ["comments"];
  return ["characters", "locations", "worlds", "scripts"];
}

/** The text of a tool result; AG-UI 1.0 allows content parts, of which only text answers a call. */
export function toolText(
  content: string | { type: string; text?: string }[],
): string {
  return typeof content === "string"
    ? content
    : content
        .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
        .join("");
}

export function toolMessages(messages: Message[], id: string): string[] {
  return messages
    .filter(
      (m): m is Extract<Message, { role: "tool" }> =>
        m.role === "tool" && m.toolCallId === id,
    )
    .map((m) => toolText(m.content));
}

/**
 * The changing calls each message shows, by message id: a call shows once, under the first
 * message that carries it, also when Agno sends a paused call again with its continuation.
 */
export function firstChangingCalls(
  messages: Message[],
): Map<string, ToolCall[]> {
  const seen = new Set<string>();
  const found = new Map<string, ToolCall[]>();
  for (const m of messages) {
    const calls = (m.role === "assistant" ? (m.toolCalls ?? []) : []).filter(
      (call) => isChanging(call.function.name) && !seen.has(call.id),
    );
    for (const call of calls) seen.add(call.id);
    found.set(m.id, calls);
  }
  return found;
}

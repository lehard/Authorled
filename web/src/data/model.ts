// Records of the workspace as the data provider returns them. Kept close to the future
// core API: separate entities with projectId and soft delete (deletedAt).
import type { ScreenplayDoc } from "@/editor/document.ts";

export type Role = "main" | "secondary" | "episodic";
export type EntityKind = "char" | "loc" | "world";

export type Project = {
  id: string;
  title: string;
  desc: string;
  cover: boolean;
  updatedAt: string;
  deletedAt: string | null;
};

export const SCRIPT_PARTS = {
  title: "Титульная страница",
  synopsis: "Синопсис",
  treatment: "Поэпизодник",
  text: "Текст сценария",
} as const;
export type ScriptPart = keyof typeof SCRIPT_PARTS;

export type TitlePage = {
  title: string;
  genre: string;
  author: string;
  contacts: string;
  place: string;
};

/** One screenplay per project; its id equals the project id. */
export type Script = {
  id: string;
  projectId: string;
  name: string;
  tagline: string;
  logline: string;
  show: Record<ScriptPart, boolean>;
  titlePage: TitlePage;
  synopsis: string;
  /** Text of the screenplay: the editor document (web/src/editor, design decision 13). */
  text: ScreenplayDoc;
};

type EntityBase = {
  id: string;
  projectId: string;
  name: string;
  one: string;
  long: string;
  ext: Record<string, string>;
  deletedAt: string | null;
};

export type Gender = "" | "f" | "m" | "o";
export type Character = EntityBase & {
  role: Role;
  age: string;
  gender: Gender;
};
export type Location = EntityBase & { role: Role };
export type World = EntityBase & { overview: string };
export type Entity = Character | Location | World;

/** A message of a comment thread; `email` tells the author's own messages. */
export type CommentMessage = {
  id: string;
  author: string;
  email: string;
  /** Role in the story team, «редактор»; empty when the token has none. */
  role: string;
  /** ISO time. */
  at: string;
  text: string;
};

/**
 * A comment thread on a fragment of the screenplay (screenplay-comments, decision 3). Its id is
 * the id of the `comment` mark in the text; the first message is the thread itself.
 */
export type CommentThread = CommentMessage & {
  projectId: string;
  replies: CommentMessage[];
  resolved: boolean;
};

/** Refine resource of each entity kind. */
export const ENTITY_RESOURCE = {
  char: "characters",
  loc: "locations",
  world: "worlds",
} as const satisfies Record<EntityKind, string>;

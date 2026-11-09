// Records of the workspace as the data provider returns them: separate entities of a draft
// (draftId) and soft delete (deletedAt). The `api` source translates the core records into these
// (design of story-data-web, decision 1); revisions stay inside the provider.
import type { ScreenplayDoc } from "@/editor/document.ts";

export type Role = "main" | "secondary" | "episodic";
export type EntityKind = "char" | "loc" | "world";

/** Colours of a story's cover, in the order the core gives them to new stories. */
export const COVER_COLORS = {
  blue: "Синий",
  teal: "Бирюзовый",
  amber: "Янтарный",
  crimson: "Малиновый",
  plum: "Сливовый",
  graphite: "Графит",
} as const;
export type CoverColor = keyof typeof COVER_COLORS;

export function isCoverColor(value: unknown): value is CoverColor {
  return typeof value === "string" && Object.hasOwn(COVER_COLORS, value);
}

/** The colour after `last` in the palette, from the first one; the core's rule for a new story. */
export function nextCoverColor(last: CoverColor | undefined): CoverColor {
  const order = Object.keys(COVER_COLORS) as CoverColor[];
  return last === undefined
    ? order[0]
    : order[(order.indexOf(last) + 1) % order.length];
}

export type Project = {
  id: string;
  title: string;
  desc: string;
  coverColor: CoverColor;
  updatedAt: string;
  deletedAt: string | null;
  /** Drafts outside the trash. */
  draftsCount: number;
  /** The draft this story opens in for the signed-in user. */
  openDraftId: string;
  /** The goal of the story in words (openspec/specs/api/writing); null is no goal. */
  wordGoal: number | null;
  /** Deadline of the goal, `YYYY-MM-DD`; only with a goal. */
  goalDeadline: string | null;
};

/** A new story: its title and, without a manuscript, the structure template it starts from. */
export type NewProject = Pick<Project, "title" | "desc"> & {
  template?: string;
};

/** A structure template of a new story (openspec/specs/api/stories, «Список каркасов»). */
export type StoryTemplate = {
  id: string;
  name: string;
  description: string;
  acts: { name: string; points: { name: string; hint: string }[] }[];
};

export const SCRIPT_PARTS = {
  title: "Титульная страница",
  logline: "Логлайн",
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

/** One screenplay per draft; its id equals the draft id. */
export type Script = {
  id: string;
  draftId: string;
  /** Id of the screenplay's document in the core: the co-author's calls name the screenplay by it. */
  documentId: string;
  logline: string;
  show: Record<ScriptPart, boolean>;
  titlePage: TitlePage;
  synopsis: string;
  /** Text of the screenplay: the editor document (web/src/editor, design decision 13). */
  text: ScreenplayDoc;
};

type EntityBase = {
  id: string;
  draftId: string;
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

/** A note of the author: it belongs to the story and is the same in every draft. */
/** The original of a note made from a file (openspec/specs/api/stories, «Заметка из файла»). */
export type NoteFile = {
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
};

export type Note = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  deletedAt: string | null;
  /** The original; null for a note written by hand. */
  file: NoteFile | null;
};

/** A new note: it starts without text. */
export type NewNote = Pick<Note, "projectId" | "title">;

/** A message of a comment thread; `own`: written by the signed-in user (the data source decides). */
export type CommentMessage = {
  id: string;
  /** «Соавтор» for a message of the co-author, which is nobody's own and is not edited. */
  author: string;
  kind: "user" | "coauthor";
  own: boolean;
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
  draftId: string;
  /** The commented words when the thread was opened. */
  quote: string;
  /** The scene of the quote of a co-author thread, by which its mark is placed; null for the author's. */
  sceneUid: string | null;
  replies: CommentMessage[];
  resolved: boolean;
};

/** A new thread: `id` is the id of its `comment` mark in the text. */
export type NewThread = {
  id: string;
  draftId: string;
  quote: string;
  text: string;
};

/** A new reply of resource `comment-replies`; `meta.threadId` names its thread. */
export type NewReply = { text: string };

/**
 * A co-author suggestion (coauthor-suggestions, decision 5). Its id is the id of the
 * `suggestion` mark on the text it would replace; the text changes only on «Принять».
 */
export type Suggestion = {
  id: string;
  draftId: string;
  /**
   * Anchor of the co-author: the scene and the exact words to replace. The text screen puts the
   * mark on the first match inside one paragraph of that scene (design of story-data-web, decision 5).
   */
  sceneUid: string;
  quote: string;
  /** ISO time. */
  at: string;
  /** Why the co-author suggests it. */
  why: string;
  /** The suggested text. */
  text: string;
  status: "open" | "accepted" | "rejected";
  /** ISO time of the author's decision. */
  decidedAt: string | null;
};

/**
 * A draft of a story: a parallel version that owns its screenplay, cards, review and
 * conversations. All drafts are equal; a locked one opens read-only.
 */
export type Draft = {
  id: string;
  projectId: string;
  name: string;
  locked: boolean;
  /** Name of the draft it was copied from, for the label «от Драфта 1». */
  forkedFromName: string | null;
  /** ISO time. */
  createdAt: string;
  deletedAt: string | null;
};

/** A new draft: an independent copy of `baseId`, made by the data source as the core does. */
export type NewDraft = { projectId: string; name: string; baseId: string };

export type VersionPart = "text" | "fields";
export type VersionReason =
  "auto" | "suggestion" | "import" | "restore" | "coauthor";

/** What a history belongs to: a part of the screenplay of a draft, or a card. */
export type VersionTarget =
  | { draftId: string; part: VersionPart }
  | { documentId: string; part: "fields" };

/** A snapshot of a part of a document, as it was saved. */
export type Version = {
  id: string;
  part: VersionPart;
  reason: VersionReason;
  savedByName: string;
  /** ISO time. */
  savedAt: string;
};

/** A snapshot with what it keeps: the text, or the name and fields of the document. */
export type VersionContent = Version & { content: Record<string, unknown> };

/** A named point of a whole draft; `auto` is made by the core before a rollback. */
export type Point = {
  id: string;
  draftId: string;
  name: string;
  kind: "manual" | "auto";
  createdByName: string;
  /** ISO time. */
  createdAt: string;
};

/** Refine resource of each entity kind. */
export const ENTITY_RESOURCE = {
  char: "characters",
  loc: "locations",
  world: "worlds",
} as const satisfies Record<EntityKind, string>;

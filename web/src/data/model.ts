// Records of the workspace as the data provider returns them. Kept close to the future
// core API: separate entities with projectId and soft delete (deletedAt).

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

/** Paragraph types of the screenplay, after STARC (mockup v2, data.js TYPES). */
export const BLOCK_TYPES = {
  sh: "Заголовок сцены",
  cast: "Участники сцены",
  ac: "Описание действия",
  ch: "Персонаж",
  pa: "Ремарка",
  dl: "Реплика",
  ly: "Лирика",
  shot: "Кадр",
  tr: "Переход",
  un: "Простой текст",
  note: "Заметка по тексту",
  beat: "Бит",
  seq: "Группа",
  act: "Акт",
} as const;
export type BlockType = keyof typeof BLOCK_TYPES;

export type Block = { id: string; t: BlockType; text: string };

export const SCRIPT_PARTS = {
  title: "Титульная страница",
  synopsis: "Синопсис",
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
  blocks: Block[];
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

/** Refine resource of each entity kind. */
export const ENTITY_RESOURCE = {
  char: "characters",
  loc: "locations",
  world: "worlds",
} as const satisfies Record<EntityKind, string>;

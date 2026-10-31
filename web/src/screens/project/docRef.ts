import type { EntityKind, ScriptPart } from "@/data/model";

// The :doc segment of /p/:projectId/:doc (openspec/specs/web/workspace, «Адреса экранов»).

export type DocRef =
  | { kind: "info" }
  | { kind: "sp" }
  | { kind: "part"; part: ScriptPart }
  | { kind: "group"; entity: EntityKind }
  | { kind: "entity"; entity: EntityKind; id: string }
  | { kind: "trash" };

export const GROUPS = {
  chars: "char",
  locs: "loc",
  worlds: "world",
} as const satisfies Record<string, EntityKind>;
export type GroupKey = keyof typeof GROUPS;
export const GROUP_OF: Record<EntityKind, GroupKey> = {
  char: "chars",
  loc: "locs",
  world: "worlds",
};

export const ENTITY_WORDS: Record<
  EntityKind,
  { group: string; one: string; add: string; nameLabel: string }
> = {
  char: {
    group: "Персонажи",
    one: "Персонаж",
    add: "Добавить персонажа",
    nameLabel: "Имя",
  },
  loc: {
    group: "Локации",
    one: "Локация",
    add: "Добавить локацию",
    nameLabel: "Название",
  },
  world: {
    group: "Миры",
    one: "Мир",
    add: "Добавить мир",
    nameLabel: "Название",
  },
};

/** Parses the segment; null means «Не найдено». */
export function parseDoc(doc: string): DocRef | null {
  if (doc === "info" || doc === "sp" || doc === "trash") return { kind: doc };
  if (
    doc === "title" ||
    doc === "synopsis" ||
    doc === "treatment" ||
    doc === "text"
  )
    return { kind: "part", part: doc };
  if (doc in GROUPS) return { kind: "group", entity: GROUPS[doc as GroupKey] };
  const m = /^(char|loc|world):(.+)$/.exec(doc);
  if (m !== null)
    return { kind: "entity", entity: m[1] as EntityKind, id: m[2] };
  return null;
}

export function docPath(projectId: string, ref: DocRef): string {
  const seg =
    ref.kind === "part"
      ? ref.part
      : ref.kind === "group"
        ? GROUP_OF[ref.entity]
        : ref.kind === "entity"
          ? `${ref.entity}:${ref.id}`
          : ref.kind;
  return `/p/${projectId}/${seg}`;
}

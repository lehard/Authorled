import type { EntityKind, ScriptPart } from "@/data/model";

// The :doc segment of /p/:projectId/:doc (openspec/specs/web/workspace, «Адреса экранов»).

export type DocRef =
  | { kind: "info" }
  | { kind: "sp" }
  | { kind: "part"; part: ScriptPart }
  | { kind: "group"; entity: EntityKind }
  | { kind: "entity"; entity: EntityKind; id: string }
  | { kind: "draft"; id: string }
  /** `a` («было») and `b` («стало»): "current" or a draft id, never the same. */
  | { kind: "compare"; a: string; b: string }
  | { kind: "trash" };

/** The current text of the screenplay on either side of a comparison. */
export const CURRENT = "current";

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
  const d = /^draft:(.+)$/.exec(doc);
  if (d !== null) return { kind: "draft", id: d[1] };
  const c = /^compare:([^:]+):([^:]+)$/.exec(doc);
  if (c !== null && c[1] !== c[2]) return { kind: "compare", a: c[1], b: c[2] };
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
          : ref.kind === "draft"
            ? `draft:${ref.id}`
            : ref.kind === "compare"
              ? `compare:${ref.a}:${ref.b}`
              : ref.kind;
  return `/p/${projectId}/${seg}`;
}

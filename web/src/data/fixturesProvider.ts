import type {
  BaseKey,
  BaseRecord,
  CrudFilter,
  CrudSort,
  DataProvider,
  Pagination,
} from "@refinedev/core";

import { FIXTURES } from "./fixtures";

// Data source `fixtures` (openspec/specs/web/workspace, «Источник данных»): sample data of
// mockup v2 in page memory, reset on reload. Anything this provider does not support is an
// error naming it, never an empty result.

type Row = BaseRecord & { id: string };
const RESOURCES = [
  "projects",
  "scripts",
  "characters",
  "locations",
  "worlds",
  "comments",
  "suggestions",
  "drafts",
] as const;
type Resource = (typeof RESOURCES)[number];

const store: Record<Resource, Row[]> = structuredClone(FIXTURES);

function table(resource: string): Row[] {
  if (!(RESOURCES as readonly string[]).includes(resource)) {
    throw new Error(`Источник fixtures не знает ресурс «${resource}».`);
  }
  return store[resource as Resource];
}

function find(resource: string, id: BaseKey): Row {
  const row = table(resource).find((r) => r.id === String(id));
  if (row === undefined) {
    // Same shape as an HttpError of an API provider, so screens tell «not found» apart.
    throw Object.assign(
      new Error(`В ресурсе «${resource}» нет записи «${String(id)}».`),
      { statusCode: 404 },
    );
  }
  return row;
}

function matches(row: Row, filter: CrudFilter): boolean {
  if (!("field" in filter)) {
    throw new Error(
      `Источник fixtures не поддерживает составной фильтр «${filter.operator}».`,
    );
  }
  const value: unknown = row[filter.field];
  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "null":
      return value === null;
    case "nnull":
      return value !== null;
    default:
      throw new Error(
        `Источник fixtures не поддерживает фильтр «${filter.operator}».`,
      );
  }
}

function compare(a: Row, b: Row, sorter: CrudSort): number {
  const x: unknown = a[sorter.field];
  const y: unknown = b[sorter.field];
  if (typeof x !== "string" || typeof y !== "string") {
    throw new Error(
      `Источник fixtures сортирует только строки, поле «${sorter.field}».`,
    );
  }
  const order = x.localeCompare(y, "ru");
  return sorter.order === "desc" ? -order : order;
}

// Screens list whole collections; pagination is not part of this source yet.
function checkPagination(pagination: Pagination | undefined): void {
  if (pagination?.mode !== "off") {
    throw new Error(
      `Источник fixtures отдаёт списки целиком: нужен pagination.mode = "off", получено «${String(pagination?.mode)}».`,
    );
  }
}

const now = () => new Date().toISOString();
// Copies leave the store unchanged until the next mutation; React Query keeps its own copies.
const out = <T>(row: Row): T => structuredClone(row) as unknown as T;

export const fixturesProvider: DataProvider = {
  getApiUrl: () => {
    throw new Error("У источника fixtures нет адреса API.");
  },

  getList: async ({ resource, filters = [], sorters = [], pagination }) => {
    checkPagination(pagination);
    let rows = table(resource).filter((row) =>
      filters.every((f) => matches(row, f)),
    );
    for (const sorter of [...sorters].reverse())
      rows = [...rows].sort((a, b) => compare(a, b, sorter));
    return { data: rows.map((r) => out(r)), total: rows.length };
  },

  getOne: async ({ resource, id }) => ({ data: out(find(resource, id)) }),

  create: async ({ resource, variables }) => {
    const row = { id: crypto.randomUUID(), ...(variables as object) } as Row;
    if (resource === "projects") Object.assign(row, { updatedAt: now() });
    table(resource).push(row);
    return { data: out(row) };
  },

  update: async ({ resource, id, variables }) => {
    const row = find(resource, id);
    Object.assign(row, variables as object);
    if (resource === "projects") row.updatedAt = now();
    return { data: out(row) };
  },

  deleteOne: async ({ resource, id }) => {
    const rows = table(resource);
    const row = find(resource, id);
    rows.splice(rows.indexOf(row), 1);
    // A project deleted for good takes its screenplay and documents with it, as the core will.
    if (resource === "projects") {
      for (const name of [
        "scripts",
        "characters",
        "locations",
        "worlds",
        "comments",
        "suggestions",
        "drafts",
      ] as const) {
        store[name] = store[name].filter((r) => r.projectId !== row.id);
      }
    }
    return { data: out(row) };
  },
};

import type {
  BaseKey,
  BaseRecord,
  CrudFilter,
  CrudSort,
  DataProvider,
  MetaQuery,
  Pagination,
} from "@refinedev/core";

import { activeUser } from "@/auth/userManager";
import { plainDoc, stripMarks } from "@/editor/document.ts";

import { FIXTURES, type FixtureMessage, type FixtureThread } from "./fixtures";
import type {
  CommentThread,
  NewDraft,
  NewReply,
  NewThread,
  Project,
  Script,
} from "./model";

// Data source `fixtures` (openspec/specs/web/workspace, «Источник данных»): sample data of
// mockup v2 in page memory, reset on reload. It behaves as the core where screens rely on it
// (a story comes with its screenplay, a draft is a copy made by the source, a message is the
// signed-in user's own by e-mail). Anything this provider does not support is an error naming
// it, never an empty result.

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

const store = structuredClone(FIXTURES) as unknown as Record<Resource, Row[]>;

/** Import and chat files need the core (design of story-data-web, decision 7). */
export const FIXTURES_UNAVAILABLE =
  "Недоступно с данными примера: импорт и файлы в чат работают только с источником данных api.";

function table(resource: string): Row[] {
  if (!(RESOURCES as readonly string[]).includes(resource)) {
    throw new Error(`Источник fixtures не знает ресурс «${resource}».`);
  }
  return store[resource as Resource];
}

function notFound(resource: string, id: BaseKey): Error {
  // Same shape as an HttpError of the api provider, so screens tell «not found» apart.
  return Object.assign(
    new Error(`В ресурсе «${resource}» нет записи «${String(id)}».`),
    { statusCode: 404 },
  );
}

function find(resource: string, id: BaseKey): Row {
  const row = table(resource).find((r) => r.id === String(id));
  if (row === undefined) throw notFound(resource, id);
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

/** The signed-in user: author of new messages and owner of their own ones. */
async function signedIn(): Promise<{ name: string; email: string }> {
  const user = await activeUser();
  if (user === null) throw new Error("Вход истёк. Войдите снова.");
  const { email, name } = user.profile;
  if (email === undefined)
    throw new Error("В токене входа нет почты пользователя.");
  return { email, name: name ?? email };
}

// Copies leave the store unchanged until the next mutation; React Query keeps its own copies.
async function out<T>(resource: string, row: Row): Promise<T> {
  if (resource !== "comments") return structuredClone(row) as unknown as T;
  const { email } = await signedIn();
  const t = row as unknown as FixtureThread;
  const own = (m: FixtureMessage) => {
    const { email: author, ...rest } = m;
    return { ...rest, own: author === email };
  };
  const thread: CommentThread = {
    ...own(t),
    projectId: t.projectId,
    quote: t.quote,
    resolved: t.resolved,
    replies: t.replies.map(own),
  };
  return structuredClone(thread) as unknown as T;
}

function threadOf(meta: MetaQuery | undefined): FixtureThread {
  const id: unknown = meta?.threadId;
  if (typeof id !== "string")
    throw new Error("Ответу комментария нужен meta.threadId.");
  return find("comments", id) as unknown as FixtureThread;
}

async function message(text: string): Promise<FixtureMessage> {
  const { name, email } = await signedIn();
  return {
    id: crypto.randomUUID(),
    author: name,
    email,
    role: "",
    at: now(),
    text,
  };
}

function ownMessage(m: FixtureMessage, email: string): void {
  if (m.email !== email)
    throw Object.assign(new Error("Чужое сообщение менять нельзя."), {
      statusCode: 403,
    });
}

const STORY_PARTS = [
  "scripts",
  "characters",
  "locations",
  "worlds",
  "comments",
  "suggestions",
  "drafts",
] as const;

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
    const data = await Promise.all(rows.map((r) => out(resource, r)));
    return { data: data as never, total: rows.length };
  },

  getOne: async ({ resource, id }) => ({
    data: await out(resource, find(resource, id)),
  }),

  create: async ({ resource, variables, meta }) => {
    if (resource === "comment-replies") {
      const values = variables as NewReply;
      threadOf(meta).replies.push(await message(values.text));
      return { data: {} as never };
    }
    let row: Row;
    if (resource === "projects") {
      // A story comes with its screenplay, as in the core: one empty scene heading.
      const project = variables as Pick<Project, "title" | "desc">;
      row = {
        id: crypto.randomUUID(),
        title: project.title,
        desc: project.desc,
        cover: false,
        updatedAt: now(),
        deletedAt: null,
      };
      const script: Script = {
        id: row.id,
        projectId: row.id,
        name: project.title,
        tagline: "",
        logline: "",
        show: { title: true, synopsis: true, treatment: true, text: true },
        titlePage: {
          title: "",
          genre: "",
          author: "",
          contacts: "",
          place: "",
        },
        synopsis: "",
        text: plainDoc([["sceneHeading", ""]]),
      };
      store.scripts.push(script as unknown as Row);
    } else if (resource === "comments") {
      const values = variables as NewThread;
      row = {
        ...(await message(values.text)),
        id: values.id,
        projectId: values.projectId,
        quote: values.quote,
        replies: [],
        resolved: false,
      };
    } else if (resource === "drafts") {
      // The copy of the base without comments and suggestions, as the core makes it.
      const values = variables as NewDraft;
      const base =
        values.baseId === null
          ? find("scripts", values.projectId)
          : find("drafts", values.baseId);
      row = {
        id: crypto.randomUUID(),
        projectId: values.projectId,
        name: values.name,
        locked: values.locked,
        createdAt: now(),
        text: stripMarks((base as unknown as Script).text, [
          "comment",
          "suggestion",
        ]),
        deletedAt: null,
      };
    } else {
      row = { id: crypto.randomUUID(), ...(variables as object) } as Row;
    }
    table(resource).push(row);
    return { data: await out(resource, row) };
  },

  update: async ({ resource, id, variables, meta }) => {
    if (resource === "comment-replies") {
      const thread = threadOf(meta);
      const { email } = await signedIn();
      const m =
        thread.id === String(id)
          ? thread
          : thread.replies.find((r) => r.id === String(id));
      if (m === undefined) throw notFound(resource, id);
      ownMessage(m, email);
      m.text = (variables as NewReply).text;
      return { data: {} as never };
    }
    const row = find(resource, id);
    Object.assign(row, variables as object);
    if (resource === "projects") row.updatedAt = now();
    return { data: await out(resource, row) };
  },

  deleteOne: async ({ resource, id, meta }) => {
    if (resource === "comment-replies") {
      // The first message is the thread: deleting it deletes the thread, as in the core.
      const thread = threadOf(meta);
      const { email } = await signedIn();
      if (thread.id === String(id)) {
        ownMessage(thread, email);
        store.comments.splice(store.comments.indexOf(thread as never), 1);
        return { data: {} as never };
      }
      const reply = thread.replies.find((r) => r.id === String(id));
      if (reply === undefined) throw notFound(resource, id);
      ownMessage(reply, email);
      thread.replies.splice(thread.replies.indexOf(reply), 1);
      return { data: {} as never };
    }
    const rows = table(resource);
    const row = find(resource, id);
    rows.splice(rows.indexOf(row), 1);
    // A project deleted for good takes its screenplay and documents with it, as the core does.
    if (resource === "projects") {
      for (const name of STORY_PARTS)
        store[name] = store[name].filter((r) => r.projectId !== row.id);
    }
    return { data: await out(resource, row) };
  },

  custom: async () => {
    throw new Error(FIXTURES_UNAVAILABLE);
  },
};

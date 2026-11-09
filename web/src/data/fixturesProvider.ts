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
import { plainDoc, stripMarks, type ScreenplayDoc } from "@/editor/document.ts";

import { FIXTURES, type FixtureMessage, type FixtureThread } from "./fixtures";
import type {
  CommentThread,
  Entity,
  NewDraft,
  NewNote,
  NewReply,
  NewThread,
  Point,
  Project,
  Script,
  VersionPart,
  VersionReason,
  VersionTarget,
} from "./model";
import type { SaveOperation } from "./saves";
import type { SearchOperation } from "./search";

// Data source `fixtures` (openspec/specs/web/workspace, «Источник данных»): sample data of
// mockup v2 in page memory, reset on reload. It behaves as the core where screens rely on it
// (a story comes with its first draft, a draft is an independent copy made by the source, the
// present state is kept before a rollback, a message is the signed-in user's own by e-mail). Anything this provider does not support is an error naming
// it, never an empty result.

type Row = BaseRecord & { id: string };
const RESOURCES = [
  "projects",
  "scripts",
  "characters",
  "locations",
  "worlds",
  "notes",
  "comments",
  "suggestions",
  "drafts",
  "versions",
  "points",
] as const;
type Resource = (typeof RESOURCES)[number];

const store = {
  ...structuredClone(FIXTURES),
  versions: [],
  points: [],
} as unknown as Record<Resource, Row[]>;

/** Import and chat files need the core (design of story-data-web, decision 7). */
/** Search of a story needs the core (design of project-search, decision 6). */
export const FIXTURES_NO_SEARCH =
  "Поиск по истории работает только с источником данных api.";

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

const CARDS = ["characters", "locations", "worlds"] as const;

/** A draft of the story is a copy: the fresh rows of `draftId`, without review and history. */
function copyDraft(base: string, draftId: string): void {
  const script = find("scripts", base) as unknown as Script;
  store.scripts.push({
    ...structuredClone(script),
    id: draftId,
    draftId,
    text: stripMarks(script.text, ["comment", "suggestion"]),
  } as unknown as Row);
  for (const resource of CARDS)
    for (const row of [...store[resource]].filter(
      (r) => r.draftId === base && r.deletedAt === null,
    ))
      store[resource].push({
        ...structuredClone(row),
        id: `${draftId}-${row.id}`,
        draftId,
      });
}

/** The drafts opened last, by story: the only user of this source is the signed-in one. */
const opened = new Map<string, string>();
/** ISO time of the last change of a draft. */
const changed = new Map<string, string>();

function openDraftId(projectId: string): string {
  const live = store.drafts.filter(
    (d) => d.projectId === projectId && d.deletedAt === null,
  );
  const last = live.find((d) => d.id === opened.get(projectId));
  if (last !== undefined) return last.id;
  const stamp = (d: Row) => changed.get(d.id) ?? String(d.createdAt);
  const latest = [...live].sort((a, b) => stamp(b).localeCompare(stamp(a)))[0];
  if (latest === undefined)
    throw new Error(`У истории ${projectId} нет драфтов.`);
  return latest.id;
}

/** What a snapshot shows of a card or of the passport, in the shape of the core. */
function fieldsContent(resource: string, row: Row): Record<string, unknown> {
  if (resource === "scripts") {
    const s = row as unknown as Script;
    return {
      name: "Сценарий",
      role: null,
      summary: "",
      fields: {
        logline: s.logline,
        synopsis: s.synopsis,
        title_page: s.titlePage,
      },
    };
  }
  const x = row as unknown as Entity;
  return {
    name: x.name,
    role: "role" in x ? x.role : null,
    summary: x.one,
    fields: { description: x.long, ...x.ext },
  };
}

const TEN_MINUTES = 10 * 60 * 1000;

/** Keeps a part of a record as it stands: always with a reason, else when the last is old. */
async function keep(
  resource: string,
  row: Row,
  part: VersionPart,
  reason: VersionReason | null,
): Promise<void> {
  const owner = resource === "scripts" ? "draftId" : "documentId";
  const rows = store.versions.filter(
    (v) => v[owner] === row.id && v.part === part,
  );
  const last = rows.at(-1);
  if (
    reason === null &&
    last !== undefined &&
    Date.now() - Date.parse(String(last.savedAt)) < TEN_MINUTES
  )
    return;
  const { name } = await signedIn();
  store.versions.push({
    id: crypto.randomUUID(),
    [owner]: row.id,
    resource,
    part,
    reason: reason ?? "auto",
    savedByName: name,
    savedAt: now(),
    content:
      part === "text"
        ? (structuredClone(row.text) as ScreenplayDoc)
        : fieldsContent(resource, row),
    saved: structuredClone(row),
  });
}

/** The parts of a record a change touches, kept before it is applied. */
async function keepChanged(resource: string, row: Row, values: object) {
  if (resource === "scripts") {
    if ("text" in values) await keep(resource, row, "text", null);
    if (Object.keys(values).some((k) => k !== "text"))
      await keep(resource, row, "fields", null);
  } else if ((CARDS as readonly string[]).includes(resource)) {
    if (!("deletedAt" in values)) await keep(resource, row, "fields", null);
  }
  const draftId = resource === "scripts" ? row.id : row.draftId;
  if (typeof draftId === "string") changed.set(draftId, now());
}

function restoreVersion(id: string, target: VersionTarget): void {
  const version = find("versions", id);
  const resource = String(version.resource);
  const row = find(
    resource,
    "draftId" in target ? target.draftId : target.documentId,
  );
  const saved = structuredClone(version.saved) as Row;
  if (target.part === "text") row.text = saved.text;
  else Object.assign(row, saved, { text: row.text });
}

async function savePoint(
  draftId: string,
  name: string,
  kind: Point["kind"],
): Promise<Row> {
  const { name: author } = await signedIn();
  const point: Row = {
    id: crypto.randomUUID(),
    draftId,
    name,
    kind,
    createdByName: author,
    createdAt: now(),
    saved: structuredClone({
      script: find("scripts", draftId),
      cards: CARDS.flatMap((resource) =>
        store[resource]
          .filter((r) => r.draftId === draftId && r.deletedAt === null)
          .map((row) => ({ resource, row })),
      ),
    }),
  };
  store.points.unshift(point);
  return point;
}

type SavedDraft = {
  script: Row;
  cards: { resource: (typeof CARDS)[number]; row: Row }[];
};

async function restorePoint(id: string): Promise<void> {
  const point = find("points", id);
  const draftId = String(point.draftId);
  await savePoint(draftId, `Перед откатом к «${String(point.name)}»`, "auto");
  const saved = structuredClone(point.saved) as SavedDraft;
  Object.assign(find("scripts", draftId), saved.script);
  const kept = new Set(saved.cards.map((c) => c.row.id));
  for (const resource of CARDS)
    for (const row of store[resource])
      if (row.draftId === draftId && !kept.has(row.id)) row.deletedAt = now();
  for (const { resource, row } of saved.cards) {
    const present = store[resource].find((r) => r.id === row.id);
    if (present === undefined) store[resource].push(row);
    else Object.assign(present, row);
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
  if (resource === "projects") {
    const project: Project = {
      ...(structuredClone(row) as unknown as Project),
      draftsCount: store.drafts.filter(
        (d) => d.projectId === row.id && d.deletedAt === null,
      ).length,
      openDraftId: openDraftId(row.id),
    };
    return project as unknown as T;
  }
  if (resource !== "comments") return structuredClone(row) as unknown as T;
  const { email } = await signedIn();
  const t = row as unknown as FixtureThread;
  const own = (m: FixtureMessage) => {
    const { email: author, ...rest } = m;
    return { ...rest, kind: "user" as const, own: author === email };
  };
  const thread: CommentThread = {
    ...own(t),
    draftId: t.draftId,
    quote: t.quote,
    sceneUid: null,
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

const DRAFT_PARTS = [
  "scripts",
  "characters",
  "locations",
  "worlds",
  "comments",
  "suggestions",
  "versions",
  "points",
] as const;

function deleteDraft(draftId: string): void {
  store.drafts = store.drafts.filter((d) => d.id !== draftId);
  for (const name of DRAFT_PARTS)
    store[name] = store[name].filter(
      (r) => r.draftId !== draftId && r.id !== draftId,
    );
}

export const fixturesProvider: DataProvider = {
  getApiUrl: () => {
    throw new Error("У источника fixtures нет адреса API.");
  },

  getList: async ({ resource, filters = [], sorters = [], pagination }) => {
    checkPagination(pagination);
    let rows = table(resource).filter((row) =>
      filters.every((f) => matches(row, f)),
    );
    if (resource === "versions") rows = [...rows].reverse();
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
      // A story comes with its first draft and screenplay, as in the core.
      const project = variables as Pick<Project, "title" | "desc">;
      row = {
        id: crypto.randomUUID(),
        title: project.title,
        desc: project.desc,
        cover: false,
        updatedAt: now(),
        deletedAt: null,
      };
      const draftId = crypto.randomUUID();
      store.drafts.push({
        id: draftId,
        projectId: row.id,
        name: "Драфт 1",
        locked: false,
        forkedFromName: null,
        createdAt: now(),
        deletedAt: null,
      });
      const script: Script = {
        id: draftId,
        draftId,
        logline: "",
        show: {
          title: true,
          logline: true,
          synopsis: true,
          treatment: true,
          text: true,
        },
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
      store.projects.push(row);
      return {
        data: { ...(await out<Project>("projects", row)), draftId } as never,
      };
    } else if (resource === "comments") {
      const values = variables as NewThread;
      row = {
        ...(await message(values.text)),
        id: values.id,
        draftId: values.draftId,
        quote: values.quote,
        replies: [],
        resolved: false,
      };
    } else if (resource === "drafts") {
      const values = variables as NewDraft;
      const base = find("drafts", values.baseId);
      row = {
        id: crypto.randomUUID(),
        projectId: values.projectId,
        name: values.name,
        locked: false,
        forkedFromName: base.name,
        createdAt: now(),
        deletedAt: null,
      };
      copyDraft(base.id, row.id);
    } else if (resource === "notes") {
      const values = variables as NewNote;
      row = {
        id: crypto.randomUUID(),
        projectId: values.projectId,
        title: values.title,
        body: "",
        deletedAt: null,
      };
    } else if (resource === "points") {
      const values = variables as Pick<Point, "draftId" | "name">;
      return {
        data: (await savePoint(values.draftId, values.name, "manual")) as never,
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
    await keepChanged(resource, row, variables as object);
    if (
      resource === "suggestions" &&
      (variables as { status?: string }).status === "accepted"
    )
      await keep(
        "scripts",
        find("scripts", String(row.draftId)),
        "text",
        "suggestion",
      );
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
    // A story or a draft deleted for good takes its contents with it, as the core does.
    if (resource === "drafts") {
      deleteDraft(row.id);
      return { data: await out(resource, row) };
    }
    const data = await out(resource, row);
    rows.splice(rows.indexOf(row), 1);
    if (resource === "projects") {
      for (const draft of store.drafts.filter((d) => d.projectId === row.id))
        deleteDraft(draft.id);
      store.notes = store.notes.filter((n) => n.projectId !== row.id);
    }
    return { data: data as never };
  },

  custom: async ({ meta, payload }) => {
    const op = { operation: meta?.operation, payload } as
      SaveOperation | SearchOperation;
    switch (op.operation) {
      case "openDraft": {
        const draft = find("drafts", op.payload.draftId);
        opened.set(String(draft.projectId), draft.id);
        break;
      }
      case "restoreVersion": {
        const version = find("versions", op.payload.id);
        await keep(
          String(version.resource),
          find(
            String(version.resource),
            "draftId" in op.payload.target
              ? op.payload.target.draftId
              : op.payload.target.documentId,
          ),
          op.payload.target.part,
          "restore",
        );
        restoreVersion(op.payload.id, op.payload.target);
        break;
      }
      case "restorePoint":
        await restorePoint(op.payload.id);
        break;
      case "search":
        throw new Error(FIXTURES_NO_SEARCH);
      default:
        throw new Error(FIXTURES_UNAVAILABLE);
    }
    return { data: {} as never };
  },
};

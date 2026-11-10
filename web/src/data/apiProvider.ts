import type {
  BaseRecord,
  CrudFilter,
  CrudSort,
  DataProvider,
  MetaQuery,
  Pagination,
} from "@refinedev/core";

import type { ScreenplayDoc } from "@/editor/document.ts";

import {
  apiBlob,
  apiRequest,
  HttpError,
  isConflict,
  type ApiRequest,
} from "./apiClient";
import type { FileOperation, UploadedFile } from "./files";
import type {
  Character,
  CommentMessage,
  CommentThread,
  Draft,
  Entity,
  EntityKind,
  Location,
  NewDraft,
  NewNote,
  NewProject,
  NewReply,
  NewThread,
  Note,
  NoteFile,
  Point,
  Project,
  Role,
  Script,
  StoryTemplate,
  Suggestion,
  TitlePage,
  Version,
  VersionContent,
  VersionTarget,
  World,
} from "./model";
import { isCoverColor, type CoverOperation } from "./model";
import type { SaveOperation } from "./saves";
import type {
  EntityHit,
  NoteHit,
  PartHit,
  SceneHit,
  SearchOperation,
  SearchResult,
  SearchSnippet,
} from "./search";
import type { Writing, WritingOperation } from "./writing";

// Data source `api` (openspec/specs/web/workspace, «Источник данных»; design of story-data-web,
// decisions 1, 2 and 7): the resources of the screens translated into the routes of the core.
// Revisions for `If-Match` live here, taken from the latest answers; screens never see them.
// A resource, filter or sort this source does not support is an error naming it, and an answer
// without a required field is an error describing it, never an empty value.

// --- answers of the core, checked field by field

type Json = Record<string, unknown>;

function shape(what: string, body: unknown): Json {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new Error(`Сервер вернул ${what} в неизвестном виде.`);
  return body as Json;
}

function list(what: string, body: unknown): unknown[] {
  if (!Array.isArray(body))
    throw new Error(`Сервер вернул ${what} не списком.`);
  return body;
}

function field<T>(
  what: string,
  o: Json,
  key: string,
  check: (v: unknown) => v is T,
): T {
  const value = o[key];
  if (!check(value))
    throw new Error(
      `Сервер вернул ${what} без поля «${key}» нужного вида: ${JSON.stringify(value)}.`,
    );
  return value;
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => Number.isInteger(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isTime = (v: unknown): v is string | null => v === null || isString(v);
const isCountOrNull = (v: unknown): v is number | null =>
  v === null || isNumber(v);
const isFlagOrNull = (v: unknown): v is boolean | null =>
  v === null || isBool(v);
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

/** An optional text field of a document: absent means not filled (openspec/specs/api/stories). */
function text(what: string, fields: Json, key: string): string {
  const value = fields[key];
  if (value === undefined) return "";
  if (!isString(value))
    throw new Error(`Сервер вернул ${what} с полем «${key}» не строкой.`);
  return value;
}

type Kind = "script" | "character" | "location" | "world" | "draft";
const KINDS: readonly string[] = ["script", "character", "location", "world"];
const ROLES: readonly string[] = ["main", "secondary", "episodic"];

type Doc = {
  id: string;
  draftId: string;
  kind: Kind;
  name: string;
  role: Role | null;
  summary: string;
  revision: number;
  fields: Json;
  createdAt: string;
  deletedAt: string | null;
};

function readDoc(body: unknown): Doc {
  const o = shape("документ", body);
  const what = "документ";
  const kind = field(what, o, "kind", isString);
  if (!KINDS.includes(kind))
    throw new Error(`Сервер вернул документ неизвестного вида «${kind}».`);
  const role = o.role;
  if (role !== null && !(isString(role) && ROLES.includes(role)))
    throw new Error(`Сервер вернул документ с ролью «${String(role)}».`);
  return {
    id: field(what, o, "id", isString),
    draftId: field(what, o, "draft_id", isString),
    kind: kind as Kind,
    name: field(what, o, "name", isString),
    role: role as Role | null,
    summary: field(what, o, "summary", isString),
    revision: field(what, o, "revision", isNumber),
    fields: field(what, o, "fields", isObject),
    createdAt: field(what, o, "created_at", isString),
    deletedAt: field(what, o, "deleted_at", isTime),
  };
}

type SavedProject = Omit<Project, "draftsCount" | "openDraftId">;

function readProject(body: unknown): SavedProject {
  const o = shape("историю", body);
  return {
    id: field("историю", o, "id", isString),
    title: field("историю", o, "title", isString),
    desc: field("историю", o, "description", isString),
    coverColor: field("историю", o, "cover_color", isCoverColor),
    updatedAt: field("историю", o, "updated_at", isString),
    deletedAt: field("историю", o, "deleted_at", isTime),
    wordGoal: field("историю", o, "word_goal", isCountOrNull),
    goalDeadline: field("историю", o, "goal_deadline", isTime),
  };
}

/** A story of the list, which alone tells its drafts for the caller. */
function readListedProject(body: unknown): Project {
  const o = shape("историю", body);
  return {
    ...readProject(o),
    draftsCount: field("историю", o, "drafts_count", isNumber),
    openDraftId: field("историю", o, "open_draft_id", isString),
  };
}

/** The writing statistics of a draft (openspec/specs/api/writing). */
function readWriting(body: unknown): Writing {
  const what = "статистику письма";
  const o = shape(what, body);
  const story = shape(what, field(what, o, "story", isObject));
  return {
    today: field(what, o, "today", isString),
    dailyGoal: field(what, o, "daily_goal", isCountOrNull),
    days: field(what, o, "days", isArray).map((item) => {
      const d = shape(what, item);
      return {
        date: field(what, d, "date", isString),
        words: field(what, d, "words", isCountOrNull),
        met: field(what, d, "met", isFlagOrNull),
      };
    }),
    story: {
      words: field(what, story, "words", isNumber),
      goal: field(what, story, "goal", isCountOrNull),
      deadline: field(what, story, "deadline", isTime),
      daysLeft: field(what, story, "days_left", isCountOrNull),
      perDay: field(what, story, "per_day", isCountOrNull),
    },
  };
}

function readDraft(body: unknown): Draft {
  const o = shape("драфт", body);
  const from = o.forked_from_name;
  if (from !== null && !isString(from))
    throw new Error("Сервер вернул драфт с неверным полем «forked_from_name».");
  return {
    id: field("драфт", o, "id", isString),
    projectId: field("драфт", o, "project_id", isString),
    name: field("драфт", o, "name", isString),
    locked: field("драфт", o, "locked", isBool),
    forkedFromName: from,
    createdAt: field("драфт", o, "created_at", isString),
    deletedAt: field("драфт", o, "deleted_at", isTime),
  };
}

function readVersion(body: unknown): Version {
  const o = shape("снимок", body);
  return {
    id: field("снимок", o, "id", isString),
    part: field("снимок", o, "part", isString) as Version["part"],
    reason: field("снимок", o, "reason", isString) as Version["reason"],
    savedByName: field("снимок", o, "saved_by_name", isString),
    savedAt: field("снимок", o, "saved_at", isString),
  };
}

function readPoint(body: unknown): Point {
  const o = shape("точку драфта", body);
  return {
    id: field("точку драфта", o, "id", isString),
    draftId: field("точку драфта", o, "draft_id", isString),
    name: field("точку драфта", o, "name", isString),
    kind: field("точку драфта", o, "kind", isString) as Point["kind"],
    createdByName: field("точку драфта", o, "created_by_name", isString),
    createdAt: field("точку драфта", o, "created_at", isString),
  };
}

type Text = { documentId: string; content: ScreenplayDoc; revision: number };

function readText(body: unknown): Text {
  const o = shape("текст", body);
  const content = field("текст", o, "content", isObject);
  if (content.type !== "doc" || !isArray(content.content))
    throw new Error("Сервер вернул текст не документом редактора.");
  return {
    documentId: field("текст", o, "document_id", isString),
    content: content as ScreenplayDoc,
    revision: field("текст", o, "revision", isNumber),
  };
}

// --- revisions (design, decision 2) and writes of one document in turn

const revisions = new Map<string, number>();
const docKey = (id: string) => `doc:${id}`;
const textKey = (id: string) => `text:${id}`;
const noteKey = (id: string) => `note:${id}`;

/** Revisions only grow: an answer of a read that started before a save never lowers them. */
function remember(key: string, revision: number): void {
  revisions.set(key, Math.max(revisions.get(key) ?? 0, revision));
}

function revisionOf(key: string): number {
  const revision = revisions.get(key);
  if (revision === undefined)
    throw new Error(
      `Ревизия ${key} неизвестна: документ ещё не прочитан этим окном.`,
    );
  return revision;
}

// A save waits for the previous save of the same document, so it is based on its revision.
const queues = new Map<string, Promise<unknown>>();
function inTurn<T>(key: string, write: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(write, write);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

async function request(path: string, init?: ApiRequest): Promise<unknown> {
  return (await apiRequest(path, init)).body;
}

/**
 * A change based on the revision of `key`. When the core refuses it as outdated (409), the
 * revision is forgotten: the next read («Открыть свежую версию») sets the one of the core.
 */
async function revised(
  key: string,
  path: string,
  init: Omit<ApiRequest, "revision">,
): Promise<unknown> {
  try {
    return await request(path, { ...init, revision: revisionOf(key) });
  } catch (e) {
    if (isConflict(e)) revisions.delete(key);
    throw e;
  }
}

// --- the tree of a draft: one request for all resources that read it at once

const trees = new Map<string, Promise<Doc[]>>();
/** Draft id → id of its screenplay document. */
const scripts = new Map<string, string>();

function tree(draftId: string): Promise<Doc[]> {
  const running = trees.get(draftId);
  if (running !== undefined) return running;
  const load = (async () => {
    const docs = list(
      "документы драфта",
      await request(`/drafts/${draftId}/documents`),
    ).map(readDoc);
    for (const d of docs) remember(docKey(d.id), d.revision);
    const script = docs.filter((d) => d.kind === "script");
    if (script.length !== 1)
      throw new Error(
        `У драфта ${draftId} ${script.length} сценариев, а должен быть один.`,
      );
    scripts.set(draftId, script[0].id);
    return docs;
  })();
  trees.set(draftId, load);
  // Only requests that run at the same time share the answer; the next read asks again.
  void load.then(
    () => trees.delete(draftId),
    () => trees.delete(draftId),
  );
  return load;
}

async function scriptId(draftId: string): Promise<string> {
  const known = scripts.get(draftId);
  if (known !== undefined) return known;
  await tree(draftId);
  return scripts.get(draftId)!;
}

async function readTextOf(documentId: string): Promise<Text> {
  const t = readText(await request(`/documents/${documentId}/text`));
  remember(textKey(documentId), t.revision);
  return t;
}

async function readDocument(documentId: string): Promise<Doc> {
  const d = readDoc(await request(`/documents/${documentId}`));
  remember(docKey(d.id), d.revision);
  return d;
}

async function patchDocument(documentId: string, changes: Json): Promise<Doc> {
  return inTurn(docKey(documentId), async () => {
    const d = readDoc(
      await revised(docKey(documentId), `/documents/${documentId}`, {
        method: "PATCH",
        json: changes,
      }),
    );
    remember(docKey(d.id), d.revision);
    return d;
  });
}

async function putText(documentId: string, content: ScreenplayDoc) {
  return inTurn(textKey(documentId), async () => {
    const t = readText(
      await revised(textKey(documentId), `/documents/${documentId}/text`, {
        method: "PUT",
        json: content,
      }),
    );
    remember(textKey(documentId), t.revision);
    return t;
  });
}

/** A note of an answer; its revision stays here. */
function readNote(body: unknown): Note {
  const o = shape("заметку", body);
  const id = field("заметку", o, "id", isString);
  remember(noteKey(id), field("заметку", o, "revision", isNumber));
  return {
    id,
    projectId: field("заметку", o, "project_id", isString),
    title: field("заметку", o, "title", isString),
    body: field("заметку", o, "body", isString),
    deletedAt: field("заметку", o, "deleted_at", isTime),
    file: o.file === null ? null : readNoteFile(o.file),
  };
}

function readNoteFile(body: unknown): NoteFile {
  const what = "оригинал заметки";
  const o = shape(what, body);
  return {
    id: field(what, o, "id", isString),
    name: field(what, o, "name", isString),
    mediaType: field(what, o, "media_type", isString),
    sizeBytes: field(what, o, "size_bytes", isNumber),
  };
}

async function patchNote(id: string, changes: Json): Promise<Note> {
  for (const key of Object.keys(changes))
    if (key !== "title" && key !== "body")
      throw new Error(`Источник api не меняет поле «${key}» заметки.`);
  return inTurn(noteKey(id), async () =>
    readNote(
      await revised(noteKey(id), `/notes/${id}`, {
        method: "PATCH",
        json: changes,
      }),
    ),
  );
}

async function moveToTrash(path: string, inTrash: boolean): Promise<unknown> {
  return request(`${path}/${inTrash ? "trash" : "restore"}`, {
    method: "POST",
  });
}

// --- records of the screens

const ENTITY_KIND = {
  characters: "character",
  locations: "location",
  worlds: "world",
} as const;
type EntityResource = keyof typeof ENTITY_KIND;
const isEntityResource = (r: string): r is EntityResource => r in ENTITY_KIND;

// Fields of a document kept apart from the profile (`ext`) of the screens.
const OWN_FIELDS = new Set(["description", "age", "gender", "overview"]);
const GENDERS: readonly string[] = ["", "f", "m", "o"];

function toEntity(d: Doc): Entity {
  const what = `документ «${d.name}»`;
  const ext: Record<string, string> = {};
  for (const [key, value] of Object.entries(d.fields)) {
    if (OWN_FIELDS.has(key)) continue;
    if (!isString(value))
      throw new Error(`Сервер вернул ${what} с полем «${key}» не строкой.`);
    ext[key] = value;
  }
  const base = {
    id: d.id,
    draftId: d.draftId,
    name: d.name,
    one: d.summary,
    long: text(what, d.fields, "description"),
    ext,
    deletedAt: d.deletedAt,
  };
  if (d.kind === "world")
    return { ...base, overview: text(what, d.fields, "overview") } as World;
  if (d.role === null) throw new Error(`Сервер вернул ${what} без роли.`);
  if (d.kind === "location") return { ...base, role: d.role } as Location;
  const gender = text(what, d.fields, "gender");
  if (!GENDERS.includes(gender))
    throw new Error(`Сервер вернул ${what} с полом «${gender}».`);
  return {
    ...base,
    role: d.role,
    age: text(what, d.fields, "age"),
    gender,
  } as Character;
}

/** Changes of the screens' entity fields as a PATCH of the document; "" removes a field. */
function entityChanges(values: Partial<Character & World>): Json {
  const changes: Json = {};
  const fields: Json = {};
  const unset = (v: string) => (v === "" ? null : v);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    switch (key) {
      case "name":
      case "role":
        changes[key] = value;
        break;
      case "one":
        changes.summary = value;
        break;
      case "long":
        fields.description = unset(value as string);
        break;
      case "age":
      case "gender":
      case "overview":
        fields[key] = unset(value as string);
        break;
      case "ext":
        for (const [k, v] of Object.entries(value as Record<string, string>))
          fields[k] = unset(v);
        break;
      default:
        throw new Error(`Источник api не меняет поле «${key}» документа.`);
    }
  }
  if (Object.keys(fields).length > 0) changes.fields = fields;
  return changes;
}

const ALL_PARTS: Script["show"] = {
  title: true,
  logline: true,
  synopsis: true,
  treatment: true,
  text: true,
};

function toScript(draftId: string, d: Doc, t: Text): Script {
  const what = "сценарий";
  const show = d.fields.show;
  const page = d.fields.title_page;
  if (show !== undefined && !isObject(show))
    throw new Error("Сервер вернул сценарий с «show» не объектом.");
  if (page !== undefined && !isObject(page))
    throw new Error("Сервер вернул сценарий с «title_page» не объектом.");
  const pageText = (key: keyof TitlePage) =>
    page === undefined ? "" : text("титульную страницу", page, key);
  return {
    id: draftId,
    draftId,
    documentId: d.id,
    logline: text(what, d.fields, "logline"),
    // Not set yet: every part is shown, as in a new story of the screens.
    show: show === undefined ? ALL_PARTS : (show as Script["show"]),
    titlePage: {
      title: pageText("title"),
      genre: pageText("genre"),
      author: pageText("author"),
      contacts: pageText("contacts"),
      place: pageText("place"),
    },
    synopsis: text(what, d.fields, "synopsis"),
    text: t.content,
  };
}

function scriptChanges(values: Partial<Script>): {
  doc: Json;
  text: ScreenplayDoc | null;
} {
  const doc: Json = {};
  const fields: Json = {};
  let content: ScreenplayDoc | null = null;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    switch (key) {
      case "logline":
      case "synopsis":
      case "show":
        fields[key] = value;
        break;
      case "titlePage":
        fields.title_page = value;
        break;
      case "text":
        content = value as ScreenplayDoc;
        break;
      default:
        throw new Error(`Источник api не меняет поле «${key}» сценария.`);
    }
  }
  if (Object.keys(fields).length > 0) doc.fields = fields;
  return { doc, text: content };
}

/** Thread id → id of its first message, which the screens know by the thread id. */
const firstMessages = new Map<string, string>();

function isAuthorKind(value: unknown): value is CommentMessage["kind"] {
  return value === "user" || value === "coauthor";
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function toMessage(body: unknown): CommentMessage {
  const o = shape("сообщение комментария", body);
  const what = "сообщение комментария";
  return {
    id: field(what, o, "id", isString),
    author: field(what, o, "author_name", isString),
    kind: field(what, o, "author_kind", isAuthorKind),
    own: field(what, o, "own", isBool),
    role: field(what, o, "author_role", isString),
    at: field(what, o, "created_at", isString),
    text: field(what, o, "body", isString),
  };
}

function toThread(draftId: string, body: unknown): CommentThread {
  const o = shape("ветку комментария", body);
  const what = "ветку комментария";
  const id = field(what, o, "id", isString);
  const [first, ...replies] = field(what, o, "messages", isArray).map(
    toMessage,
  );
  if (first === undefined)
    throw new Error(`Сервер вернул ветку ${id} без сообщений.`);
  firstMessages.set(id, first.id);
  return {
    ...first,
    id,
    draftId,
    quote: field(what, o, "quote", isString),
    sceneUid: field(what, o, "scene_uid", isStringOrNull),
    resolved: field(what, o, "resolved_at", isTime) !== null,
    replies,
  };
}

const STATUSES: readonly string[] = ["open", "accepted", "rejected"];

function toSuggestion(draftId: string, body: unknown): Suggestion {
  const o = shape("предложение соавтора", body);
  const what = "предложение соавтора";
  const status = field(what, o, "status", isString);
  if (!STATUSES.includes(status))
    throw new Error(`Сервер вернул предложение со статусом «${status}».`);
  return {
    id: field(what, o, "id", isString),
    draftId,
    sceneUid: field(what, o, "scene_uid", isString),
    quote: field(what, o, "quote", isString),
    at: field(what, o, "created_at", isString),
    why: field(what, o, "why", isString),
    text: field(what, o, "text", isString),
    status: status as Suggestion["status"],
    decidedAt: field(what, o, "decided_at", isTime),
  };
}

// --- filters and sorting of the screens' lists

type Query = {
  projectId: string | null;
  draftId: string | null;
  documentId: string | null;
  part: string | null;
  deleted: boolean | null;
};

const EQUAL_FILTERS = ["projectId", "draftId", "documentId", "part"] as const;

function query(resource: string, filters: CrudFilter[]): Query {
  const q: Query = {
    projectId: null,
    draftId: null,
    documentId: null,
    part: null,
    deleted: null,
  };
  for (const f of filters) {
    if (!("field" in f))
      throw new Error(
        `Источник api не поддерживает составной фильтр «${f.operator}».`,
      );
    const equal = EQUAL_FILTERS.find((name) => name === f.field);
    if (equal !== undefined && f.operator === "eq") q[equal] = String(f.value);
    else if (f.field === "deletedAt" && f.operator === "null")
      q.deleted = false;
    else if (f.field === "deletedAt" && f.operator === "nnull")
      q.deleted = true;
    else
      throw new Error(
        `Источник api не поддерживает фильтр «${f.field} ${f.operator}» ресурса «${resource}».`,
      );
  }
  return q;
}

function needDraft(resource: string, q: Query): string {
  if (q.draftId === null)
    throw new Error(`Список «${resource}» читается только по драфту.`);
  return q.draftId;
}

/** The document of a history: a card by its id, the screenplay by its draft. */
async function versionDocument(q: {
  draftId?: string | null;
  documentId?: string | null;
}): Promise<string> {
  if (q.documentId !== null && q.documentId !== undefined) return q.documentId;
  if (q.draftId !== null && q.draftId !== undefined) return scriptId(q.draftId);
  throw new Error("История сохранений читается по документу или драфту.");
}

function sorted<T extends BaseRecord>(rows: T[], sorters: CrudSort[]): T[] {
  let out = rows;
  for (const sorter of [...sorters].reverse()) {
    out = [...out].sort((a, b) => {
      const x: unknown = a[sorter.field];
      const y: unknown = b[sorter.field];
      if (typeof x !== "string" || typeof y !== "string")
        throw new Error(
          `Источник api сортирует только строки, поле «${sorter.field}».`,
        );
      const order = x.localeCompare(y, "ru");
      return sorter.order === "desc" ? -order : order;
    });
  }
  return out;
}

function checkPagination(pagination: Pagination | undefined): void {
  if (pagination?.mode !== "off")
    throw new Error(
      `Источник api отдаёт списки целиком: нужен pagination.mode = "off", получено «${String(pagination?.mode)}».`,
    );
}

function unsupported(resource: string, action: string): Error {
  return new Error(
    `Источник api не умеет «${action}» для ресурса «${resource}».`,
  );
}

function threadOf(meta: MetaQuery | undefined): string {
  const id: unknown = meta?.threadId;
  if (typeof id !== "string")
    throw new Error("Ответу комментария нужен meta.threadId.");
  return id;
}

/** The id of a message for the core; the screens know the first one by the thread id. */
function messageId(threadId: string, id: string): string {
  if (id !== threadId) return id;
  const first = firstMessages.get(threadId);
  if (first === undefined)
    throw new Error(`Ветка ${threadId} ещё не прочитана этим окном.`);
  return first;
}

async function projects(trash: boolean): Promise<Project[]> {
  return list(
    "истории",
    await request("/projects", { query: { trash: String(trash) } }),
  ).map(readListedProject);
}

function readTemplate(raw: unknown): StoryTemplate {
  const what = "каркас истории";
  const o = shape(what, raw);
  return {
    id: field(what, o, "id", isString),
    name: field(what, o, "name", isString),
    description: field(what, o, "description", isString),
    acts: field(what, o, "acts", isArray).map((rawAct) => {
      const act = shape("акт каркаса", rawAct);
      return {
        name: field("акт каркаса", act, "name", isString),
        points: field("акт каркаса", act, "points", isArray).map((rawPoint) => {
          const point = shape("точку каркаса", rawPoint);
          return {
            name: field("точку каркаса", point, "name", isString),
            hint: field("точку каркаса", point, "hint", isString),
          };
        }),
      };
    }),
  };
}

async function getList(
  resource: string,
  filters: CrudFilter[],
): Promise<BaseRecord[]> {
  const q = query(resource, filters);
  if (resource === "projects") {
    if (q.deleted === null || q.projectId !== null)
      throw new Error("Истории читаются списком полки или корзины.");
    return projects(q.deleted);
  }
  if (resource === "story-templates")
    return list("каркасы историй", await request("/story-templates")).map(
      readTemplate,
    );
  if (resource === "drafts") {
    if (q.projectId === null)
      throw new Error("Драфты читаются только по истории.");
    return list("драфты", await request(`/projects/${q.projectId}/drafts`))
      .map(readDraft)
      .filter(
        (d) => q.deleted === null || (d.deletedAt !== null) === q.deleted,
      );
  }
  if (resource === "notes") {
    if (q.projectId === null)
      throw new Error("Заметки читаются только по истории.");
    return list("заметки", await request(`/projects/${q.projectId}/notes`))
      .map(readNote)
      .filter(
        (n) => q.deleted === null || (n.deletedAt !== null) === q.deleted,
      );
  }
  if (resource === "versions") {
    if (q.part === null)
      throw new Error("История сохранений читается по части документа.");
    const documentId = await versionDocument(q);
    return list(
      "снимки",
      await request(`/documents/${documentId}/versions`, {
        query: { part: q.part },
      }),
    ).map(readVersion);
  }
  const draftId = needDraft(resource, q);
  if (resource === "points")
    return list("точки драфта", await request(`/drafts/${draftId}/points`)).map(
      readPoint,
    );
  if (isEntityResource(resource)) {
    const docs = await tree(draftId);
    return docs
      .filter(
        (d) =>
          d.kind === ENTITY_KIND[resource] &&
          (q.deleted === null || (d.deletedAt !== null) === q.deleted),
      )
      .map(toEntity);
  }
  if (q.deleted !== null)
    throw new Error(`У ресурса «${resource}» нет корзины.`);
  const sid = await scriptId(draftId);
  if (resource === "comments")
    return list("комментарии", await request(`/documents/${sid}/comments`)).map(
      (t) => toThread(draftId, t),
    );
  if (resource === "suggestions")
    return list(
      "предложения соавтора",
      await request(`/documents/${sid}/suggestions`),
    ).map((s) => toSuggestion(draftId, s));
  throw unsupported(resource, "список");
}

async function getOne(resource: string, id: string): Promise<BaseRecord> {
  if (resource === "projects") {
    // The core lists stories: the shelf and the trash together hold every story of the caller.
    const found =
      (await projects(false)).find((p) => p.id === id) ??
      (await projects(true)).find((p) => p.id === id);
    if (found === undefined) throw new HttpError("История не найдена.", 404);
    return found;
  }
  if (resource === "scripts") {
    const docs = await tree(id);
    const d = docs.find((x) => x.kind === "script")!;
    return toScript(id, d, await readTextOf(d.id));
  }
  if (isEntityResource(resource)) {
    const d = await readDocument(id);
    if (d.kind !== ENTITY_KIND[resource])
      throw new HttpError("Документ не найден.", 404);
    return toEntity(d);
  }
  if (resource === "versions") {
    const body = await request(`/versions/${id}`);
    const version: VersionContent = {
      ...readVersion(body),
      content: field("снимок", shape("снимок", body), "content", isObject),
    };
    return version;
  }
  throw unsupported(resource, "запись");
}

async function create(
  resource: string,
  variables: unknown,
  meta: MetaQuery | undefined,
): Promise<BaseRecord> {
  if (resource === "projects") {
    const values = variables as NewProject;
    const o = shape(
      "новую историю",
      await request("/projects", {
        method: "POST",
        json: {
          title: values.title,
          description: values.desc,
          cover_color: values.coverColor,
          ...(values.template === undefined
            ? {}
            : { template: values.template }),
        },
      }),
    );
    const project = readProject(o.project);
    const draftId = field("новую историю", o, "draft_id", isString);
    field("новую историю", o, "script_id", isString);
    // The screens fill the title page next: read the tree for the revision of the screenplay.
    await tree(draftId);
    return { ...project, draftId };
  }
  if (isEntityResource(resource)) {
    const { draftId, deletedAt, ...values } = variables as Omit<
      Character & World,
      "id"
    >;
    if (deletedAt !== null)
      throw new Error("Новый документ не создаётся сразу в корзине.");
    const { name, role, summary, fields } = entityChanges(values);
    const body = list(
      "новые документы",
      await request(`/drafts/${draftId}/documents`, {
        method: "POST",
        json: {
          kind: ENTITY_KIND[resource],
          name,
          ...(resource === "worlds" ? {} : { role }),
          summary: summary ?? "",
          // A new document has nothing to remove: unset fields are left out.
          fields: Object.fromEntries(
            Object.entries((fields ?? {}) as Json).filter(
              ([, v]) => v !== null,
            ),
          ),
        },
      }),
    );
    const d = readDoc(body[0]);
    remember(docKey(d.id), d.revision);
    return toEntity(d);
  }
  if (resource === "drafts") {
    const values = variables as NewDraft;
    return readDraft(
      await request(`/projects/${values.projectId}/drafts`, {
        method: "POST",
        json: { name: values.name, base_id: values.baseId },
      }),
    );
  }
  if (resource === "notes") {
    const values = variables as NewNote;
    return readNote(
      await request(`/projects/${values.projectId}/notes`, {
        method: "POST",
        json: { title: values.title },
      }),
    );
  }
  if (resource === "points") {
    const values = variables as Pick<Point, "draftId" | "name">;
    return readPoint(
      await request(`/drafts/${values.draftId}/points`, {
        method: "POST",
        json: { name: values.name },
      }),
    );
  }
  if (resource === "comments") {
    const values = variables as NewThread;
    const sid = await scriptId(values.draftId);
    return toThread(
      values.draftId,
      await request(`/documents/${sid}/comments`, {
        method: "POST",
        json: { id: values.id, quote: values.quote, body: values.text },
      }),
    );
  }
  if (resource === "comment-replies") {
    const threadId = threadOf(meta);
    const values = variables as NewReply;
    const thread = shape(
      "ветку комментария",
      await request(`/comments/${threadId}/replies`, {
        method: "POST",
        json: { body: values.text },
      }),
    );
    const messages = field("ветку комментария", thread, "messages", isArray);
    return toMessage(messages.at(-1));
  }
  throw unsupported(resource, "создание");
}

/** Moves to the trash and back (`deletedAt`) are their own routes, never mixed with edits. */
function trashMove(resource: string, values: Json): boolean | null {
  if (!("deletedAt" in values)) return null;
  if (Object.keys(values).length !== 1)
    throw new Error(
      `Ресурс «${resource}»: корзина меняется отдельно от других полей.`,
    );
  return values.deletedAt !== null;
}

async function update(
  resource: string,
  id: string,
  variables: unknown,
  meta: MetaQuery | undefined,
): Promise<BaseRecord> {
  const values = variables as Json;
  const toTrash = trashMove(resource, values);
  if (resource === "projects") {
    if (toTrash !== null) {
      await moveToTrash(`/projects/${id}`, toTrash);
      return { id, ...values };
    }
    const changes: Json = {};
    for (const [key, value] of Object.entries(values)) {
      if (key === "title") changes.title = value;
      else if (key === "desc") changes.description = value;
      else if (key === "wordGoal") changes.word_goal = value;
      else if (key === "goalDeadline") changes.goal_deadline = value;
      else if (key === "coverColor") changes.cover_color = value;
      else throw new Error(`Источник api не меняет поле «${key}» истории.`);
    }
    await request(`/projects/${id}`, { method: "PATCH", json: changes });
    return { id, ...values };
  }
  if (resource === "scripts") {
    const sid = await scriptId(id);
    const { doc, text: content } = scriptChanges(values as Partial<Script>);
    if (Object.keys(doc).length > 0) await patchDocument(sid, doc);
    if (content !== null) await putText(sid, content);
    return { id, ...values };
  }
  if (isEntityResource(resource)) {
    if (toTrash !== null)
      return toEntity(readDoc(await moveToTrash(`/documents/${id}`, toTrash)));
    return toEntity(await patchDocument(id, entityChanges(values)));
  }
  if (resource === "notes") {
    if (toTrash !== null)
      return readNote(await moveToTrash(`/notes/${id}`, toTrash));
    return patchNote(id, values);
  }
  if (resource === "drafts") {
    if (toTrash !== null)
      return readDraft(await moveToTrash(`/drafts/${id}`, toTrash));
    for (const key of Object.keys(values))
      if (key !== "name" && key !== "locked")
        throw new Error(`Источник api не меняет поле «${key}» драфта.`);
    return readDraft(
      await request(`/drafts/${id}`, { method: "PATCH", json: values }),
    );
  }
  if (resource === "comments") {
    if (Object.keys(values).join() !== "resolved")
      throw new Error("У ветки комментария меняется только «Решено».");
    await request(`/comments/${id}`, {
      method: "PATCH",
      json: { resolved: values.resolved },
    });
    return { id, ...values };
  }
  if (resource === "comment-replies") {
    const threadId = threadOf(meta);
    const reply = variables as NewReply;
    await request(`/comments/${threadId}/messages/${messageId(threadId, id)}`, {
      method: "PATCH",
      json: { body: reply.text },
    });
    return { id, ...values };
  }
  if (resource === "suggestions") {
    // The core keeps the time of the decision itself.
    const { status } = values as Pick<Suggestion, "status">;
    const draftId: unknown = meta?.draftId;
    if (typeof draftId !== "string")
      throw new Error("Решению по предложению нужен meta.draftId.");
    return toSuggestion(
      draftId,
      await request(`/suggestions/${id}`, {
        method: "PATCH",
        json: { status },
      }),
    );
  }
  throw unsupported(resource, "правку");
}

async function deleteOne(
  resource: string,
  id: string,
  meta: MetaQuery | undefined,
): Promise<BaseRecord> {
  if (resource === "projects") {
    await request(`/projects/${id}`, { method: "DELETE" });
    return { id };
  }
  if (isEntityResource(resource)) {
    await request(`/documents/${id}`, { method: "DELETE" });
    return { id };
  }
  if (resource === "notes") {
    await request(`/notes/${id}`, { method: "DELETE" });
    return { id };
  }
  if (resource === "drafts") {
    await request(`/drafts/${id}`, { method: "DELETE" });
    return { id };
  }
  if (resource === "comment-replies") {
    // Deleting the first message deletes the thread (openspec/specs/api/review).
    const threadId = threadOf(meta);
    await request(`/comments/${threadId}/messages/${messageId(threadId, id)}`, {
      method: "DELETE",
    });
    return { id };
  }
  throw unsupported(resource, "удаление");
}

// --- files (design, decision 7)

function readFile(body: unknown): UploadedFile {
  const o = shape("файл", body);
  return {
    id: field("файл", o, "id", isString),
    name: field("файл", o, "name", isString),
  };
}

async function restoreVersion(id: string, target: VersionTarget) {
  const documentId = await versionDocument(target);
  const key = target.part === "text" ? textKey(documentId) : docKey(documentId);
  return inTurn(key, async () => {
    const o = shape(
      "откат",
      await revised(key, `/versions/${id}/restore`, { method: "POST" }),
    );
    remember(key, field("откат", o, "revision", isNumber));
    return { id };
  });
}

// The core's names of a found field as the screens name them (entityChanges, the other way).
const SCREEN_FIELD: Record<string, string> = {
  summary: "one",
  description: "long",
};
const SCREEN_KIND: Record<string, EntityKind> = {
  character: "char",
  location: "loc",
  world: "world",
};

function readSnippet(what: string, body: unknown): SearchSnippet {
  const o = shape(what, body);
  return {
    before: field(what, o, "before", isString),
    match: field(what, o, "match", isString),
    after: field(what, o, "after", isString),
  };
}

function readSearch(body: unknown): SearchResult {
  const what = "результаты поиска";
  const o = shape(what, body);
  const scenes = list(what, o.scenes).map((item): SceneHit => {
    const s = shape(what, item);
    return {
      uid: field(what, s, "uid", isStringOrNull),
      number: field(what, s, "number", isNumber),
      heading: field(what, s, "heading", isString),
      count: field(what, s, "count", isNumber),
      snippet: readSnippet(what, s.snippet),
    };
  });
  const documents = list(what, o.documents).map((item): EntityHit | PartHit => {
    const d = shape(what, item);
    const kind = field(what, d, "kind", isString);
    const key = field(what, d, "field", isString);
    const count = field(what, d, "count", isNumber);
    const snippet = readSnippet(what, d.snippet);
    if (kind === "script") {
      if (key !== "logline" && key !== "synopsis")
        throw new Error(`Сервер нашёл в сценарии неизвестное поле «${key}».`);
      return { type: "part", part: key, count, snippet };
    }
    const entity = SCREEN_KIND[kind];
    if (entity === undefined)
      throw new Error(`Сервер нашёл документ неизвестного вида «${kind}».`);
    return {
      type: "entity",
      entity,
      id: field(what, d, "id", isString),
      name: field(what, d, "name", isString),
      field: SCREEN_FIELD[key] ?? key,
      count,
      snippet,
    };
  });
  const notes = list(what, o.notes).map((item): NoteHit => {
    const n = shape(what, item);
    const key = field(what, n, "field", isString);
    if (key !== "title" && key !== "body")
      throw new Error(`Сервер нашёл в заметке неизвестное поле «${key}».`);
    return {
      id: field(what, n, "id", isString),
      title: field(what, n, "title", isString),
      field: key,
      count: field(what, n, "count", isNumber),
      snippet: readSnippet(what, n.snippet),
    };
  });
  return { query: field(what, o, "query", isString), scenes, documents, notes };
}

async function operation(
  op:
    | CoverOperation
    | FileOperation
    | SaveOperation
    | SearchOperation
    | WritingOperation,
): Promise<unknown> {
  switch (op.operation) {
    case "nextCoverColor":
      return {
        coverColor: field(
          "цвет новой истории",
          shape(
            "цвет новой истории",
            await request("/projects/next-cover-color"),
          ),
          "cover_color",
          isCoverColor,
        ),
      };
    case "search":
      return readSearch(
        await request(`/drafts/${op.payload.draftId}/search`, {
          query: { q: op.payload.q },
        }),
      );
    case "writing":
      return readWriting(
        await request(`/drafts/${op.payload.draftId}/writing`, {
          query: { tz: op.payload.tz },
        }),
      );
    case "setDailyGoal":
      await request("/me", {
        method: "PATCH",
        json: { daily_word_goal: op.payload.goal },
      });
      return {};
    case "openDraft":
      await request(`/drafts/${op.payload.draftId}/open`, { method: "POST" });
      return {};
    case "restoreVersion":
      return restoreVersion(op.payload.id, op.payload.target);
    case "restorePoint":
      return readPoint(
        await request(`/points/${op.payload.id}/restore`, { method: "POST" }),
      );
    case "upload": {
      const { projectId, file, purpose, sessionId } = op.payload;
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("purpose", purpose);
      if (sessionId !== undefined) form.append("session_id", sessionId);
      return readFile(
        await request(`/projects/${projectId}/files`, { method: "POST", form }),
      );
    }
    case "import": {
      const { draftId, fileId } = op.payload;
      const sid = await scriptId(draftId);
      return inTurn(textKey(sid), async () => {
        const t = readText(
          await revised(textKey(sid), `/drafts/${draftId}/import`, {
            method: "POST",
            json: { file_id: fileId },
          }),
        );
        remember(textKey(sid), t.revision);
        return { text: t.content };
      });
    }
    case "noteFromUpload": {
      const { projectId, file } = op.payload;
      const form = new FormData();
      form.append("file", file, file.name);
      return readNote(
        await request(`/projects/${projectId}/notes/files`, {
          method: "POST",
          form,
        }),
      );
    }
    case "noteFromChatFile":
      return readNote(
        await request(`/files/${op.payload.fileId}/note`, { method: "POST" }),
      );
    case "fileContent":
      return apiBlob(`/files/${op.payload.fileId}/content`);
    case "createFromFile": {
      const { title, file, coverColor } = op.payload;
      const form = new FormData();
      form.append("title", title);
      form.append("cover_color", coverColor);
      form.append("file", file, file.name);
      const o = shape(
        "новую историю",
        await request("/projects", { method: "POST", form }),
      );
      const project = readProject(o.project);
      const draftId = field("новую историю", o, "draft_id", isString);
      await tree(draftId);
      return { id: project.id, draftId };
    }
    default:
      throw new Error(
        `Источник api не знает операцию «${String((op as { operation: unknown }).operation)}».`,
      );
  }
}

export const apiProvider: DataProvider = {
  getApiUrl: () => "/os/api/v1",

  getList: async ({ resource, filters = [], sorters = [], pagination }) => {
    checkPagination(pagination);
    const rows = sorted(await getList(resource, filters), sorters);
    return { data: rows as never, total: rows.length };
  },

  getOne: async ({ resource, id }) => ({
    data: (await getOne(resource, String(id))) as never,
  }),

  create: async ({ resource, variables, meta }) => ({
    data: (await create(resource, variables, meta)) as never,
  }),

  update: async ({ resource, id, variables, meta }) => ({
    data: (await update(resource, String(id), variables, meta)) as never,
  }),

  deleteOne: async ({ resource, id, meta }) => ({
    data: (await deleteOne(resource, String(id), meta)) as never,
  }),

  custom: async ({ meta, payload }) => ({
    data: (await operation({
      operation: meta?.operation,
      payload,
    } as
      | CoverOperation
      | FileOperation
      | SaveOperation
      | SearchOperation
      | WritingOperation)) as never,
  }),
};

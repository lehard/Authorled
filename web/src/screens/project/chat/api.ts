import { HttpAgent, type AbstractAgent, type Message } from "@ag-ui/client";

import { activeUser } from "@/auth/userManager";

import { DENY, isChanging } from "./actions";
import { NO_CONNECTION } from "./runError";

// The co-author agent and the AgentOS API on the frontend's own origin (/os/, dev: Vite proxy).

export const COAUTHOR_ID = "coauthor";
const OS = "/os";

/** A chat failure the chat shows with its reason; a notice (the limit of the period) is not an error. */
export class ChatError extends Error {
  readonly status: number | null;
  readonly tone: "error" | "notice";

  constructor(
    message: string,
    status: number | null = null,
    tone: "error" | "notice" = "error",
  ) {
    super(message);
    this.name = "ChatError";
    this.status = status;
    this.tone = tone;
  }
}

// Messages for a person, not a developer: what happened and what to do.
function describe(status: number, account: string): string {
  if (status === 401) return "Вход истёк. Войдите снова — беседа сохранится.";
  if (status === 403) {
    return (
      `Аккаунту «${account}» соавтор недоступен: аккаунт не входит в группу авторов ` +
      "(сценаристы или редакторы). Войдите автором или попросите администратора добавить " +
      "аккаунт в группу."
    );
  }
  if (status === 404)
    return "Соавтор не найден на сервере. Похоже, сервер не обновлён.";
  if (status === 502 || status === 503 || status === 504) {
    return "Сервер сейчас не отвечает. Попробуйте ещё раз через минуту.";
  }
  if (status >= 500) return "На сервере произошла ошибка. Попробуйте ещё раз.";
  return `Сервер отказал в запросе (код ${status}).`;
}

/** fetch with the current Access Token; a refused request is a ChatError with its reason. */
export async function osFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const user = await activeUser();
  if (user === null) {
    throw new ChatError("Вход истёк. Войдите снова — беседа сохранится.", 401);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${user.access_token}`,
      },
    });
  } catch (e) {
    // The author gets no technical cause (openspec/specs/web/workspace, «Чат с соавтором»).
    console.error(`Request to ${url} did not reach the server`, e);
    throw new ChatError(NO_CONNECTION);
  }
  if (!response.ok)
    throw new ChatError(
      describe(
        response.status,
        user.profile.preferred_username ??
          user.profile.email ??
          user.profile.sub,
      ),
      response.status,
    );
  return response;
}

export function createCoauthorAgent(): HttpAgent {
  return new HttpAgent({
    agentId: COAUTHOR_ID,
    url: `${OS}/agents/${COAUTHOR_ID}/agui`,
    fetch: (url, init) => osFetch(url, init),
  });
}

// ——— Conversations: Agno sessions of the co-author, one story each (thread id `<story>:<uuid>`).

export type Conversation = { id: string; title: string; updatedAt: string };

type SessionRow = {
  session_id: string;
  session_name?: string | null;
  updated_at?: string | number | null;
  created_at?: string | number | null;
};

function toIso(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : value;
}

/** Switches the agent to a conversation (an Agno session) with these messages. */
export function switchThread(
  agent: AbstractAgent,
  threadId: string,
  messages: Message[],
): void {
  agent.threadId = threadId;
  agent.setMessages(messages);
}

/** A conversation belongs to one draft (openspec/specs/api/agents, «Инструменты соавтора»). */
export function threadPrefix(draft: { id: string; projectId: string }): string {
  return `${draft.projectId}:${draft.id}:`;
}

export function newThreadId(draft: { id: string; projectId: string }): string {
  return `${threadPrefix(draft)}${crypto.randomUUID()}`;
}

export async function listConversations(draft: {
  id: string;
  projectId: string;
}): Promise<Conversation[]> {
  const params = new URLSearchParams({
    type: "agent",
    component_id: COAUTHOR_ID,
    limit: "100",
    sort_by: "updated_at",
    sort_order: "desc",
  });
  const body = (await (await osFetch(`${OS}/sessions?${params}`)).json()) as {
    data: SessionRow[];
  };
  return body.data
    .filter((s) => s.session_id.startsWith(threadPrefix(draft)))
    .map((s) => ({
      id: s.session_id,
      title: s.session_name ?? "Беседа без названия",
      updatedAt: toIso(s.updated_at ?? s.created_at),
    }));
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  await osFetch(`${OS}/sessions/${encodeURIComponent(id)}/rename?type=agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_name: title }),
  });
}

/** A call of a tool as a run of Agno 3.1.10 keeps it (`tools` of `GET /sessions/{id}/runs`). */
type ToolRow = {
  tool_call_id?: unknown;
  tool_name?: unknown;
  tool_args?: unknown;
  result?: unknown;
  confirmed?: unknown;
};

type RunRow = {
  run_id?: unknown;
  run_input?: string | null;
  content?: unknown;
  created_at?: number;
  tools?: ToolRow[] | null;
  /** `PAUSED`: the run still waits for the author's answer to an action and has no answer of its own. */
  status?: unknown;
};

// Agno stores the question with the AG-UI context appended; the chat shows the question only.
const CONTEXT_TAIL = /\s*<additional context>[\s\S]*<\/additional context>\s*$/;

export type LoadedConversation = {
  messages: Message[];
  /** The run of each answer, by message id: the run a mark of the answer belongs to. */
  runOf: Map<string, string>;
};

/**
 * A tool result as Agno 3.1.10 sends it over AG-UI (`to_json_str`, agno/os/interfaces/agui/utils.py):
 * valid JSON as it is, any other text as a JSON string. A run keeps the result as the tool returned it.
 */
function asAgui(result: unknown): string {
  if (typeof result !== "string") return "";
  try {
    JSON.parse(result);
    return result;
  } catch {
    // Not JSON: a refusal of the core in plain text, which AG-UI sends as a JSON string.
    return JSON.stringify(result);
  }
}

/**
 * The changing calls of a run as the chat got them live (openspec/specs/web/workspace, «Сделанное
 * соавтором в чате»; design of research-brief, decision 10): one message with the calls before the
 * answer, and the result or the author's refusal of each call. A call nobody answered is left out.
 */
function actionsOf(
  tools: ToolRow[],
  messageId: string,
  run: string,
): Message[] {
  const answered = tools.filter(
    (t) =>
      typeof t.tool_name === "string" &&
      isChanging(t.tool_name) &&
      (t.confirmed === true || t.confirmed === false),
  );
  if (answered.length === 0) return [];
  const calls = answered.map((t) => {
    if (typeof t.tool_call_id !== "string" || t.tool_call_id === "")
      throw new Error(`Действие запуска ${run} пришло без tool_call_id.`);
    return {
      id: t.tool_call_id,
      type: "function" as const,
      function: {
        name: t.tool_name as string,
        arguments: JSON.stringify(t.tool_args ?? {}),
      },
    };
  });
  return [
    { id: messageId, role: "assistant", content: "", toolCalls: calls },
    ...answered.map((t, k) => ({
      id: `${messageId}-r${k}`,
      role: "tool" as const,
      toolCallId: calls[k].id,
      // A refused call has no result; a done one shows what the core answered, as AG-UI
      // carries it (outcome.ts).
      content: t.confirmed === false ? JSON.stringify(DENY) : asAgui(t.result),
    })),
  ];
}

/** Messages of a conversation as the chat shows them: each run is a question and an answer. */
export async function loadConversation(
  id: string,
): Promise<LoadedConversation> {
  const runs = (await (
    await osFetch(`${OS}/sessions/${encodeURIComponent(id)}/runs?type=agent`)
  ).json()) as RunRow[];
  const runOf = new Map<string, string>();
  const messages = runs.flatMap((r, i): Message[] => {
    // A run left on the pause keeps Agno's own line as its content, not an answer of the model
    // (openspec/specs/web/workspace, «Действие без ответа»).
    const answer =
      r.status !== "PAUSED" && typeof r.content === "string" && r.content !== ""
        ? r.content
        : null;
    if (answer !== null) {
      if (typeof r.run_id !== "string" || r.run_id === "")
        throw new Error(`Запуск ${i} беседы ${id} пришёл без run_id.`);
      runOf.set(`${id}-a${i}`, r.run_id);
    }
    return [
      ...(r.run_input
        ? [
            {
              id: `${id}-u${i}`,
              role: "user" as const,
              content: r.run_input.replace(CONTEXT_TAIL, ""),
            },
          ]
        : []),
      ...actionsOf(r.tools ?? [], `${id}-c${i}`, `${id} ${i}`),
      ...(answer !== null
        ? [{ id: `${id}-a${i}`, role: "assistant" as const, content: answer }]
        : []),
    ];
  });
  return { messages, runOf };
}

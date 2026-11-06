import { HttpAgent, type AbstractAgent, type Message } from "@ag-ui/client";

import { activeUser } from "@/auth/userManager";

// The co-author agent and the AgentOS API on the frontend's own origin (/os/, dev: Vite proxy).

export const COAUTHOR_ID = "coauthor";
const OS = "/os";

/** A chat failure the chat shows with its reason. */
export class ChatError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ChatError";
    this.status = status;
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
    throw new ChatError(
      `Нет связи с сервером. Проверьте интернет и попробуйте ещё раз (${e instanceof Error ? e.message : String(e)}).`,
    );
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

type RunRow = {
  run_input?: string | null;
  content?: unknown;
  created_at?: number;
};

// Agno stores the question with the AG-UI context appended; the chat shows the question only.
const CONTEXT_TAIL = /\s*<additional context>[\s\S]*<\/additional context>\s*$/;

/** Messages of a conversation as the chat shows them: each run is a question and an answer. */
export async function loadConversation(
  id: string,
): Promise<{ id: string; role: "user" | "assistant"; content: string }[]> {
  const runs = (await (
    await osFetch(`${OS}/sessions/${encodeURIComponent(id)}/runs?type=agent`)
  ).json()) as RunRow[];
  return runs.flatMap((r, i) => [
    ...(r.run_input
      ? [
          {
            id: `${id}-u${i}`,
            role: "user" as const,
            content: r.run_input.replace(CONTEXT_TAIL, ""),
          },
        ]
      : []),
    ...(typeof r.content === "string" && r.content !== ""
      ? [{ id: `${id}-a${i}`, role: "assistant" as const, content: r.content }]
      : []),
  ]);
}

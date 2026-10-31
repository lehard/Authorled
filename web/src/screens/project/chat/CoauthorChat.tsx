import type { Message } from "@ag-ui/client";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { ArrowUp, Copy, History, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { InkLoader } from "@/design-system";

import { useProjectData } from "../ProjectContext";
import {
  ChatError,
  COAUTHOR_ID,
  listConversations,
  loadConversation,
  newThreadId,
  renameConversation,
  switchThread,
  type Conversation,
} from "./api";
import { coauthorContext } from "./docContext";

const SUGGESTIONS = [
  "О чём эта история?",
  "Что можно сократить в этом документе?",
  "Проверь, нет ли противоречий в этом документе",
];
const TITLE_LENGTH = 48;
const when = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  sees: string;
  selection: string;
  clearSelection: () => void;
  /** Set when the chat is a sheet (narrow screens): a close button in its header. */
  onClose?: () => void;
};

function textOf(m: Message): string {
  return typeof m.content === "string" ? m.content : "";
}

/** Chat with the co-author (openspec/specs/web/workspace, «Чат с соавтором»). */
export function CoauthorChat({
  sees,
  selection,
  clearSelection,
  onClose,
}: Props) {
  const data = useProjectData();
  const navigate = useNavigate();
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({
    agentId: COAUTHOR_ID,
    updates: [
      UseAgentUpdate.OnMessagesChanged,
      UseAgentUpdate.OnRunStatusChanged,
    ],
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const projectId = data.project.id;

  useAgentContext({
    description: "Что сейчас открыто у автора в Authorled",
    value: coauthorContext(data, selection),
  });

  // A conversation belongs to one story: switching stories starts a new one.
  useEffect(() => {
    if (!agent.threadId.startsWith(`${projectId}:`)) {
      switchThread(agent, newThreadId(projectId), []);
    }
  }, [agent, projectId]);

  const messages = agent.messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const lastContent = messages.at(-1)?.content;
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [messages.length, lastContent]);

  // CopilotKit reports a failed run (network, HTTP status, RUN_ERROR of the agent) to the
  // agent's subscribers instead of rejecting runAgent; turn it into an error to show.
  async function runOrThrow() {
    let failure: Error | null = null;
    const subscription = agent.subscribe({
      onRunFailed: ({ error }) => {
        failure = error;
      },
      onRunErrorEvent: ({ event }) => {
        failure = new ChatError(
          `Соавтор не смог ответить: ${event.message}. Попробуйте ещё раз.`,
        );
      },
    });
    try {
      await copilotkit.runAgent({ agent });
    } finally {
      subscription.unsubscribe();
    }
    if (failure !== null) throw failure;
  }

  async function send(text: string) {
    const question = text.trim();
    if (question === "" || agent.isRunning) return;
    const first = messages.length === 0;
    setError(null);
    setDraft("");
    setView("messages");
    const id = crypto.randomUUID();
    agent.addMessage({ id, role: "user", content: question });
    try {
      await runOrThrow();
      if (first)
        await renameConversation(
          agent.threadId,
          question.slice(0, TITLE_LENGTH),
        );
    } catch (e) {
      if (e instanceof ChatError && e.status === 401) {
        navigate(
          `/login?returnTo=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      // The question stays in the field, so it can be sent again.
      agent.setMessages(agent.messages.filter((m) => m.id !== id));
      setDraft(question);
    }
  }

  function startNew() {
    switchThread(agent, newThreadId(projectId), []);
    setError(null);
    setView("messages");
  }

  async function openHistory() {
    if (view === "history") {
      setView("messages");
      return;
    }
    setView("history");
    setHistory(null);
    try {
      setHistory(await listConversations(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setView("messages");
    }
  }

  async function openConversation(c: Conversation) {
    setError(null);
    try {
      const loaded = await loadConversation(c.id);
      switchThread(agent, c.id, loaded);
      setView("messages");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  const last = messages.at(-1);
  const waiting =
    agent.isRunning &&
    (last === undefined || last.role === "user" || textOf(last) === "");

  return (
    <section aria-label="Соавтор" className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-13 items-center gap-1 border-b border-border py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="size-4 text-ai" />
            Соавтор
          </b>
          <small className="block truncate text-xs text-muted-foreground">
            Видит: {sees}
          </small>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="История бесед"
          aria-pressed={view === "history"}
          onClick={() => void openHistory()}
        >
          <History />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Новая беседа"
          onClick={startNew}
        >
          <Plus />
        </Button>
        {onClose !== undefined && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Закрыть чат"
            onClick={onClose}
          >
            <X />
          </Button>
        )}
      </header>

      {view === "history" ? (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <p className="px-2 pt-2 pb-1.5 text-xs font-semibold text-muted-foreground">
            Беседы по этой истории
          </p>
          {history === null ? (
            <div className="grid justify-items-center py-6">
              <InkLoader />
            </div>
          ) : history.length === 0 ? (
            <p className="p-2 text-muted-foreground">Бесед ещё не было.</p>
          ) : (
            history.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openConversation(c)}
                aria-current={c.id === agent.threadId ? "true" : undefined}
                className="grid w-full gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-accent aria-current:bg-paper aria-current:shadow-panel"
              >
                <span className="truncate">{c.title}</span>
                <small className="text-xs text-muted-foreground">
                  {when.format(new Date(c.updatedAt))}
                </small>
              </button>
            ))
          )}
        </div>
      ) : (
        <div
          ref={feed}
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto p-4"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="m-auto max-w-72 text-center text-muted-foreground">
              <b className="mb-1.5 block text-foreground">Спросите соавтора</b>
              Он видит открытый документ и выделенный фрагмент.
              <div className="mt-4 grid gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-2xl bg-paper px-3 py-2 text-left text-foreground hover:shadow-panel"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="max-w-[92%] self-end rounded-[14px_14px_4px_14px] bg-paper px-3 py-2.5 whitespace-pre-wrap shadow-panel"
                >
                  {textOf(m)}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] self-start">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ai">
                    <Sparkles className="size-3.5" />
                    Соавтор
                  </div>
                  <div className="chat-md">
                    <Markdown>{textOf(m)}</Markdown>
                  </div>
                  {!(agent.isRunning && m === last) && textOf(m) !== "" && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="mt-2 rounded-lg text-muted-foreground"
                      onClick={() =>
                        void navigator.clipboard.writeText(textOf(m))
                      }
                    >
                      <Copy />
                      Скопировать
                    </Button>
                  )}
                </div>
              ),
            )
          )}
          {waiting && (
            <div
              role="status"
              className="flex items-center gap-2 text-caption text-muted-foreground"
            >
              <InkLoader className="h-5 w-16" />
              Соавтор пишет…
            </div>
          )}
          {error !== null && (
            <p
              role="alert"
              className="rounded-xl bg-muted px-3 py-2 text-caption text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {/* minmax(0, 1fr): a long selection is cut by the chat width, not widening the column. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pt-2.5 pb-3">
        {selection !== "" && (
          <span className="inline-flex max-w-full items-center gap-1.5 justify-self-start rounded-full bg-ai-subtle py-1 pr-1.5 pl-2.5 text-caption text-ai">
            <span className="min-w-0 truncate">
              Выделено: «{selection.slice(0, 60)}
              {selection.length > 60 ? "…" : ""}»
            </span>
            <button
              type="button"
              aria-label="Убрать выделенное"
              onClick={clearSelection}
              className="grid size-5 place-items-center rounded-full hover:bg-ai-subtle"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}
        <div className="flex items-end gap-1.5 rounded-3xl bg-paper py-1.5 pr-1.5 pl-3 shadow-panel focus-within:ring-2 focus-within:ring-ring/50">
          <textarea
            rows={1}
            value={draft}
            placeholder="Напишите соавтору"
            aria-label="Сообщение соавтору"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            className="field-sizing-content max-h-40 min-h-6 flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="icon"
            className="rounded-full"
            aria-label="Отправить"
            disabled={draft.trim() === "" || agent.isRunning}
            onClick={() => void send(draft)}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </section>
  );
}

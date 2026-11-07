import type { Message } from "@ag-ui/client";
import {
  useAgent,
  useAgentContext,
  useCopilotKit,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { useInvalidate } from "@refinedev/core";
import {
  ArrowUp,
  Copy,
  History,
  Paperclip,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useStoryFiles } from "@/data/files";
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
  threadPrefix,
  type Conversation,
} from "./api";
import { coauthorContext } from "./docContext";

const SUGGESTIONS = [
  "О чём эта история?",
  "Что можно сократить в этом документе?",
  "Проверь, нет ли противоречий в этом документе",
];
const TITLE_LENGTH = 48;
// Files in a message (openspec/specs/web/workspace, «Файлы в чат»): what the core reads for the
// co-author, its size limit and how many go in one message.
const CHAT_TYPES = [
  ".docx",
  ".pdf",
  ".txt",
  ".md",
  ".fountain",
  ".fdx",
  ".starc",
];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;

/** A file of the message being written; `id` is null while the core checks it. */
type Attachment = { key: string; name: string; id: string | null };
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

/** The reason the backend put into the data of a refused run (agents/coauthor_usage.py). */
function limitReason(rawEvent: unknown): unknown {
  if (typeof rawEvent !== "object" || rawEvent === null) return undefined;
  const data = (rawEvent as { additional_data?: unknown }).additional_data;
  if (typeof data !== "object" || data === null) return undefined;
  return (data as { reason?: unknown }).reason;
}

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
  const invalidate = useInvalidate();
  const { agent } = useAgent({
    agentId: COAUTHOR_ID,
    updates: [
      UseAgentUpdate.OnMessagesChanged,
      UseAgentUpdate.OnRunStatusChanged,
    ],
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<{
    text: string;
    tone: "error" | "notice";
  } | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectId = data.project.id;
  const { draft: openDraft } = data;
  const openDraftId = openDraft.id;
  const storyFiles = useStoryFiles();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const checking = attachments.some((a) => a.id === null);

  useAgentContext({
    description: "Что сейчас открыто у автора в Authorled",
    value: coauthorContext(data, selection),
  });

  // A conversation belongs to one draft: switching drafts starts a new one.
  useEffect(() => {
    const here = { id: openDraftId, projectId };
    if (!agent.threadId.startsWith(threadPrefix(here))) {
      switchThread(agent, newThreadId(here), []);
    }
  }, [agent, openDraftId, projectId]);

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
        // The limit of the period is not a failure: the backend's message is shown as it is
        // (openspec/specs/web/workspace, «Чат с соавтором»).
        failure =
          limitReason(event.rawEvent) === "usage_limit_reached"
            ? new ChatError(event.message, null, "notice")
            : new ChatError(
                `Соавтор не смог ответить: ${event.message}. Попробуйте ещё раз.`,
              );
      },
    });
    try {
      await copilotkit.runAgent({ agent });
    } finally {
      subscription.unsubscribe();
      // The co-author may have suggested edits during its turn: the text shows them without a
      // reload (openspec/specs/web/workspace, «Предложение по якорю»).
      void invalidate({ resource: "suggestions", invalidates: ["list"] });
    }
    if (failure !== null) throw failure;
  }

  // Each file goes to the core at once, to this conversation; a refusal is shown under the
  // field and the file is not attached.
  function attach(list: FileList | File[]) {
    const errors: string[] = [];
    let room = MAX_FILES - attachments.length;
    for (const file of Array.from(list)) {
      const dot = file.name.lastIndexOf(".");
      const ext = dot < 0 ? "" : file.name.slice(dot).toLowerCase();
      if (!CHAT_TYPES.includes(ext)) {
        errors.push(
          `«${file.name}»: соавтор читает только DOCX, PDF, TXT, MD, Fountain и FDX.`,
        );
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push(`«${file.name}»: файл больше 20 МБ.`);
        continue;
      }
      if (room <= 0) {
        errors.push(
          `«${file.name}»: в сообщении не больше ${MAX_FILES} файлов.`,
        );
        continue;
      }
      room -= 1;
      const key = crypto.randomUUID();
      setAttachments((a) => [...a, { key, name: file.name, id: null }]);
      storyFiles
        .upload({ projectId, file, purpose: "chat", sessionId: agent.threadId })
        .then(
          (uploaded) =>
            setAttachments((a) =>
              a.map((x) => (x.key === key ? { ...x, id: uploaded.id } : x)),
            ),
          (e: unknown) => {
            setAttachments((a) => a.filter((x) => x.key !== key));
            setFileErrors((es) => [
              ...es,
              `«${file.name}»: ${e instanceof Error ? e.message : String(e)}`,
            ]);
          },
        );
    }
    setFileErrors(errors);
  }

  function clearFiles() {
    setAttachments([]);
    setFileErrors([]);
  }

  async function send(text: string) {
    const question = text.trim();
    // While a file is being checked the message waits (web/workspace, «Файлы в сообщении»).
    if (agent.isRunning || checking) return;
    const sent = attachments.filter(
      (a): a is Attachment & { id: string } => a.id !== null,
    );
    if (question === "" && sent.length === 0) return;
    const names = sent.map((a) => a.name).join(", ");
    const content = [question, sent.length === 0 ? "" : `Файлы: ${names}`]
      .filter((part) => part !== "")
      .join("\n\n");
    const first = messages.length === 0;
    setError(null);
    setDraft("");
    clearFiles();
    setView("messages");
    const id = crypto.randomUUID();
    agent.addMessage({ id, role: "user", content });
    // The ids reach the co-author with this turn only; it reads the files with read_chat_file.
    const files =
      sent.length === 0
        ? null
        : copilotkit.addContext({
            description: "Файлы этого сообщения (id и имя)",
            value: JSON.stringify(
              sent.map((a) => ({ id: a.id, name: a.name })),
            ),
          });
    try {
      await runOrThrow();
      if (first)
        await renameConversation(
          agent.threadId,
          (question === "" ? names : question).slice(0, TITLE_LENGTH),
        );
    } catch (e) {
      if (e instanceof ChatError && e.status === 401) {
        navigate(
          `/login?returnTo=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      setError({
        text: e instanceof Error ? e.message : String(e),
        tone: e instanceof ChatError ? e.tone : "error",
      });
      // The question and its files stay in the field, so they can be sent again.
      agent.setMessages(agent.messages.filter((m) => m.id !== id));
      setDraft(question);
      setAttachments(sent);
    } finally {
      if (files !== null) copilotkit.removeContext(files);
    }
  }

  function onDrop(e: DragEvent) {
    if (e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    attach(e.dataTransfer.files);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length === 0) return;
    e.preventDefault();
    attach(e.clipboardData.files);
  }

  function startNew() {
    clearFiles();
    switchThread(agent, newThreadId(openDraft), []);
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
      setHistory(await listConversations(openDraft));
    } catch (e) {
      setError({
        text: e instanceof Error ? e.message : String(e),
        tone: "error",
      });
      setView("messages");
    }
  }

  async function openConversation(c: Conversation) {
    setError(null);
    try {
      const loaded = await loadConversation(c.id);
      clearFiles();
      switchThread(agent, c.id, loaded);
      setView("messages");
    } catch (e) {
      setError({
        text: e instanceof Error ? e.message : String(e),
        tone: "error",
      });
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
    <section
      aria-label="Соавтор"
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={onDrop}
    >
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
              role={error.tone === "error" ? "alert" : "status"}
              className={`rounded-xl bg-muted px-3 py-2 text-caption ${error.tone === "error" ? "text-destructive" : "text-foreground"}`}
            >
              {error.text}
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
        {attachments.length > 0 && (
          <ul aria-label="Файлы сообщения" className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <li
                key={a.key}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-paper py-1 pr-1.5 pl-2.5 text-caption shadow-panel"
              >
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{a.name}</span>
                {a.id === null ? (
                  <span role="status" className="text-muted-foreground">
                    проверяется…
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Убрать файл «${a.name}»`}
                    onClick={() =>
                      setAttachments((list) =>
                        list.filter((x) => x.key !== a.key),
                      )
                    }
                    className="grid size-5 place-items-center rounded-full hover:bg-accent"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-1.5 rounded-3xl bg-paper py-1.5 pr-1.5 pl-1.5 shadow-panel focus-within:ring-2 focus-within:ring-ring/50">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={CHAT_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files !== null) attach(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            aria-label="Прикрепить файл"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip />
          </Button>
          <textarea
            rows={1}
            value={draft}
            placeholder="Напишите соавтору"
            aria-label="Сообщение соавтору"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="field-sizing-content max-h-40 min-h-6 flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="icon"
            className="rounded-full"
            aria-label="Отправить"
            disabled={
              (draft.trim() === "" &&
                !attachments.some((a) => a.id !== null)) ||
              checking ||
              agent.isRunning
            }
            onClick={() => void send(draft)}
          >
            <ArrowUp />
          </Button>
        </div>
        {fileErrors.length > 0 && (
          <ul
            role="alert"
            className="grid gap-0.5 text-caption text-destructive"
          >
            {fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

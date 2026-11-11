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
  NotebookPen,
  PanelRightClose,
  Paperclip,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStoryFiles } from "@/data/files";
import { GrowingTextarea, InkLoader } from "@/design-system";

import { docPath } from "../docRef";
import { useNoteActions } from "../noteActions";
import { useProjectData, type CoauthorRequest } from "../ProjectContext";
import { ActionLines } from "./ActionLines";
import { changedResources, firstChangingCalls, toolText } from "./actions";
import { AnswerPre } from "./ResearchBlock";
import { hasBrief } from "./researchBrief";
import { useConfirmations } from "./confirmations";
import { useAccount } from "@/account/useAccount";
import { NO_TRAINING_SHORT, offerUrl } from "@/app/legal";
import { newLineKey, sendKey } from "@/screens/shared/keys";
import { useMediaQuery } from "@/screens/shared/useMediaQuery";
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
import { ABOUT_STORY, CHECKS, RESEARCH_START } from "./checks";
import { ChecksButton } from "./ChecksMenu";
import { useChatRuns } from "./chatRuns";
import {
  clearMark,
  loadMarks,
  markError,
  putMark,
  type Mark,
} from "./feedback";
import { coauthorContext } from "./docContext";
import { ModeSwitch } from "./ModeSwitch";
import { readRunError, UNAVAILABLE, type RunError } from "./runError";

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
  /** A check from a document: the chat sends it once and reports it taken. */
  request: CoauthorRequest | null;
  onRequestTaken: (id: string) => void;
  /** Whether a message can go now: the window offers the checks of documents only then. */
  onBlockedChange: (blocked: boolean) => void;
  /** Set when the chat is a sheet (narrow screens): a close button in its header. */
  onClose?: () => void;
  /** Set when the chat is a column (wide screens): «Свернуть чат» in its header. */
  onCollapse?: () => void;
};

function textOf(m: Message): string {
  return typeof m.content === "string" ? m.content : "";
}

function callsOf(m: Message) {
  return m.role === "assistant" ? (m.toolCalls ?? []) : [];
}

/** Chat with the co-author (openspec/specs/web/workspace, «Чат с соавтором»). */
export function CoauthorChat({
  sees,
  selection,
  clearSelection,
  request,
  onRequestTaken,
  onBlockedChange,
  onClose,
  onCollapse,
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
  const field = useRef<HTMLTextAreaElement | null>(null);
  // The last request to fill that went into the field.
  const [filled, setFilled] = useState<string | null>(null);
  // A turn of the author, from sending to the end of the co-author's answer, including the time
  // a confirmation card waits for the author: no other message goes meanwhile.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    tone: "error" | "notice";
  } | null>(null);
  const [view, setView] = useState<"messages" | "history">("messages");
  // The answer whose actions a tap showed on a touch screen.
  const [revealed, setRevealed] = useState<string | null>(null);
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectId = data.project.id;
  const { draft: openDraft } = data;
  const openDraftId = openDraft.id;
  const storyFiles = useStoryFiles();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  // «В заметки» of an attached file (web/workspace, «Файл чата в заметки»): the note made of it,
  // by the key of the attachment, or null while it is being made.
  const [savedNotes, setSavedNotes] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const noteActions = useNoteActions(projectId);
  const checking = attachments.some((a) => a.id === null);
  const { data: account } = useAccount();
  const confirmations = useConfirmations(account?.coauthorMode);
  const runs = useChatRuns();
  // Key hints only with a mouse or a touchpad (openspec/specs/web/workspace,
  // «Подсказка клавиш в поле чата»).
  const keyHints = useMediaQuery("(any-pointer: fine)");

  useAgentContext({
    description: "Что сейчас открыто у автора в Соавторе",
    value: coauthorContext(data, selection),
  });

  // A conversation belongs to one draft: switching drafts starts a new one.
  useEffect(() => {
    const here = { id: openDraftId, projectId };
    if (!agent.threadId.startsWith(threadPrefix(here))) {
      switchThread(agent, newThreadId(here), []);
      runs.reset(new Map(), new Map());
    }
    // `runs` changes with every mark; the conversation is what this effect follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, openDraftId, projectId]);

  const messages = agent.messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  // No message goes while a turn runs or a file is checked (`send`); the window knows it too.
  const blocked = busy || checking || agent.isRunning;
  useEffect(() => {
    onBlockedChange(blocked);
  }, [blocked, onBlockedChange]);
  useEffect(() => () => onBlockedChange(false), [onBlockedChange]);

  const lastContent = messages.at(-1)?.content;
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [messages.length, lastContent]);

  // CopilotKit reports a failed run (network, HTTP status, RUN_ERROR of the agent) to the
  // agent's subscribers instead of rejecting runAgent; turn it into an error to show. The
  // author sees no text of an exception (openspec/specs/web/workspace, «Чат с соавтором»).
  // Returns the run id of the first RUN_STARTED of the turn: the run of Agno that the usage journal
  // records. A turn resumed after a confirmation continues that run, while its RUN_STARTED carries
  // a new id of the client (design, decision 5).
  async function runOrThrow(): Promise<string | null> {
    let runError: RunError | null = null;
    let failure: Error | null = null;
    let runId: string | null = null;
    const subscription = agent.subscribe({
      onRunStartedEvent: ({ event }) => {
        if (runId === null) runId = event.runId;
      },
      onRunFailed: ({ error }) => {
        failure = error;
      },
      // A change of the co-author is shown at once, not after the whole turn
      // (openspec/specs/web/workspace, «Экраны после действия соавтора»).
      onToolCallResultEvent: ({ event }) => {
        const content = toolText(event.content);
        runs.addOutcome(event.toolCallId, content);
        for (const resource of changedResources(content))
          void invalidate({
            resource,
            // The screenplay of the draft is read as one record by the draft's id (useScript):
            // Refine refreshes a detail only by its id.
            ...(resource === "scripts" ? { id: data.draft.id } : {}),
            invalidates: ["list", "many", "detail"],
          });
      },
      onRunErrorEvent: ({ event }) => {
        // A refusal of the product keeps the backend's message; anything else stays in the
        // console and the API log.
        console.error("Run of the co-author failed", event);
        runError = readRunError(event.message, event.rawEvent);
      },
    });
    // runAgent may still reject (CopilotKit 1.79.1 rethrows a failed detachActiveRun): that is a
    // failed run too, not a text for the author.
    let thrown: unknown = null;
    try {
      await copilotkit.runAgent({ agent });
    } catch (e) {
      thrown = e;
    } finally {
      subscription.unsubscribe();
      // The co-author may have suggested edits during its turn: the text shows them without a
      // reload (openspec/specs/web/workspace, «Предложение по якорю»).
      void invalidate({ resource: "suggestions", invalidates: ["list"] });
    }
    // RUN_ERROR wins: it is what the backend said, whatever the client failed with after it.
    const said = runError as RunError | null;
    if (said !== null) {
      throw said.kind === "refusal"
        ? new ChatError(said.text, null, said.tone)
        : new ChatError(UNAVAILABLE);
    }
    const reported = failure as Error | null;
    const failed: unknown = reported !== null ? reported : thrown;
    if (failed === null) return runId;
    // osFetch already put a text for the author (and the status for 401) into a ChatError.
    if (failed instanceof ChatError) throw failed;
    console.error("Run of the co-author failed", failed);
    throw new ChatError(UNAVAILABLE);
  }

  // Each file goes to the core at once, to this conversation; a refusal is shown under the
  // field and the file is not attached.
  async function saveToNotes(key: string, fileId: string) {
    setSavedNotes((m) => new Map(m).set(key, null));
    try {
      const id = await noteActions.fromChatFile(fileId);
      setSavedNotes((m) => new Map(m).set(key, id));
    } catch (e) {
      setSavedNotes((m) => {
        const next = new Map(m);
        next.delete(key);
        return next;
      });
      setFileErrors((es) => [
        ...es,
        e instanceof Error ? e.message : String(e),
      ]);
    }
  }

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
    setSavedNotes(new Map());
  }

  /**
   * Sends a message of the author. A typed one leaves the field and comes back to it on a
   * failure; a check (`check`) keeps what is typed in the field.
   */
  async function send(text: string, from: "field" | "check") {
    const question = text.trim();
    // While a file is being checked the message waits (web/workspace, «Файлы в сообщении»).
    if (agent.isRunning || checking || busy) {
      // The window offers no check meanwhile; if one still came, the author sees it did not go.
      if (from === "check")
        setError({
          text: "Соавтор ещё отвечает: проверка не отправлена.",
          tone: "notice",
        });
      return;
    }
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
    if (from === "field") setDraft("");
    clearFiles();
    setView("messages");
    setBusy(true);
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
      const runId = await runOrThrow();
      // The answer of the turn is its last message with text; only it gets the marks.
      const answer = agent.messages
        .slice(agent.messages.findIndex((m) => m.id === id) + 1)
        .findLast((m) => m.role === "assistant" && textOf(m) !== "");
      if (answer !== undefined) {
        if (runId === null)
          console.error(
            "The run of the co-author sent no RUN_STARTED",
            answer.id,
          );
        else runs.addRun(answer.id, runId);
      }
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
      // After the author answered a confirmation the turn has taken place: it stays as it is.
      const sentAt = agent.messages.findIndex((m) => m.id === id);
      if (agent.messages.slice(sentAt + 1).some((m) => m.role === "tool"))
        return;
      // The question and its files stay in the field, so they can be sent again.
      agent.setMessages(agent.messages.filter((m) => m.id !== id));
      if (from === "field") setDraft(question);
      setAttachments(sent);
    } finally {
      if (files !== null) copilotkit.removeContext(files);
      setBusy(false);
    }
  }

  // A request to fill goes into the field before what is typed there, once per request, with the
  // caret at the end (web/workspace, «Задача «Под заявку»»). The field changes while rendering, as
  // React adjusts state to a new prop; focus and caret wait for the field to show it.
  if (request !== null && request.mode === "fill" && request.id !== filled) {
    setFilled(request.id);
    setDraft(request.text + draft);
  }
  useEffect(() => {
    if (filled === null) return;
    onRequestTaken(filled);
    const el = field.current;
    if (el === null)
      throw new Error("Поля ввода чата нет: просьба не вставлена.");
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // The request that went into the field is what starts the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);
  // A check from a document goes like a typed question, once per request.
  const taken = useRef<string | null>(null);
  useEffect(() => {
    if (
      request === null ||
      request.mode === "fill" ||
      taken.current === request.id
    )
      return;
    taken.current = request.id;
    onRequestTaken(request.id);
    void send(request.text, "check");
    // `send` reads the state of this render; the request is what starts the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

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
    runs.reset(new Map(), new Map());
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
      const [loaded, marks] = await Promise.all([
        loadConversation(c.id),
        loadMarks(c.id),
      ]);
      clearFiles();
      switchThread(agent, c.id, loaded.messages);
      runs.reset(loaded.runOf, marks);
      setView("messages");
    } catch (e) {
      setError({
        text: e instanceof Error ? e.message : String(e),
        tone: "error",
      });
    }
  }

  // A click marks the answer, a click on the chosen mark takes it back; a refusal brings the
  // previous mark back (web/workspace, «Оценка ответа соавтора»).
  async function mark(runId: string, value: Mark) {
    const before = runs.marks.get(runId) ?? null;
    const next = before === value ? null : value;
    setError(null);
    runs.setMark(runId, next);
    try {
      if (next === null) await clearMark(runId);
      else await putMark(runId, next);
    } catch (e) {
      runs.setMark(runId, before);
      setError({ text: markError(e), tone: "error" });
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft, "field");
    }
  }

  const last = messages.at(-1);
  const waiting =
    agent.isRunning &&
    (last === undefined ||
      last.role === "user" ||
      (textOf(last) === "" && callsOf(last).length === 0));
  const changingCalls = firstChangingCalls(messages);
  // The answer whose actions are always shown: the last finished one with text (web/workspace,
  // «Оценка ответа соавтора»); the others show them on hover, focus or a tap.
  const lastAnswer = agent.isRunning
    ? undefined
    : messages.findLast(
        (m) =>
          m.role === "assistant" &&
          (changingCalls.get(m.id) ?? []).length === 0 &&
          textOf(m) !== "",
      )?.id;
  const sendButton = (
    <Button
      size="icon"
      className="rounded-full"
      aria-label="Отправить"
      disabled={
        (draft.trim() === "" && !attachments.some((a) => a.id !== null)) ||
        checking ||
        agent.isRunning ||
        busy
      }
      onClick={() => void send(draft, "field")}
    >
      <ArrowUp />
    </Button>
  );

  /**
   * An answer of the co-author: its text, or the changing calls it carries. The text Agno puts
   * on a paused run is its own, in English, so a message with changing calls shows them only;
   * a message with neither (a turn of reading tools) is not shown.
   */
  function assistantMessage(m: Message) {
    const calls = changingCalls.get(m.id) ?? [];
    const text = calls.length > 0 ? "" : textOf(m);
    // Marks belong to the last answer of a run, the one whose run the chat knows.
    const runId = runs.runOf.get(m.id);
    const chosen = runId === undefined ? undefined : runs.marks.get(runId);
    if (text === "" && calls.length === 0) return null;
    const shown = m.id === lastAnswer || revealed === m.id;
    // Hidden actions keep their place, so nothing moves when they show; a chosen mark stays visible.
    const hide = (pressed: boolean) =>
      shown || pressed
        ? ""
        : "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100";
    const copyable = !hasBrief(text);
    return (
      <div
        key={m.id}
        className="group max-w-[92%] self-start"
        // On a touch screen there is no hover: a tap on an answer shows its actions.
        onClick={keyHints ? undefined : () => setRevealed(m.id)}
      >
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ai">
          <Sparkles className="size-3.5" />
          Соавтор
        </div>
        {text !== "" && (
          <div className="chat-md">
            <Markdown components={{ pre: AnswerPre }}>{text}</Markdown>
          </div>
        )}
        <ActionLines
          calls={calls}
          messages={agent.messages}
          outcomes={runs.outcomes}
          confirmations={confirmations}
        />
        {!(agent.isRunning && m === last) &&
          text !== "" &&
          (copyable || runId !== undefined) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {copyable && (
                <Button
                  variant="outline"
                  size="xs"
                  className={`rounded-lg text-muted-foreground ${hide(false)}`}
                  onClick={() => void navigator.clipboard.writeText(text)}
                >
                  <Copy />
                  Скопировать
                </Button>
              )}
              {runId !== undefined && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={`rounded-lg text-muted-foreground aria-pressed:bg-ai-subtle aria-pressed:text-ai ${hide(chosen === "useful")}`}
                    aria-pressed={chosen === "useful"}
                    onClick={() => void mark(runId, "useful")}
                  >
                    <ThumbsUp />
                    Полезно
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={`rounded-lg text-muted-foreground aria-pressed:bg-ai-subtle aria-pressed:text-ai ${hide(chosen === "not_useful")}`}
                    aria-pressed={chosen === "not_useful"}
                    onClick={() => void mark(runId, "not_useful")}
                  >
                    <ThumbsDown />
                    Не то
                  </Button>
                </>
              )}
            </div>
          )}
      </div>
    );
  }

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
          // A turn waiting for the author belongs to this conversation: it ends first.
          disabled={busy}
          onClick={() => void openHistory()}
        >
          <History />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Новая беседа"
          disabled={busy}
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
        {onCollapse !== undefined && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Свернуть чат"
            onClick={onCollapse}
          >
            <PanelRightClose />
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
              <button
                type="button"
                onClick={() => void send(ABOUT_STORY, "check")}
                className="mt-4 w-full rounded-2xl bg-paper px-3 py-2 text-left text-foreground hover:shadow-panel"
              >
                {ABOUT_STORY}
              </button>
              {/* Goes into the field, the author adds the topic («Чат с соавтором», «Исследовать тему»). */}
              <button
                type="button"
                onClick={() => data.askCoauthor(RESEARCH_START, "fill")}
                className="mt-1.5 w-full rounded-2xl bg-paper px-3 py-2 text-left text-foreground hover:shadow-panel"
              >
                Исследовать тему
              </button>
              <p className="mt-4 mb-1.5 text-xs font-semibold">
                Проверки наставника
              </p>
              <TooltipProvider delayDuration={400}>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {CHECKS.map((check) => (
                    <Tooltip key={check.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => void send(check.request, "check")}
                          className="rounded-full bg-paper px-3 py-1 text-caption text-foreground hover:shadow-panel"
                        >
                          {check.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        {check.request}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
              {/* The promise about the author's texts ends the empty conversation and goes with it, so
                  the field never moves (openspec/specs/web/workspace, «Обещание о текстах в чате»). */}
              <p className="mt-4 text-xs">
                {NO_TRAINING_SHORT}{" "}
                <a
                  href={offerUrl("materials")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Подробнее
                </a>
              </p>
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
                assistantMessage(m)
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
                  <>
                    <NoteOfFile
                      saved={savedNotes.get(a.key)}
                      onSave={() => void saveToNotes(a.key, a.id!)}
                      onOpen={(id) =>
                        navigate(docPath(openDraft, { kind: "note", id }))
                      }
                    />
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
                  </>
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
          <GrowingTextarea
            ref={field}
            variant="bare"
            minRows={1}
            limit={{ screen: 1 / 3 }}
            value={draft}
            placeholder={
              keyHints ? `${newLineKey}: новая строка` : "Напишите соавтору"
            }
            // Small and muted: the hint does not compete with the author's text; the field stays
            // one line, its height is set by the copy in the field's font.
            placeholderClassName="placeholder:text-xs placeholder:leading-6 placeholder:text-muted-foreground/45"
            aria-label="Сообщение соавтору"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="min-w-0 flex-1 py-1.5"
          />
          {keyHints ? (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                {/* The trigger wraps the button: a disabled button gets no pointer events. */}
                <TooltipTrigger asChild>
                  <span className="shrink-0">{sendButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                  Отправить
                  <span className="ml-2 text-muted-foreground">{sendKey}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            sendButton
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <ModeSwitch />
          <ChecksButton
            disabled={blocked}
            onPick={(text) => void send(text, "check")}
          />
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

/** «В заметки» of an attached file; after it, the link to the note. */
function NoteOfFile({
  saved,
  onSave,
  onOpen,
}: {
  /** undefined: not saved; null: being saved; a string: the id of the note. */
  saved: string | null | undefined;
  onSave: () => void;
  onOpen: (noteId: string) => void;
}) {
  if (typeof saved === "string")
    return (
      <button
        type="button"
        onClick={() => onOpen(saved)}
        className="inline-flex items-center gap-1 rounded-full px-1.5 text-primary hover:bg-accent"
      >
        <NotebookPen className="size-3.5" />в заметках
      </button>
    );
  return (
    <button
      type="button"
      disabled={saved === null}
      onClick={onSave}
      className="inline-flex items-center gap-1 rounded-full px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
    >
      <NotebookPen className="size-3.5" />
      {saved === null ? "сохраняем…" : "В заметки"}
    </button>
  );
}

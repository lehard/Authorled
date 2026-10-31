import { Check, Ellipsis, MessageSquare, RotateCcw, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import type { Identity } from "@/auth/authProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CommentMessage, CommentThread } from "@/data/model";

import { commentTime } from "./commentTime";

// The card of a comment thread and the list of threads (screenplay-comments, decisions 6 and 7).

/** Width of the thread card. */
export const CARD = 300;

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Message({
  m,
  own,
  first,
  onEdit,
  onDelete,
}: {
  m: CommentMessage;
  own: boolean;
  first: boolean;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <li className="grid gap-1">
      <div className="flex items-center gap-2">
        <Avatar name={m.author} />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px] font-semibold">
            {m.author}
          </b>
          <small className="block text-caption text-muted-foreground">
            {[m.role, commentTime(m.at)].filter((s) => s !== "").join(" · ")}
          </small>
        </span>
        {own && editing === null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Действия с комментарием"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(m.text)}>
                Изменить
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                {first ? "Удалить ветку…" : "Удалить"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {editing === null ? (
        <p className="ml-9 text-body whitespace-pre-wrap">{m.text}</p>
      ) : (
        <Compose
          className="ml-9"
          label="Изменить комментарий"
          initial={editing}
          submit="Сохранить"
          autoFocus
          onSubmit={(text) => {
            onEdit(text);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </li>
  );
}

function Compose({
  label,
  initial = "",
  submit,
  autoFocus,
  className,
  disabled,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: string;
  submit: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const field = useRef<HTMLTextAreaElement>(null);
  // Editing starts with the caret after the text, not before it.
  useEffect(() => {
    const el = field.current;
    if (autoFocus === true && el !== null)
      el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);
  const empty = text.trim() === "";
  const send = () => {
    if (empty || disabled) return;
    onSubmit(text.trim());
    setText("");
  };
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Textarea
        ref={field}
        aria-label={label}
        placeholder={label}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        className="min-h-10 bg-paper"
      />
      <div className="flex justify-end gap-1.5">
        {onCancel !== undefined && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <Button size="sm" disabled={empty || disabled} onClick={send}>
          {submit}
        </Button>
      </div>
    </div>
  );
}

export function ThreadCard({
  style,
  thread,
  quote,
  me,
  error,
  onClose,
  onSave,
  onReply,
  onEdit,
  onDeleteReply,
  onDeleteThread,
  onResolve,
}: {
  style: CSSProperties;
  /** Null for a new comment that is not saved yet. */
  thread: CommentThread | null;
  quote: string | undefined;
  me: Identity | undefined;
  error: string | null;
  onClose: () => void;
  onSave: (text: string) => void;
  onReply: (t: CommentThread, text: string) => void;
  onEdit: (t: CommentThread, id: string, text: string) => void;
  onDeleteReply: (t: CommentThread, id: string) => void;
  onDeleteThread: (t: CommentThread) => void;
  onResolve: (t: CommentThread, resolved: boolean) => void;
}) {
  const card = useRef<HTMLElement>(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  // Escape and a press outside the card and outside open places close it; menus and
  // dialogs of the card live in portals and do not count as outside.
  useEffect(() => {
    const inside = (target: EventTarget | null) =>
      target instanceof Element &&
      (card.current?.contains(target) === true ||
        target.closest(
          ".pw-comment-open, [data-radix-popper-content-wrapper], [role='alertdialog']",
        ) !== null);
    const down = (e: MouseEvent) => {
      if (!inside(e.target)) latestClose.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (
        document.querySelector("[role='menu'], [role='alertdialog']") !== null
      )
        return;
      latestClose.current();
    };
    // Under the fragment the card may start below the fold.
    card.current?.scrollIntoView({ block: "nearest" });
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, []);

  const messages = thread === null ? [] : [thread, ...thread.replies];
  return (
    <section
      ref={card}
      aria-label={thread === null ? "Новый комментарий" : "Ветка комментария"}
      style={style}
      className="absolute z-[9] grid gap-3 rounded-2xl bg-paper py-3 pr-3 pl-4 text-paper-foreground shadow-paper before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-full before:bg-deco-comment"
    >
      <header className="-mb-1 flex items-center gap-2 text-caption text-muted-foreground">
        <span className="flex-1">
          {thread === null ? "Новый комментарий" : "Комментарий"}
          {thread?.resolved === true && (
            <span className="ml-2 text-status-approved">решено</span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <blockquote className="line-clamp-2 border-l-2 border-border pl-2 text-caption text-muted-foreground">
        {quote ?? "Фрагмента в тексте нет"}
      </blockquote>
      {messages.length > 0 && (
        <ul className="grid gap-3">
          {messages.map((m, i) => (
            <Message
              key={m.id}
              m={m}
              first={i === 0}
              own={me !== undefined && m.email === me.email}
              onEdit={(text) => onEdit(thread!, m.id, text)}
              onDelete={() =>
                i === 0 ? onDeleteThread(thread!) : onDeleteReply(thread!, m.id)
              }
            />
          ))}
        </ul>
      )}
      {thread === null ? (
        <Compose
          label="Комментарий"
          submit="Сохранить"
          autoFocus
          disabled={me === undefined}
          onSubmit={onSave}
          onCancel={onClose}
        />
      ) : (
        <>
          <Compose
            label="Ответить"
            submit="Ответить"
            disabled={me === undefined}
            onSubmit={(text) => onReply(thread, text)}
          />
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {thread.resolved ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolve(thread, false)}
              >
                <RotateCcw />
                Вернуть в открытые
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolve(thread, true)}
              >
                <Check />
                Решено
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onDeleteThread(thread)}
            >
              Удалить пометку
            </Button>
          </div>
        </>
      )}
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

export function CommentList({
  threads,
  quotes,
  onPick,
}: {
  threads: CommentThread[];
  quotes: ReadonlyMap<string, string>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  // After a pick the thread card takes over: focus does not go back to the button.
  const picked = useRef(false);
  const count = threads.filter((t) => !t.resolved).length;
  const shown = all ? threads : threads.filter((t) => !t.resolved);
  let body: ReactNode;
  if (shown.length === 0) {
    body = (
      <p className="px-2 py-3 text-caption text-muted-foreground">
        {all ? "Комментариев пока нет." : "Открытых комментариев нет."}
      </p>
    );
  } else {
    body = (
      <ul className="grid gap-0.5">
        {shown.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`grid w-full gap-1 rounded-xl p-2.5 text-left hover:bg-accent ${t.resolved ? "opacity-60" : ""}`}
              onClick={() => {
                picked.current = true;
                setOpen(false);
                onPick(t.id);
              }}
            >
              <span className="truncate border-l-[3px] border-deco-comment pl-2 text-caption text-muted-foreground">
                {quotes.has(t.id)
                  ? `«${quotes.get(t.id)}»`
                  : "Фрагмента в тексте нет"}
              </span>
              <span className="line-clamp-2 text-body">{t.text}</span>
              <small className="text-caption text-muted-foreground">
                {[
                  t.author,
                  commentTime(t.at),
                  t.replies.length > 0 ? `ответов ${t.replies.length}` : "",
                  t.resolved ? "решено" : "",
                ]
                  .filter((s) => s !== "")
                  .join(" · ")}
              </small>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Комментарии: открытых ${count}`}
              className="shrink-0 gap-1 px-2 aria-expanded:bg-accent"
            >
              <MessageSquare />
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Комментарии</TooltipContent>
      </Tooltip>
      <PopoverContent
        onCloseAutoFocus={(e) => {
          if (picked.current) e.preventDefault();
          picked.current = false;
        }}
        align="end"
        className="grid max-h-[60vh] w-[min(340px,calc(100vw-24px))] gap-2 overflow-auto p-2"
      >
        <ToggleGroup
          type="single"
          size="sm"
          value={all ? "all" : "open"}
          onValueChange={(v) => {
            if (v === "all" || v === "open") setAll(v === "all");
          }}
          aria-label="Какие комментарии показать"
          className="justify-start"
        >
          <ToggleGroupItem value="open" className="rounded-full px-3">
            Открытые
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="rounded-full px-3">
            Все
          </ToggleGroupItem>
        </ToggleGroup>
        {body}
      </PopoverContent>
    </Popover>
  );
}

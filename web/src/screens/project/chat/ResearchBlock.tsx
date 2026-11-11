import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  NotebookPen,
} from "lucide-react";
import {
  isValidElement,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { useProjectData } from "../ProjectContext";
import { docPath } from "../docRef";
import { useNoteActions } from "../noteActions";

// A research brief the co-author wrote in its answer as a code block marked `research-brief`
// (openspec/specs/web/workspace, «Блок задания в чате», «Задание в заметки»). Nothing goes to the
// services from here: the author copies the text and opens the site, which gets no text in its address.

const MARK = "language-research-brief";

const RESEARCH_SERVICES = [
  { label: "Открыть Claude", url: "https://claude.ai/new" },
  { label: "Открыть ChatGPT", url: "https://chatgpt.com/" },
] as const;

/** The title of the note: the first line of the brief without its heading marks. */
function noteTitle(text: string): string {
  const first = text
    .split("\n", 1)[0]
    .replace(/^#+\s*/, "")
    .trim();
  return `Исследование: ${first}`;
}

function ResearchBlock({ text }: { text: string }) {
  const { project, draft } = useProjectData();
  const notes = useNoteActions(project.id);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error("The research brief was not copied:", err);
      setError(
        "Не удалось скопировать. Разверните задание и скопируйте текст вручную.",
      );
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      setSaved(await notes.add(noteTitle(text), text));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="my-2 grid gap-2">
      <div className="overflow-hidden rounded-lg border border-border bg-paper">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-caption text-muted-foreground">
          <span>Задание для Deep Research</span>
          <Button
            size="xs"
            variant="ghost"
            className="rounded-lg"
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Скопировано" : "Скопировать"}
          </Button>
        </div>
        <pre
          className={`rounded-none bg-transparent px-3 py-2 font-mono text-caption leading-relaxed whitespace-pre-wrap text-foreground ${open ? "max-h-[28rem] overflow-auto" : "max-h-40 overflow-hidden"}`}
        >
          {text}
        </pre>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-1 px-3 pt-1 pb-2 text-caption text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {open ? "Свернуть" : "Развернуть целиком"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {RESEARCH_SERVICES.map((service) => (
          <Button
            key={service.url}
            size="xs"
            variant="outline"
            className="rounded-lg"
            asChild
          >
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              // The answer's Markdown styles links; this one is a button.
              className="text-foreground no-underline"
            >
              <ExternalLink />
              {service.label}
            </a>
          </Button>
        ))}
        {saved === null ? (
          <Button
            size="xs"
            variant="outline"
            className="rounded-lg"
            disabled={saving}
            onClick={() => void save()}
          >
            <NotebookPen />
            Сохранить в заметки
          </Button>
        ) : (
          <Button size="xs" variant="ghost" className="rounded-lg" asChild>
            <Link
              to={docPath(draft, { kind: "note", id: saved })}
              className="text-foreground no-underline"
            >
              <Check />
              Сохранено в заметки
            </Link>
          </Button>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        В Claude включите Research, в ChatGPT — Deep research, и вставьте
        задание. Готовый отчёт загрузите в «Заметки». Задание уходит во внешний
        сервис: там действуют его правила хранения.
      </p>
    </div>
  );
}

type CodeProps = { className?: string; children?: unknown };

/** `pre` of the co-author's Markdown: a block marked `research-brief` is a brief, any other stays as it is. */
export function AnswerPre(props: ComponentProps<"pre"> & { node?: unknown }) {
  // react-markdown passes its tree node too; it is not a DOM attribute.
  const { node, children, ...rest } = props;
  void node;
  if (isValidElement(children)) {
    const code = children as ReactElement<CodeProps>;
    const raw = code.props.children;
    if (code.props.className === MARK && typeof raw === "string")
      return <ResearchBlock text={raw.replace(/\n$/, "")} />;
  }
  return <pre {...rest}>{children}</pre>;
}

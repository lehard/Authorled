import { Check, Copy, NotebookPen } from "lucide-react";
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
// (openspec/specs/web/workspace, «Блок задания в чате», «Задание в заметки»): one card with the topic, copy and
// «В заметки», a short preview and one line with links. Nothing goes to the services from here: the author copies
// the text and opens the site, which gets no text in its address.

const MARK = "language-research-brief";

const LINK = "text-foreground underline underline-offset-2 hover:text-ai";

/** The topic of the brief: its first line without the heading marks. */
function topicOf(text: string): string {
  return text
    .split("\n", 1)[0]
    .replace(/^#+\s*/, "")
    .trim();
}

function ResearchBlock({ text }: { text: string }) {
  const { project, draft } = useProjectData();
  const notes = useNoteActions(project.id);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topic = topicOf(text);
  const body = text.slice(text.indexOf("\n") + 1).trim();

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
      setSaved(await notes.add(`Исследование: ${topic}`, text));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="my-1 grid gap-1.5">
      <div className="overflow-hidden rounded-lg border border-border bg-paper">
        <div className="flex items-center gap-1 py-1 pr-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-caption font-medium text-foreground">
            {topic}
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={copied ? "Скопировано" : "Скопировать"}
            title={copied ? "Скопировано" : "Скопировать"}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          {saved === null ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="В заметки"
              title="В заметки"
              disabled={saving}
              onClick={() => void save()}
            >
              <NotebookPen />
            </Button>
          ) : (
            <Button size="icon-xs" variant="ghost" asChild>
              <Link
                to={docPath(draft, { kind: "note", id: saved })}
                aria-label="Сохранено в заметки, открыть"
                title="Сохранено в заметки, открыть"
                className="text-foreground no-underline"
              >
                <Check />
              </Link>
            </Button>
          )}
        </div>
        <pre
          className={`rounded-none bg-transparent px-3 pt-0 pb-1 font-mono text-caption leading-snug whitespace-pre-wrap text-muted-foreground ${open ? "max-h-[28rem] overflow-auto" : "max-h-[4.5rem] overflow-hidden"}`}
        >
          {body}
        </pre>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-3 pb-1.5 text-left text-caption text-muted-foreground hover:text-foreground"
        >
          {open ? "Свернуть" : "Развернуть"}
        </button>
      </div>
      <p className="text-caption text-muted-foreground">
        Вставьте промпт в{" "}
        <a
          href="https://claude.ai/new"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          Claude
        </a>{" "}
        или{" "}
        <a
          href="https://chatgpt.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          ChatGPT
        </a>{" "}
        и используйте Deep Research
      </p>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
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

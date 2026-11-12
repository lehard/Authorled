import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
} from "lucide-react";
import {
  isValidElement,
  useEffect,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProjectData } from "../ProjectContext";
import { docPath } from "../docRef";
import { useNoteActions } from "../noteActions";

// A research brief the co-author wrote in its answer as a code block marked `research-brief`
// (openspec/specs/web/workspace, «Блок задания в чате», «Задание в заметки»): one card with the topic, copy and
// «Сохранить в заметки», a fading preview with «Показать целиком», and one line with links. Nothing goes to the
// services from here: the author copies the text and opens the site, which gets no text in its address.

const MARK = "language-research-brief";
/** How long the check stays after a copy. */
const COPIED_MS = 2000;

const LINK = "text-foreground underline underline-offset-2 hover:text-ai";

/** The topic of the brief: its first line without the heading marks. */
function topicOf(text: string): string {
  return text
    .split("\n", 1)[0]
    .replace(/^#+\s*/, "")
    .trim();
}

/** An icon button of the card with its tooltip; the tooltip says what the label says. */
function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
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
  // What the card shows: the brief without its first line and without Markdown heading marks; the copy keeps
  // the text as the co-author wrote it.
  const body = text
    .slice(text.indexOf("\n") + 1)
    .trim()
    .replace(/^#{1,6}\s+/gm, "");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error("The research brief was not copied:", err);
      setError(
        "Не удалось скопировать. Покажите задание целиком и скопируйте текст вручную.",
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

  const copyLabel = copied ? "Скопировано" : "Скопировать задание";
  const saveLabel = saving ? "Сохраняю…" : "Сохранить в заметки";

  return (
    <div className="my-1 grid gap-1.5">
      <div className="overflow-hidden rounded-xl border border-border bg-paper">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5 border-b border-border py-1 pr-1 pl-3">
            <Tip label={topic}>
              <span className="min-w-0 flex-1 truncate text-caption font-medium text-foreground">
                {topic}
              </span>
            </Tip>
            <Tip label={copyLabel}>
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                aria-label={copyLabel}
                onClick={() => void copy()}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </Tip>
            {saved === null ? (
              <Tip label={saveLabel}>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={saveLabel}
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <BookmarkPlus />
                  )}
                </Button>
              </Tip>
            ) : (
              <Tip label="Сохранено в заметки — открыть">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-ai hover:text-ai"
                  asChild
                >
                  <Link
                    to={docPath(draft, { kind: "note", id: saved })}
                    aria-label="Сохранено в заметки — открыть"
                    className="no-underline"
                  >
                    <BookmarkCheck />
                  </Link>
                </Button>
              </Tip>
            )}
          </div>
        </TooltipProvider>
        <pre
          className={`rounded-none bg-transparent px-3 pt-2 pb-0 font-mono text-caption leading-snug whitespace-pre-wrap text-muted-foreground ${open ? "max-h-[28rem] overflow-auto" : "max-h-[4.5rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"}`}
        >
          {body}
        </pre>
        <Button
          size="xs"
          variant="ghost"
          className="mx-1.5 mb-1 text-muted-foreground hover:text-foreground"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronUp /> : <ChevronDown />}
          {open ? "Свернуть" : "Показать целиком"}
        </Button>
      </div>
      <p className="px-0.5 text-caption leading-snug text-muted-foreground">
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

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { useProjectData } from "../ProjectContext";
import { DownloadButton } from "../docs/NoteOriginal";
import { docPath } from "../docRef";
import type { Args } from "./actions";

// The card of a done research brief (openspec/specs/web/workspace, «Карточка задания на
// исследование», «Вложения задания на исследование»): the brief comes from the arguments of the
// call, the note from its result. Nothing goes to the services from here: the author copies the
// brief and opens the site, which gets no text in its address.

/** The services the card opens, without parameters, and where Deep Research is switched on there. */
const RESEARCH_SERVICES = [
  { label: "Открыть Claude", url: "https://claude.ai/new" },
  { label: "Открыть ChatGPT", url: "https://chatgpt.com/" },
] as const;
const SERVICES_HINT =
  "В Claude включите Research, в ChatGPT — Deep research, и вставьте задание.";

function noteIds(args: Args): string[] {
  const ids = args.note_ids;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

function Attachments({ args }: { args: Args }) {
  const data = useProjectData();
  const ids = noteIds(args);
  if (args.screenplay !== true && ids.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-caption font-medium">Приложите к запросу</p>
      {args.screenplay === true && (
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <Link
            to={docPath(data.draft, { kind: "part", part: "text" })}
            className="text-foreground underline underline-offset-2 hover:text-ai"
          >
            Открыть сценарий
          </Link>
          <span>и сохранить: «⋯» → «Экспорт» → Fountain</span>
        </div>
      )}
      {ids.map((id) => {
        const note = data.notes.find((n) => n.id === id);
        return note?.file == null ? (
          <p key={id} className="text-caption text-muted-foreground">
            Вложения нет
          </p>
        ) : (
          <div
            key={id}
            className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground"
          >
            <span className="min-w-0 truncate text-foreground">
              {note.file.name}
            </span>
            <DownloadButton file={note.file} />
          </div>
        );
      })}
    </div>
  );
}

export function ResearchCard({
  args,
  noteId,
  done,
}: {
  args: Args;
  /** The note of the brief, from the result of the call. */
  noteId: string;
  /** What was done, as the backend said it. */
  done: string;
}) {
  const data = useProjectData();
  const brief = typeof args.brief === "string" ? args.brief : "";
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
    } catch (err) {
      console.error("The research brief was not copied:", err);
      setError(
        "Не удалось скопировать. Откройте заметку и скопируйте текст оттуда.",
      );
    }
  }

  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-paper p-3 shadow-panel">
      <Link
        to={docPath(data.draft, { kind: "note", id: noteId })}
        className="font-medium text-foreground underline underline-offset-2 hover:text-ai"
      >
        {done}
      </Link>
      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Скопировано" : "Скопировать задание"}
        </Button>
        {RESEARCH_SERVICES.map((service) => (
          <Button key={service.url} size="xs" variant="outline" asChild>
            <a href={service.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {service.label}
            </a>
          </Button>
        ))}
      </div>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <p className="text-caption text-muted-foreground">{SERVICES_HINT}</p>
      <Attachments args={args} />
      <p className="text-caption text-muted-foreground">
        Задание и вложения уходят во внешний сервис: там действуют его правила
        хранения.
      </p>
      <p className="text-caption text-muted-foreground">
        Готовый отчёт загрузите в «Заметки» файлом или вставьте текстом в новую
        заметку — соавтор будет на него опираться.
      </p>
    </div>
  );
}

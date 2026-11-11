import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import type { NoteResearch } from "@/data/model";

import { useProjectData } from "../ProjectContext";
import { docPath } from "../docRef";
import { DownloadButton } from "./NoteOriginal";

// The head of a research brief over its text (openspec/specs/web/workspace, «Шапка заметки задания»,
// «Копирование задания», «Вложения в шапке задания»). Nothing goes to the services from here: the author
// copies the text of the field and opens the site, which gets no text in its address.

/** The services the head opens, without parameters. */
const RESEARCH_SERVICES = [
  { label: "Открыть Claude", url: "https://claude.ai/new" },
  { label: "Открыть ChatGPT", url: "https://chatgpt.com/" },
] as const;

function Attachments({ research }: { research: NoteResearch }) {
  const data = useProjectData();
  if (!research.screenplay && research.noteIds.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-caption font-medium">Приложите к запросу</p>
      {research.screenplay && (
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
      {research.noteIds.map((id) => {
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

export function ResearchHead({
  research,
  text,
}: {
  research: NoteResearch;
  /** The text of the field as it is now, with edits not saved yet. */
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error("The research brief was not copied:", err);
      setError(
        "Не удалось скопировать. Выделите текст задания и скопируйте его вручную.",
      );
    }
  }

  return (
    <div className="mx-auto mb-4 grid w-full max-w-[900px] gap-2 rounded-xl bg-paper p-3 shadow-panel">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" className="rounded-full" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Скопировано" : "Скопировать задание"}
        </Button>
        {RESEARCH_SERVICES.map((service) => (
          <Button
            key={service.url}
            size="sm"
            variant="outline"
            className="rounded-full"
            asChild
          >
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
      <p className="text-caption text-muted-foreground">
        В Claude включите Research, в ChatGPT — Deep research, и вставьте
        задание. Готовый отчёт загрузите в «Заметки».
      </p>
      <Attachments research={research} />
      <p className="text-caption text-muted-foreground">
        Задание и вложения уходят во внешний сервис: там действуют его правила
        хранения.
      </p>
    </div>
  );
}

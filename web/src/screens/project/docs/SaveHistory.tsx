import { History } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVersion, useVersions } from "@/data/hooks";
import type {
  VersionContent,
  VersionReason,
  VersionTarget,
} from "@/data/model";
import { useSaveActions } from "@/data/saves";
import { paragraphs, type ScreenplayDoc } from "@/editor/document.ts";

import { useProjectData } from "../ProjectContext";

const REASONS: Record<VersionReason, string> = {
  auto: "Автосохранение",
  suggestion: "Перед принятием предложения соавтора",
  import: "Перед импортом",
  restore: "Перед откатом",
  coauthor: "Перед правкой соавтора",
};

const when = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function plain(value: unknown): string[] {
  if (typeof value === "string") return value.trim() === "" ? [] : [value];
  if (typeof value === "object" && value !== null)
    return Object.values(value).flatMap(plain);
  return [];
}

/** A snapshot as text: the paragraphs of a screenplay, or the name and filled fields of a card. */
function Preview({ version }: { version: VersionContent }) {
  const lines =
    version.part === "text"
      ? paragraphs(version.content as ScreenplayDoc).map((p) => p.text)
      : plain([
          version.content.name,
          version.content.summary,
          version.content.fields,
        ]);
  return (
    <div className="grid gap-1.5 rounded-2xl bg-paper p-4 text-paper-foreground shadow-panel">
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Пусто</p>
      ) : (
        lines.map((line, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))
      )}
    </div>
  );
}

function Versions({ target }: { target: VersionTarget }) {
  const { draft, openFresh } = useProjectData();
  const { versions, query } = useVersions(target);
  const { restoreVersion } = useSaveActions();
  const [chosen, setChosen] = useState<string | null>(null);
  const { version, query: vq } = useVersion(chosen);
  const [error, setError] = useState<string | null>(null);

  async function restore(id: string) {
    setError(null);
    try {
      await restoreVersion(id, target);
      openFresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (query.isError)
    return (
      <p role="alert" className="text-destructive">
        {query.error.message}
      </p>
    );
  if (query.isPending) return <p>Загружаем…</p>;
  if (versions.length === 0)
    return (
      <p className="text-muted-foreground">
        Сохранений пока нет: они появятся, когда вы продолжите работу.
      </p>
    );
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1.5">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              aria-current={v.id === chosen ? "true" : undefined}
              onClick={() => setChosen(v.id)}
              className="grid w-full gap-0.5 rounded-2xl bg-paper px-4 py-2.5 text-left shadow-panel aria-current:ring-2 aria-current:ring-primary"
            >
              <b>{when.format(new Date(v.savedAt))}</b>
              <small className="text-caption text-muted-foreground">
                {v.savedByName} · {REASONS[v.reason]}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {vq.isError && (
        <p role="alert" className="text-destructive">
          {vq.error.message}
        </p>
      )}
      {chosen !== null && version?.id === chosen && (
        <>
          <Preview version={version} />
          <Button
            className="justify-self-start rounded-full"
            disabled={draft.locked}
            onClick={() => void restore(chosen)}
          >
            Восстановить
          </Button>
        </>
      )}
      {error !== null && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** «История сохранений» of a text or a card: snapshots, read-only view and rollback. */
export function SaveHistory({ target }: { target: VersionTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="История сохранений"
              onClick={() => setOpen(true)}
            >
              <History />
            </Button>
          </TooltipTrigger>
          <TooltipContent>История сохранений</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="gap-3 overflow-auto bg-panel p-4 sm:max-w-md"
        >
          <SheetTitle>История сохранений</SheetTitle>
          <SheetDescription>
            Откат вернёт только этот документ, остальной драфт не изменится.
          </SheetDescription>
          {open && <Versions target={target} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

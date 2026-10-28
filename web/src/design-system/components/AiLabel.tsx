import { cn } from "cn";
import { SparklesIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type AiSource = {
  /** Methodology code, e.g. "Д5". */
  code: string;
  title: string;
};

type AiLabelProps = {
  /** What the AI did, e.g. "Предложил формулировку темы". */
  action: string;
  /** Documents the AI relied on. */
  sources: AiSource[];
  /** When the author accepted it; absent while it is still a proposal. */
  acceptedAt?: Date;
  /** Who accepted it. */
  acceptedBy?: string;
  className?: string;
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Marks anything the AI proposed or created and explains where it came from. */
export function AiLabel({
  action,
  sources,
  acceptedAt,
  acceptedBy,
  className,
}: AiLabelProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded-4xl border border-ai-border bg-ai-subtle px-2 py-0.5 text-xs font-medium text-ai focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <SparklesIcon aria-hidden className="size-3" />
        ИИ
      </PopoverTrigger>
      <PopoverContent align="start" className="text-body">
        <p className="font-medium">{action}</p>
        {sources.length > 0 && (
          <div>
            <p className="text-caption text-muted-foreground">Опирался на</p>
            <ul className="list-disc pl-5">
              {sources.map((source) => (
                <li key={source.code}>
                  {source.code} · {source.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-caption text-muted-foreground">
          {acceptedAt === undefined
            ? "Предложение, автор ещё не принял"
            : `Принято${acceptedBy === undefined ? "" : ` · ${acceptedBy}`} · ${dateFormat.format(acceptedAt)}`}
        </p>
      </PopoverContent>
    </Popover>
  );
}

import { MessageSquare, Sparkles, X } from "lucide-react";
import { useRef, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Suggestion } from "@/data/model";

import { commentTime } from "./commentTime";
import { useCardDismiss } from "./useCardDismiss";

// The card of a co-author suggestion and the button that walks through them
// (coauthor-suggestions, decisions 6 and 7).

export function SuggestionCard({
  style,
  suggestion,
  old,
  error,
  onClose,
  onDiscuss,
  onDecide,
}: {
  style: CSSProperties;
  suggestion: Suggestion;
  /** The text it would replace. */
  old: string;
  error: string | null;
  onClose: () => void;
  onDiscuss: () => void;
  onDecide: (accept: boolean) => void;
}) {
  const card = useRef<HTMLElement>(null);
  useCardDismiss(card, onClose);
  return (
    <section
      ref={card}
      aria-label="Предложение соавтора"
      style={style}
      className="absolute z-[9] grid gap-3 rounded-2xl bg-paper py-3 pr-3 pl-4 text-paper-foreground shadow-paper before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-full before:bg-ai"
    >
      <header className="-mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
        <Sparkles className="size-4 text-ai" />
        <span className="flex-1">
          Предложение соавтора · {commentTime(suggestion.at)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Обсудить в чате"
              onClick={onDiscuss}
            >
              <MessageSquare />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Обсудить в чате</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <div className="grid gap-1 font-mono text-[13px] leading-normal">
        <del className="text-muted-foreground decoration-deco-delete">
          {old}
        </del>
        <ins className="rounded bg-ai-subtle px-1.5 py-0.5 no-underline">
          {suggestion.text === "" ? "(убрать фрагмент)" : suggestion.text}
        </ins>
      </div>
      <p className="text-caption text-muted-foreground">{suggestion.why}</p>
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => onDecide(false)}>
          Отклонить
        </Button>
        <Button size="sm" onClick={() => onDecide(true)}>
          Принять
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

export function SuggestionsButton({
  count,
  onNext,
}: {
  count: number;
  onNext: () => void;
}) {
  const none = count === 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Предложения соавтора: открытых ${count}`}
          // Not `disabled`: a disabled button shows no tooltip.
          aria-disabled={none}
          className="shrink-0 gap-1 px-2 aria-disabled:opacity-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!none) onNext();
          }}
        >
          <Sparkles className="text-ai" />
          {!none && <span className="tabular-nums">{count}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {none ? "Открытых предложений нет" : "Следующее предложение соавтора"}
      </TooltipContent>
    </Tooltip>
  );
}

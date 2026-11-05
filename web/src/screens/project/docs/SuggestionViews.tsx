import { MessageSquare, Sparkles, X } from "lucide-react";
import { useRef, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Suggestion } from "@/data/model";

import { commentTime } from "./commentTime";
import { useCardDismiss } from "./useCardDismiss";

// The card of a co-author suggestion and the button that walks through them
// (coauthor-suggestions, decisions 6 and 7), with the suggestions that have no place in the text.

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
  missing,
  onNext,
  onReject,
}: {
  /** Open suggestions with a shown place in the text. */
  count: number;
  /** Open suggestions whose anchor is not in the text (web/workspace, «Предложения без места в тексте»). */
  missing: Suggestion[];
  onNext: () => void;
  onReject: (s: Suggestion) => void;
}) {
  const none = count === 0;
  const label = `Предложения соавтора: открытых ${count}`;
  const icon = (
    <>
      <Sparkles className="text-ai" />
      {!none && <span className="tabular-nums">{count}</span>}
    </>
  );
  if (missing.length > 0)
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${label}, без места в тексте ${missing.length}`}
                className="shrink-0 gap-1 px-2 aria-expanded:bg-accent"
              >
                {icon}
                <span className="size-1.5 rounded-full bg-destructive" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Предложения соавтора</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          className="grid max-h-[60vh] w-[min(340px,calc(100vw-24px))] gap-2 overflow-auto p-2"
        >
          {!none && (
            <Button variant="outline" size="sm" onClick={onNext}>
              Следующее в тексте · {count}
            </Button>
          )}
          <h2 className="px-2 pt-1 text-caption font-medium text-muted-foreground">
            Нет места в тексте
          </h2>
          <ul className="grid gap-1">
            {missing.map((m) => (
              <li
                key={m.id}
                className="grid gap-1.5 rounded-xl bg-paper p-2.5 text-paper-foreground"
              >
                <div className="grid gap-1 font-mono text-[13px] leading-normal">
                  <del className="text-muted-foreground decoration-deco-delete">
                    {m.quote}
                  </del>
                  <ins className="rounded bg-ai-subtle px-1.5 py-0.5 no-underline">
                    {m.text === "" ? "(убрать фрагмент)" : m.text}
                  </ins>
                </div>
                <p className="text-caption text-muted-foreground">{m.why}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-end"
                  onClick={() => onReject(m)}
                >
                  Отклонить
                </Button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          // Not `disabled`: a disabled button shows no tooltip.
          aria-disabled={none}
          className="shrink-0 gap-1 px-2 aria-disabled:opacity-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!none) onNext();
          }}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {none ? "Открытых предложений нет" : "Следующее предложение соавтора"}
      </TooltipContent>
    </Tooltip>
  );
}

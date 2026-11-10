// The toolbar of the prose editor (openspec/specs/web/prose-editor, «Панель редактора прозы», «Счёт длины
// синопсиса»; design of synopsis-editor, decision 11): one row at any width of the column.
import {
  Bold,
  ChevronDown,
  Italic,
  Pilcrow,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { Command } from "prosemirror-state";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { PROSE_COMMANDS } from "./commands.ts";

export type ProseStyle = "heading1" | "heading2" | "paragraph";

/** What the toolbar draws for the caret of the editor. */
export type ProseSnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  style: ProseStyle;
  bold: boolean;
  italic: boolean;
};

const STYLES: { style: ProseStyle; label: string; keys: string }[] = [
  { style: "heading1", label: "Заголовок 1", keys: "⌥⌘1" },
  { style: "heading2", label: "Заголовок 2", keys: "⌥⌘2" },
  { style: "paragraph", label: "Текст", keys: "⌥⌘0" },
];

const STYLE_LABEL: Record<ProseStyle, string> = {
  heading1: "Заголовок 1",
  heading2: "Заголовок 2",
  paragraph: "Текст",
};

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

function Tool({
  icon: Icon,
  label,
  keys,
  pressed,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  keys: string;
  pressed?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          className="shrink-0 aria-pressed:bg-accent aria-pressed:text-primary"
          // Keeps the caret in the text: the button does not take focus on click.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <span className="ml-2 text-muted-foreground">{keys}</span>
      </TooltipContent>
    </Tooltip>
  );
}

const number = (value: number) => value.toLocaleString("ru-RU");

export function ProseToolbar({
  ref,
  snap,
  readOnly,
  pages,
  words,
  chars,
  run,
}: {
  ref: Ref<HTMLDivElement>;
  snap: ProseSnapshot | null;
  readOnly: boolean;
  /** Pages of the layout; null until the first layout is ready. */
  pages: number | null;
  words: number | null;
  chars: number | null;
  run: (command: Command) => void;
}) {
  const off = readOnly || snap === null;
  const style = snap?.style ?? "paragraph";
  const count =
    pages === null || words === null || chars === null
      ? null
      : `Слов: ${number(words)}, знаков с пробелами: ${number(chars)}, страниц: ${number(pages)}`;
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Инструменты синопсиса"
      className="@container sticky top-0 z-10 mx-auto mb-3 flex w-[min(100%,760px)] items-center gap-0.5 rounded-2xl bg-panel px-1.5 py-1 shadow-panel"
    >
      <Tool
        icon={Undo2}
        label="Отменить"
        keys="⌘Z"
        disabled={readOnly || snap === null || !snap.canUndo}
        onClick={() => run(PROSE_COMMANDS.undo)}
      />
      <Tool
        icon={Redo2}
        label="Повторить"
        keys="⇧⌘Z"
        disabled={readOnly || snap === null || !snap.canRedo}
        onClick={() => run(PROSE_COMMANDS.redo)}
      />
      <Divider />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={off}
                aria-label={`Стиль абзаца: ${STYLE_LABEL[style]}`}
                className="shrink-0 justify-start gap-1.5 px-2"
              >
                <Pilcrow className="text-muted-foreground" />
                <span className="@max-[420px]:hidden">
                  {STYLE_LABEL[style]}
                </span>
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{`Стиль абзаца: ${STYLE_LABEL[style]}`}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-56">
          {STYLES.map((item) => (
            <DropdownMenuItem
              key={item.style}
              aria-current={item.style === style ? "true" : undefined}
              className={item.style === style ? "font-semibold" : undefined}
              onSelect={() => run(PROSE_COMMANDS[item.style])}
            >
              {item.label}
              <DropdownMenuShortcut>{item.keys}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />
      <Tool
        icon={Bold}
        label="Жирный"
        keys="⌘B"
        pressed={snap?.bold ?? false}
        disabled={off}
        onClick={() => run(PROSE_COMMANDS.bold)}
      />
      <Tool
        icon={Italic}
        label="Курсив"
        keys="⌘I"
        pressed={snap?.italic ?? false}
        disabled={off}
        onClick={() => run(PROSE_COMMANDS.italic)}
      />
      <span className="flex-1" />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={count === null}
                aria-label={
                  count === null
                    ? "Считаем страницы"
                    : `Длина синопсиса. ${count}`
                }
                className="shrink-0 px-2 text-muted-foreground tabular-nums"
              >
                {pages === null
                  ? "… стр."
                  : pages === 0
                    ? "0 стр."
                    : `≈ ${number(pages)} стр.`}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {count !== null && <TooltipContent>{count}</TooltipContent>}
        </Tooltip>
        {count !== null && (
          <PopoverContent align="end" className="w-64 text-caption">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Слов</dt>
              <dd className="tabular-nums">{number(words ?? 0)}</dd>
              <dt className="text-muted-foreground">Знаков с пробелами</dt>
              <dd className="tabular-nums">{number(chars ?? 0)}</dd>
              <dt className="text-muted-foreground">Страниц A4</dt>
              <dd className="tabular-nums">{number(pages ?? 0)}</dd>
            </dl>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

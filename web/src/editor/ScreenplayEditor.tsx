import {
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Focus,
  Layers,
  Pilcrow,
  Redo2,
  Replace,
  Search,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Node } from "prosemirror-model";

import { toJSON, toNode } from "./document.ts";
import {
  elementsOf,
  ELEMENTS,
  FIND_SCOPES,
  ScreenplayEditorView,
  type CardGapPlace,
  type CommentAnchor,
  type EditorMode,
  type EditorSnapshot,
  type FindScope,
  type ScreenplayDoc,
  type SuggestData,
  type SuggestionAnchor,
  type TitlePage,
} from "./index.ts";
import "./styles.css";

/** What the screen can ask of the editor. */
export type ScreenplayEditorHandle = {
  toFountain(): string;
  toFDX(): string;
  print(titlePage: TitlePage): void;
  /** Replaces the whole text (an import); undo brings the previous one back. */
  replace(doc: Node): void;
  focus(): void;
  /** Puts the caret at scene `number`; false when there is no such scene. */
  goToScene(number: number): boolean;
  /** Removes every place of a comment thread from the text, outside undo. */
  removeComment(id: string): void;
  commentAnchor(id: string): CommentAnchor | null;
  /** A gap under the paragraph of comment or suggestion `id` for its card (web/workspace, «Карточки у текста»). */
  showCardGap(id: string, height: number): CardGapPlace | null;
  hideCardGap(id: string): void;
  scrollToComment(id: string): boolean;
  /** Marks open suggestions without a place by their anchors (web/workspace, «Предложение по якорю»). */
  placeSuggestions(anchors: SuggestionAnchor[]): void;
  /** Marks co-author comments without a place by their anchors (web/workspace, «Комментарий соавтора по якорю»). */
  placeComments(anchors: SuggestionAnchor[]): void;
  acceptSuggestion(id: string, text: string): boolean;
  rejectSuggestion(id: string): boolean;
  suggestionAnchor(id: string): CommentAnchor | null;
  scrollToSuggestion(id: string): boolean;
  selectSuggestion(id: string): boolean;
};

/** Co-author suggestions of the text (coauthor-suggestions, decisions 2 and 6). */
export type EditorSuggestions = {
  /** Open suggestions: id → suggested text. */
  open: Record<string, string>;
  /** The suggestion whose card is open. */
  active: string | null;
  /** A click on an open suggestion. */
  onOpen: (id: string) => void;
  /** Suggestions with a shown place and their old text, in text order, after every change. */
  onPlaces: (places: [id: string, old: string][]) => void;
  /** Ids of every suggestion with a mark in the text, after every change. */
  onMarked: (ids: string[]) => void;
};

/** Comment threads of the text (screenplay-comments, decisions 4 and 5). */
export type EditorComments = {
  /** Highlighted threads: open ones and the one being written. */
  open: string[];
  /** The thread whose card is open. */
  active: string | null;
  /** «Комментировать»: the selection already carries the mark of new thread `id`. */
  onNew: (id: string) => void;
  /** A click on an open thread's place. */
  onOpen: (id: string) => void;
  /** Commented words by thread, after every change of the text. */
  onQuotes: (quotes: ReadonlyMap<string, string>) => void;
};

/**
 * The screenplay editor in React: one ProseMirror view per mount, destroyed on unmount; a new
 * `doc` from outside replaces the text only when it differs from what the author has typed.
 * Above the page, the text toolbar of mockup v2 (screenplay-text-tools, decision 10).
 */
export function ScreenplayEditor({
  mode,
  doc,
  onChange,
  readOnly = false,
  suggestData,
  onScene,
  comments,
  suggestions,
  tools,
  menu,
  overlay,
  ref,
}: {
  /** Fixed for the life of the component: give the component a new `key` to switch. */
  mode: EditorMode;
  doc: ScreenplayDoc;
  onChange?: (doc: ScreenplayDoc) => void;
  readOnly?: boolean;
  /** Names for autocomplete: characters and locations of the story. */
  suggestData?: SuggestData;
  /** Number of the scene with the caret. */
  onScene?: (scene: number | null) => void;
  /** Comments; fixed for the life of the component whether they are given. */
  comments?: EditorComments;
  suggestions?: EditorSuggestions;
  /** Buttons at the end of the toolbar, before «⋯». */
  tools?: ReactNode;
  /** Items of the «⋯» menu at the end of the toolbar. */
  menu?: ReactNode;
  /** Drawn over the page area, positioned against it (comment cards). */
  overlay?: ReactNode;
  ref?: Ref<ScreenplayEditorHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const editor = useRef<ScreenplayEditorView | null>(null);
  const [snap, setSnap] = useState<EditorSnapshot | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  // The latest props, read by the editor's callbacks and the first mount.
  const latest = useRef({
    mode,
    doc,
    onChange,
    onScene,
    comments,
    suggestions,
  });
  // Texts this editor has reported: a saved copy coming back is an echo, not a change from
  // outside, even when the author has typed on since (an older echo must not undo typing).
  const reported = useRef<string[]>([]);
  useEffect(() => {
    latest.current = { mode, doc, onChange, onScene, comments, suggestions };
  });

  useEffect(() => {
    if (host.current === null)
      throw new Error("ScreenplayEditor: нет контейнера");
    const view = new ScreenplayEditorView({
      container: host.current,
      mode: latest.current.mode,
      doc: latest.current.doc,
      onChange: (next) => {
        reported.current = [
          ...reported.current.slice(-49),
          JSON.stringify(next),
        ];
        latest.current.onChange?.(next);
      },
      onState: setSnap,
      onCommentRequest:
        latest.current.comments === undefined
          ? undefined
          : () => {
              const id = crypto.randomUUID();
              if (view.addComment(id)) latest.current.comments?.onNew(id);
            },
      onCommentOpen: (id) => latest.current.comments?.onOpen(id),
      onSuggestionOpen: (id) => latest.current.suggestions?.onOpen(id),
      onFindRequest: () => {
        setFindOpen(true);
        // The bar may be open already: focus its field either way.
        requestAnimationFrame(() => findInput.current?.select());
      },
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);

  // The toolbar wraps on a narrow column and grows with the find bar: the editor keeps the
  // scrolled-to line below its current height.
  useEffect(() => {
    const view = editor.current;
    const bar = toolbar.current;
    if (view === null || bar === null)
      throw new Error(
        "ScreenplayEditor: нет редактора или панели инструментов",
      );
    const inset = new ResizeObserver(() => view.setTopInset(bar.offsetHeight));
    inset.observe(bar);
    return () => inset.disconnect();
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (view === null) return;
    // Normalised through the schema: key order of the incoming JSON may differ.
    const json = JSON.stringify(toJSON(toNode(doc)));
    if (reported.current.includes(json) || json === JSON.stringify(view.json))
      return;
    view.load(doc);
  }, [doc]);

  useEffect(() => {
    editor.current?.setReadOnly(readOnly);
  }, [readOnly]);

  useEffect(() => {
    if (suggestData !== undefined) editor.current?.setSuggestData(suggestData);
  }, [suggestData]);

  const openKey = comments?.open.join("\n");
  const active = comments?.active;
  useEffect(() => {
    if (openKey === undefined || active === undefined) return;
    editor.current?.setComments({
      open: openKey === "" ? [] : openKey.split("\n"),
      active,
    });
  }, [openKey, active]);

  const quotes = snap?.comments;
  useEffect(() => {
    if (quotes !== undefined) latest.current.comments?.onQuotes(quotes);
  }, [quotes]);

  // Compared as JSON: a new object with the same suggestions is not a change.
  const openSuggestions =
    suggestions === undefined ? undefined : JSON.stringify(suggestions.open);
  const activeSuggestion = suggestions?.active;
  useEffect(() => {
    if (openSuggestions === undefined || activeSuggestion === undefined) return;
    editor.current?.setSuggestions({
      open: JSON.parse(openSuggestions) as Record<string, string>,
      active: activeSuggestion,
    });
  }, [openSuggestions, activeSuggestion]);

  const marked = snap === null ? undefined : snap.marked.join("\n");
  useEffect(() => {
    if (marked !== undefined)
      latest.current.suggestions?.onMarked(
        marked === "" ? [] : marked.split("\n"),
      );
  }, [marked]);

  const places = snap === null ? undefined : JSON.stringify(snap.suggestions);
  useEffect(() => {
    if (places !== undefined)
      latest.current.suggestions?.onPlaces(
        JSON.parse(places) as [string, string][],
      );
  }, [places]);

  const scene = snap?.scene ?? null;
  useEffect(() => {
    latest.current.onScene?.(scene);
  }, [scene]);

  useImperativeHandle(ref, () => {
    const view = () => {
      if (editor.current === null)
        throw new Error("Редактор сценария ещё не открыт");
      return editor.current;
    };
    return {
      toFountain: () => view().toFountain(),
      toFDX: () => view().toFDX(),
      print: (titlePage) => view().print(titlePage),
      replace: (next) => view().replace(next),
      focus: () => view().focus(),
      goToScene: (number) => view().goToScene(number),
      removeComment: (id) => view().removeComment(id),
      commentAnchor: (id) => view().commentAnchor(id),
      showCardGap: (id, height) => view().showCardGap(id, height),
      hideCardGap: (id) => view().hideCardGap(id),
      scrollToComment: (id) => view().scrollToComment(id),
      placeSuggestions: (anchors) => view().placeSuggestions(anchors),
      placeComments: (anchors) => view().placeComments(anchors),
      acceptSuggestion: (id, text) => view().acceptSuggestion(id, text),
      rejectSuggestion: (id) => view().rejectSuggestion(id),
      suggestionAnchor: (id) => view().suggestionAnchor(id),
      scrollToSuggestion: (id) => view().scrollToSuggestion(id),
      selectSuggestion: (id) => view().selectSuggestion(id),
    };
  }, []);

  const element = snap?.element ?? null;
  const showBeats = snap?.view.showBeats ?? false;
  const isolate = snap?.view.isolate ?? false;

  function closeFind() {
    setFindOpen(false);
    editor.current?.closeFind();
    editor.current?.focus();
  }

  return (
    <TooltipProvider delayDuration={500}>
      <div className="grid gap-3">
        {/* Stuck at the very top of the scrolling column: with a gap above, the text scrolled
            past showed through it. A container: the tools follow the width of the toolbar, which
            the chat narrows too, not the width of the window.
            The narrow toolbar starts below 512px, the one width in every `@max-[512px]` and
            `@min-[512px]` here: the wide row needs 510px with the longest type «Описание
            действия» and counters at 999 (measured 2026-11-09, tmp/VERIFY.md). Below it the type
            is an icon and the views move to «⋯», so the tools always stay in one row. */}
        <div
          ref={toolbar}
          className="@container sticky top-0 z-10 mx-auto grid w-full max-w-[816px] gap-1 rounded-2xl bg-panel px-1.5 py-1 shadow-panel"
        >
          <div
            role="toolbar"
            aria-label="Инструменты текста"
            className="flex min-w-0 items-center gap-0.5"
          >
            <Tool
              icon={Undo2}
              label="Отменить"
              keys="⌘Z"
              disabled={readOnly || !snap?.canUndo}
              onClick={() => editor.current?.undo()}
            />
            <Tool
              icon={Redo2}
              label="Повторить"
              keys="⇧⌘Z"
              disabled={readOnly || !snap?.canRedo}
              onClick={() => editor.current?.redo()}
            />
            <Divider />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={readOnly || element === null}
                      aria-label={`Тип абзаца: ${element === null ? "нет" : ELEMENTS[element].label}`}
                      className="shrink-0 justify-start gap-1.5 px-2"
                    >
                      <Pilcrow className="text-muted-foreground" />
                      <span className="@max-[512px]:hidden">
                        {element === null
                          ? "Тип абзаца"
                          : ELEMENTS[element].label}
                      </span>
                      <ChevronDown className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {/* Names the type at every width: the narrow toolbar shows only the icon. */}
                <TooltipContent>
                  {element === null
                    ? "Тип абзаца"
                    : `Тип абзаца: ${ELEMENTS[element].label}`}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                className="w-72"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  editor.current?.focus();
                }}
              >
                {elementsOf(mode).map((name) => (
                  <DropdownMenuItem
                    key={name}
                    aria-current={name === element ? "true" : undefined}
                    className={name === element ? "font-semibold" : undefined}
                    onSelect={() => editor.current?.setElement(name)}
                  >
                    {ELEMENTS[name].label}
                    <DropdownMenuShortcut>
                      {ELEMENTS[name].shortcut}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Divider />
            {mode === "text" && (
              <Tool
                icon={Layers}
                label="Показать биты"
                pressed={showBeats}
                className="@max-[512px]:hidden"
                onClick={() =>
                  editor.current?.setView({ showBeats: !showBeats })
                }
              />
            )}
            <Tool
              icon={Search}
              label="Найти и заменить"
              keys="⌘F"
              pressed={findOpen}
              onClick={() => {
                if (findOpen) closeFind();
                else {
                  setFindOpen(true);
                  requestAnimationFrame(() => findInput.current?.select());
                }
              }}
            />
            <Tool
              icon={Focus}
              label="Только текущая сцена"
              pressed={isolate}
              className="@max-[512px]:hidden"
              onClick={() => editor.current?.setView({ isolate: !isolate })}
            />
            {/* The review tools and «⋯» stay together at the right. Two «⋯» buttons, one shown
                at a time: the menus open in a portal, out of reach of the container query, so
                the narrow one carries the views itself. */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {tools}
              {menu !== undefined && (
                <MoreMenu
                  hint="Импорт, экспорт, печать"
                  className="@max-[512px]:hidden"
                >
                  {menu}
                </MoreMenu>
              )}
              <MoreMenu
                hint={
                  mode === "text"
                    ? "Виды, импорт, экспорт, печать"
                    : "Только текущая сцена"
                }
                className="@min-[512px]:hidden"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  editor.current?.focus();
                }}
              >
                {mode === "text" && (
                  <DropdownMenuCheckboxItem
                    checked={showBeats}
                    onCheckedChange={(on) =>
                      editor.current?.setView({ showBeats: on })
                    }
                  >
                    <Layers />
                    Показать биты
                  </DropdownMenuCheckboxItem>
                )}
                <DropdownMenuCheckboxItem
                  checked={isolate}
                  onCheckedChange={(on) =>
                    editor.current?.setView({ isolate: on })
                  }
                >
                  <Focus />
                  Только текущая сцена
                </DropdownMenuCheckboxItem>
                {menu !== undefined && (
                  <>
                    <DropdownMenuSeparator />
                    {menu}
                  </>
                )}
              </MoreMenu>
            </div>
          </div>
          {findOpen && snap !== null && (
            <FindBar
              inputRef={findInput}
              find={snap.find}
              editor={editor}
              onClose={closeFind}
            />
          )}
        </div>
        <div className="relative">
          <div ref={host} className="pw-editor" />
          {overlay}
          {snap?.suggest != null && (
            <SuggestList
              list={snap.suggest}
              onPick={(i) => editor.current?.pickSuggestion(i)}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

/** «⋯» at the end of the toolbar with its menu. */
function MoreMenu({
  hint,
  className,
  onCloseAutoFocus,
  children,
}: {
  hint: string;
  className: string;
  onCloseAutoFocus?: (e: Event) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ещё действия"
              className={className}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Tool({
  icon: Icon,
  label,
  keys,
  pressed,
  disabled,
  className,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  keys?: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
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
          className={`shrink-0 aria-pressed:bg-accent aria-pressed:text-primary ${className ?? ""}`}
          // Keeps the caret in the text: the button does not take focus on click.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {keys !== undefined && (
          <span className="ml-2 text-muted-foreground">{keys}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function FindBar({
  inputRef,
  find,
  editor,
  onClose,
}: {
  inputRef: Ref<HTMLInputElement>;
  find: EditorSnapshot["find"];
  editor: RefObject<ScreenplayEditorView | null>;
  onClose: () => void;
}) {
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacement, setReplacement] = useState("");
  const step = (d: number) => {
    if (find.count > 0)
      editor.current?.find({
        current: (find.current + d + find.count) % find.count,
      });
  };
  return (
    <div
      role="search"
      aria-label="Найти и заменить"
      className="grid gap-1.5 border-t border-border px-1 pt-1.5 pb-1"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          ref={inputRef}
          autoFocus
          aria-label="Найти"
          placeholder="Найти"
          value={find.query}
          onChange={(e) =>
            editor.current?.find({ query: e.target.value, current: 0 })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          className="h-8 min-w-36 flex-1"
        />
        <Select
          value={find.scope}
          onValueChange={(scope) =>
            editor.current?.find({ scope: scope as FindScope, current: 0 })
          }
        >
          <SelectTrigger size="sm" aria-label="Где искать" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FIND_SCOPES) as FindScope[]).map((s) => (
              <SelectItem key={s} value={s}>
                {FIND_SCOPES[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          role="status"
          className="min-w-14 text-center text-caption text-muted-foreground tabular-nums"
        >
          {find.query === ""
            ? ""
            : find.count === 0
              ? "нет"
              : `${find.current + 1} из ${find.count}`}
        </span>
        <Tool
          icon={ChevronUp}
          label="Предыдущее"
          keys="⇧Enter"
          onClick={() => step(-1)}
        />
        <Tool
          icon={ChevronDown}
          label="Следующее"
          keys="Enter"
          onClick={() => step(1)}
        />
        <Tool
          icon={Replace}
          label="Заменить"
          pressed={replaceOpen}
          onClick={() => setReplaceOpen((o) => !o)}
        />
        <Tool icon={X} label="Закрыть поиск" keys="Esc" onClick={onClose} />
      </div>
      {replaceOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            aria-label="Заменить на"
            placeholder="Заменить на"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            className="h-8 min-w-36 flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={find.count === 0}
            onClick={() => editor.current?.replaceCurrent(replacement)}
          >
            Заменить
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={find.count === 0}
            onClick={() => editor.current?.replaceAll(replacement)}
          >
            Заменить все
          </Button>
        </div>
      )}
    </div>
  );
}

function SuggestList({
  list,
  onPick,
}: {
  list: NonNullable<EditorSnapshot["suggest"]>;
  onPick: (index: number) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label={list.head}
      className="absolute z-20 grid w-72 gap-0.5 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-panel"
      style={{ left: list.left, top: list.bottom + 4 }}
      // The caret stays in the text: picking with the mouse does not take focus.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1 text-caption text-muted-foreground">
        {list.head} · Enter или Tab — выбрать
      </div>
      {list.items.map((item, i) => (
        <button
          key={item.insert}
          type="button"
          role="option"
          aria-selected={i === list.index}
          className="flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-body aria-selected:bg-accent"
          onClick={() => onPick(i)}
        >
          {item.label}
          {item.hint !== undefined && (
            <small className="text-caption text-muted-foreground">
              {item.hint}
            </small>
          )}
        </button>
      ))}
    </div>
  );
}

import {
  AlignLeft,
  Clapperboard,
  Globe,
  MapPin,
  Quote,
  Search,
  StickyNote,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";

import { Input } from "@/components/ui/input";
import { SCRIPT_PARTS, type EntityKind } from "@/data/model";
import { useStorySearch, type SearchSnippet } from "@/data/search";
import { TruncatedText } from "@/design-system";

import { docPath, type DocRef } from "./docRef";
import { useProjectData } from "./ProjectContext";

// Search of the story in the navigator (openspec/specs/web/workspace, «Поиск по истории в навигаторе»,
// «Результаты поиска по истории», «Переход к совпадению из поиска по истории»; design of project-search,
// decisions 7 and 8). The core finds and cuts; here the results are only shown and linked.

const ENTITY_ICON: Record<EntityKind, LucideIcon> = {
  char: User,
  loc: MapPin,
  world: Globe,
};

/** The field under the head of the navigator; ⌘K puts the caret here, Esc and the cross clear it. */
export function StorySearchField() {
  const { searchText, setSearchText, searchFocusAsked, searchFocusTaken } =
    useProjectData();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!searchFocusAsked) return;
    input.current?.focus();
    input.current?.select();
    searchFocusTaken();
  }, [searchFocusAsked, searchFocusTaken]);
  // Esc in the field clears it and brings the tree back. The sheet of a narrow screen catches Esc on
  // the document before the field and closes, so the field listens on the window, which comes first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const field = input.current;
      if (e.key !== "Escape" || field === null) return;
      if (document.activeElement !== field || field.value === "") return;
      // No preventDefault: the sheet still closes, as the spec says (web/workspace, «Esc на узком экране»).
      setSearchText("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setSearchText]);
  return (
    <div className="relative mx-2 mb-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={input}
        type="search"
        aria-label="Поиск по истории"
        placeholder="Поиск по истории"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="rounded-full pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {searchText !== "" && (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => {
            setSearchText("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function Piece({ snippet }: { snippet: SearchSnippet }) {
  return (
    <span className="line-clamp-2 text-caption text-muted-foreground">
      {snippet.before}
      <mark className="rounded-sm bg-(--deco-comment-subtle) text-foreground">
        {snippet.match}
      </mark>
      {snippet.after}
    </span>
  );
}

function Hit({
  to,
  icon: Icon,
  label,
  count,
  snippet,
  onNavigate,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count: number;
  snippet: SearchSnippet;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        to={to}
        onClick={onNavigate}
        className="tree-item grid! grid-cols-[minmax(0,1fr)] gap-0.5 px-3 py-2"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" />
          <TruncatedText className="min-w-0 flex-1 font-medium">
            {label}
          </TruncatedText>
          {count > 1 && (
            <small
              className="text-xs text-muted-foreground tabular-nums"
              aria-label={`совпадений: ${count}`}
            >
              {count}
            </small>
          )}
        </span>
        <Piece snippet={snippet} />
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <h3 className="px-3 pt-3 pb-1 text-caption font-semibold text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-0.5">{children}</ul>
    </li>
  );
}

/** Results instead of the tree, grouped as scenes, documents and notes. */
export function StorySearchResults({ onNavigate }: { onNavigate: () => void }) {
  const { draft, script, searchText } = useProjectData();
  const { result, error, pending } = useStorySearch(draft.id, searchText);
  const link = (ref: DocRef, params: Record<string, string>) =>
    `${docPath(draft, ref)}?${new URLSearchParams(params).toString()}`;

  let body: ReactNode;
  if (error)
    body = (
      <p role="alert" className="px-3 py-2 text-caption text-destructive">
        {error.message}
      </p>
    );
  else if (result === undefined)
    body = (
      <p className="px-3 py-2 text-caption text-muted-foreground">Ищем…</p>
    );
  else {
    const find = result.query;
    // A part the author hid in «История» has no screen to open (web/workspace, «Навигатор»).
    const scenes = script.show.text ? result.scenes : [];
    const documents = result.documents.filter(
      (d) => d.type === "entity" || script.show[d.part],
    );
    if (
      scenes.length === 0 &&
      documents.length === 0 &&
      result.notes.length === 0
    )
      body = (
        <p className="px-3 py-2 text-caption text-muted-foreground">
          Ничего не нашлось
        </p>
      );
    else
      body = (
        <ul aria-label="Результаты поиска" className="grid gap-1">
          {scenes.length > 0 && (
            <Group title="Сцены">
              {scenes.map((s) => (
                <Hit
                  key={s.uid ?? "outside"}
                  to={link(
                    { kind: "part", part: "text" },
                    s.uid === null
                      ? { find }
                      : { scene: String(s.number), find },
                  )}
                  icon={Clapperboard}
                  label={
                    s.uid === null
                      ? "Вне сцен"
                      : `${s.number}. ${s.heading.trim() === "" ? "Без заголовка" : s.heading}`
                  }
                  count={s.count}
                  snippet={s.snippet}
                  onNavigate={onNavigate}
                />
              ))}
            </Group>
          )}
          {documents.length > 0 && (
            <Group title="Документы">
              {documents.map((d) =>
                d.type === "entity" ? (
                  <Hit
                    key={d.id}
                    to={link(
                      { kind: "entity", entity: d.entity, id: d.id },
                      { find, field: d.field },
                    )}
                    icon={ENTITY_ICON[d.entity]}
                    label={d.name}
                    count={d.count}
                    snippet={d.snippet}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <Hit
                    key={d.part}
                    to={link({ kind: "part", part: d.part }, { find })}
                    icon={d.part === "logline" ? Quote : AlignLeft}
                    label={SCRIPT_PARTS[d.part]}
                    count={d.count}
                    snippet={d.snippet}
                    onNavigate={onNavigate}
                  />
                ),
              )}
            </Group>
          )}
          {result.notes.length > 0 && (
            <Group title="Заметки">
              {result.notes.map((n) => (
                <Hit
                  key={n.id}
                  to={link(
                    { kind: "note", id: n.id },
                    { find, field: n.field },
                  )}
                  icon={StickyNote}
                  label={n.title}
                  count={n.count}
                  snippet={n.snippet}
                  onNavigate={onNavigate}
                />
              ))}
            </Group>
          )}
        </ul>
      );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto px-2 pb-2" aria-busy={pending}>
      {body}
    </div>
  );
}

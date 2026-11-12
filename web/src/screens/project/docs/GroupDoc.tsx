import { ChevronRight, Plus, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Entity, EntityKind, Role } from "@/data/model";
import { ROLES } from "@/data/profiles";
import { foldText } from "@/editor/fold.ts";
import { NameDialog } from "@/screens/shared/NameDialog";

import { docPath, ENTITY_WORDS } from "../docRef";
import { useEntityActions } from "../entityActions";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

const EMPTY: Record<EntityKind, string> = {
  char: "Добавьте персонажей истории: у каждого будет свой профиль.",
  loc: "Добавьте места, где происходит действие.",
  world: "Миры описывают правила и устройство вашей истории.",
};

type RoleKind = "char" | "loc";
type RoleGroup = { role: Role; title: string; items: Entity[] };

/** Documents of a list by role, in the order of `ROLES`; empty groups are left out (web/workspace). */
function roleGroups(kind: RoleKind, list: Entity[]): RoleGroup[] {
  const roles = ROLES[kind];
  for (const x of list) {
    const role = "role" in x ? x.role : undefined;
    if (!roles.some((r) => r.value === role))
      throw new Error(`Неизвестная роль «${String(role)}» у «${x.name}».`);
  }
  return roles
    .map((r) => ({
      role: r.value,
      title: r.group,
      items: list.filter((x) => "role" in x && x.role === r.value),
    }))
    .filter((g) => g.items.length > 0);
}

function matches(x: Entity, query: string): boolean {
  return foldText(x.name).includes(query) || foldText(x.one).includes(query);
}

/** List of characters, locations or worlds. */
export function GroupDoc({ kind }: { kind: EntityKind }) {
  const data = useProjectData();
  const navigate = useNavigate();
  const actions = useEntityActions(data.draft.id);
  const [adding, setAdding] = useState(false);
  const list: Entity[] = {
    char: data.chars,
    loc: data.locs,
    world: data.worlds,
  }[kind];
  const words = ENTITY_WORDS[kind];

  return (
    <>
      <DocHead title={words.group}>
        <Button className="rounded-full" onClick={() => setAdding(true)}>
          <Plus />
          {words.add}
        </Button>
      </DocHead>
      <div className="mx-auto grid max-w-[900px] gap-2">
        {list.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            <b className="mb-2 block text-heading-3 text-foreground">
              Пока пусто
            </b>
            {EMPTY[kind]}
          </p>
        ) : kind === "world" ? (
          list.map((x) => <Row key={x.id} kind={kind} x={x} />)
        ) : (
          // A new key per kind: the folded episodic group and the query start over on another list.
          <RoleList key={kind} kind={kind} list={list} />
        )}
      </div>
      <NameDialog
        open={adding}
        onOpenChange={setAdding}
        title={words.add}
        label={words.nameLabel}
        submitLabel="Добавить"
        emptyError={`Введите ${kind === "char" ? "имя" : "название"}.`}
        onSubmit={async (name) => {
          const id = await actions.add(kind, name);
          navigate(docPath(data.draft, { kind: "entity", entity: kind, id }));
        }}
      />
    </>
  );
}

/** Groups of roles with the search by name; the episodic group starts folded beside others. */
function RoleList({ kind, list }: { kind: RoleKind; list: Entity[] }) {
  const groups = roleGroups(kind, list);
  const [episodicOpen, setEpisodicOpen] = useState(
    () => !groups.some((g) => g.role !== "episodic"),
  );
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const folded = foldText(query.trim());
  const searching = folded !== "";
  const shown = searching
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((x) => matches(x, folded)),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  return (
    <>
      <div className="relative mb-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={input}
          type="search"
          aria-label="Поиск по имени"
          placeholder="Поиск по имени"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query !== "") {
              e.preventDefault();
              setQuery("");
            }
          }}
          className="h-9 rounded-full pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {query !== "" && (
          <button
            type="button"
            aria-label="Очистить поиск"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Ничего не нашлось
        </p>
      ) : (
        shown.map((g) => {
          const foldable = g.role === "episodic" && !searching;
          const open = g.role !== "episodic" || searching || episodicOpen;
          const head = (
            <>
              <span>{g.title}</span>
              <span className="text-muted-foreground">{g.items.length}</span>
            </>
          );
          return (
            <section key={g.role} className="grid gap-2">
              <h2 className="mt-3 text-caption font-semibold text-foreground first:mt-0">
                {foldable ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setEpisodicOpen((o) => !o)}
                    className="-mx-1 flex items-center gap-1.5 rounded-md px-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        open && "rotate-90",
                      )}
                    />
                    {head}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5">{head}</span>
                )}
              </h2>
              {open && g.items.map((x) => <Row key={x.id} kind={kind} x={x} />)}
            </section>
          );
        })
      )}
    </>
  );
}

function Row({ kind, x }: { kind: EntityKind; x: Entity }) {
  const data = useProjectData();
  return (
    <Link
      to={docPath(data.draft, { kind: "entity", entity: kind, id: x.id })}
      className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3 text-paper-foreground shadow-panel transition-shadow hover:shadow-paper"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-semibold">
        {x.name.slice(0, 1)}
      </span>
      <span className="grid min-w-0 flex-1">
        <b className="truncate font-semibold">{x.name}</b>
        <small className="truncate text-caption text-muted-foreground">
          {x.one === "" ? "Без описания" : x.one}
        </small>
      </span>
    </Link>
  );
}

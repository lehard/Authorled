import {
  AlignLeft,
  BookOpen,
  ChevronRight,
  Clapperboard,
  FileText,
  Globe,
  Home,
  MapPin,
  Plus,
  SortAsc,
  Trash2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import {
  SCRIPT_PARTS,
  type Entity,
  type EntityKind,
  type ScriptPart,
} from "@/data/model";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { AddDocumentDialog } from "./AddDocumentDialog";
import {
  docPath,
  ENTITY_WORDS,
  GROUP_OF,
  type DocRef,
  type GroupKey,
} from "./docRef";
import { useEntityActions } from "./entityActions";
import { NodeMenu, type MenuEntry } from "./NodeMenu";
import { useProjectData } from "./ProjectContext";

const GROUP_ICON: Record<EntityKind, LucideIcon> = {
  char: Users,
  loc: MapPin,
  world: Globe,
};
const ITEM_ICON: Record<EntityKind, LucideIcon> = {
  char: User,
  loc: MapPin,
  world: Globe,
};
const PART_ICON: Record<ScriptPart, LucideIcon> = {
  title: BookOpen,
  synopsis: AlignLeft,
  text: FileText,
};

type Row = {
  key: string;
  to: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  menu?: MenuEntry[];
  kids?: Row[];
};

/** Navigator of a story (openspec/specs/web/workspace, «Навигатор»). */
export function Navigator({ onNavigate }: { onNavigate: () => void }) {
  const data = useProjectData();
  const { project, script, docSegment } = data;
  const navigate = useNavigate();
  const actions = useEntityActions(project.id);
  const [open, setOpen] = useState<Set<string>>(new Set(["chars", "sp"]));
  const [sorted, setSorted] = useState<Record<GroupKey, boolean>>({
    chars: false,
    locs: false,
    worlds: false,
  });
  const [adding, setAdding] = useState<EntityKind | null>(null);
  const [emptying, setEmptying] = useState(false);

  const path = (ref: DocRef) => docPath(project.id, ref);
  const trashed = Object.entries(data.trash).flatMap(([kind, list]) =>
    list.map((x) => ({ kind: kind as EntityKind, x })),
  );

  async function remove(kind: EntityKind, x: Entity) {
    await actions.trash(kind, x.id, true);
    if (docSegment === `${kind}:${x.id}`)
      navigate(path({ kind: "group", entity: kind }));
  }

  function group(kind: EntityKind, list: Entity[]): Row {
    const key = GROUP_OF[kind];
    const items = sorted[key]
      ? [...list].sort((a, b) => a.name.localeCompare(b.name, "ru"))
      : list;
    return {
      key,
      to: path({ kind: "group", entity: kind }),
      icon: GROUP_ICON[kind],
      label: ENTITY_WORDS[kind].group,
      menu: [
        {
          label: ENTITY_WORDS[kind].add,
          icon: Plus,
          run: () => setAdding(kind),
        },
        {
          label: "Сортировать по алфавиту",
          icon: SortAsc,
          run: () => setSorted((s) => ({ ...s, [key]: true })),
        },
      ],
      kids: items.map((x) => ({
        key: `${kind}:${x.id}`,
        to: path({ kind: "entity", entity: kind, id: x.id }),
        icon: ITEM_ICON[kind],
        label: x.name,
        menu: [
          {
            label: "Открыть",
            run: () =>
              navigate(path({ kind: "entity", entity: kind, id: x.id })),
          },
          {
            label: "Удалить",
            icon: Trash2,
            danger: true,
            run: () => void remove(kind, x),
          },
        ],
      })),
    };
  }

  const parts = (Object.keys(SCRIPT_PARTS) as ScriptPart[]).filter(
    (p) => script.show[p],
  );
  const rows: Row[] = [
    {
      key: "info",
      to: path({ kind: "info" }),
      icon: Home,
      label: project.title,
    },
    group("char", data.chars),
    group("loc", data.locs),
    group("world", data.worlds),
    {
      key: "sp",
      to: path({ kind: "sp" }),
      icon: Clapperboard,
      label: script.name,
      kids: parts.map((p) => ({
        key: p,
        to: path({ kind: "part", part: p }),
        icon: PART_ICON[p],
        label: SCRIPT_PARTS[p],
      })),
    },
    {
      key: "trash",
      to: path({ kind: "trash" }),
      icon: Trash2,
      label: "Корзина",
      count: trashed.length,
      menu: [
        {
          label: "Очистить корзину",
          danger: true,
          disabled: trashed.length === 0,
          run: () => setEmptying(true),
        },
      ],
    },
  ];

  function node(row: Row, depth: number): ReactNode {
    const expandable = row.kids !== undefined && row.kids.length > 0;
    const isOpen = open.has(row.key);
    const link = (
      <>
        {expandable ? (
          <button
            type="button"
            className="absolute grid size-4 place-items-center rounded text-muted-foreground"
            style={{ left: depth * 14 + 4 }}
            aria-label={
              isOpen ? `Свернуть: ${row.label}` : `Развернуть: ${row.label}`
            }
            aria-expanded={isOpen}
            onClick={() =>
              setOpen((s) => {
                const next = new Set(s);
                if (isOpen) next.delete(row.key);
                else next.add(row.key);
                return next;
              })
            }
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        ) : null}
        <Link
          to={row.to}
          onClick={onNavigate}
          className="tree-item pr-8"
          style={{ paddingLeft: depth * 14 + 24 }}
          aria-current={
            docSegment === row.to.split("/").pop() ? "page" : undefined
          }
        >
          <row.icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{row.label}</span>
          {row.count !== undefined && row.count > 0 && (
            <span className="text-xs text-muted-foreground">{row.count}</span>
          )}
        </Link>
      </>
    );
    return (
      <li key={row.key}>
        {row.menu !== undefined ? (
          <NodeMenu label={row.label} items={row.menu}>
            {link}
          </NodeMenu>
        ) : (
          <div className="relative flex items-center">{link}</div>
        )}
        {expandable && isOpen && (
          <ul>{row.kids?.map((k) => node(k, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <nav
      aria-label="Навигатор истории"
      className="flex h-full min-h-0 flex-col"
    >
      <Link
        to={path({ kind: "info" })}
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 pt-4 pb-2 text-left"
      >
        <span
          className={project.cover ? "book-mini art" : "book-mini"}
          aria-hidden
        />
        <span className="min-w-0">
          <b className="font-heading block truncate text-lg leading-tight font-semibold">
            {project.title}
          </b>
          <small className="text-caption text-muted-foreground">
            полный метр
          </small>
        </span>
      </Link>
      <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {rows.map((r) => node(r, 0))}
      </ul>
      <button
        type="button"
        onClick={() => setAdding("char")}
        className="mx-2.5 mt-1.5 mb-3 flex items-center gap-2 rounded-full px-3 py-2.5 font-semibold text-primary hover:bg-accent"
      >
        <Plus className="size-4" />
        Добавить документ
      </button>

      <AddDocumentDialog
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        initialKind={adding ?? "char"}
        onSubmit={async (kind, name) => {
          const id = await actions.add(kind, name);
          setOpen((s) => new Set(s).add(GROUP_OF[kind]));
          onNavigate();
          navigate(path({ kind: "entity", entity: kind, id }));
        }}
      />
      <ConfirmDialog
        open={emptying}
        onOpenChange={setEmptying}
        title="Очистить корзину?"
        text={`Документы из корзины (${trashed.length}) удалятся без возможности восстановления.`}
        actionLabel="Очистить"
        onConfirm={() => {
          trashed.forEach(({ kind, x }) => void actions.purge(kind, x.id));
          setEmptying(false);
        }}
      />
    </nav>
  );
}

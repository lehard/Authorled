import {
  AlignLeft,
  ArrowLeft,
  ListOrdered,
  ScanSearch,
  ListTree,
  BookOpen,
  ChevronRight,
  Clapperboard,
  FileText,
  Globe,
  MapPin,
  NotebookPen,
  Plus,
  Quote,
  SortAsc,
  Trash2,
  User,
  Telescope,
  Users,
  type LucideIcon,
  Upload,
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import {
  coverPattern,
  SCRIPT_PARTS,
  type Entity,
  type EntityKind,
  type ScriptPart,
} from "@/data/model";
import { searchActive } from "@/data/search";
import { TruncatedText } from "@/design-system";
import { scenes, screenTime } from "@/editor/document.ts";
import {
  castFromText,
  moveScene,
  placesFromText,
  titleCase,
} from "@/editor/scenes.ts";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { AddDocumentDialog } from "./AddDocumentDialog";
import {
  DOC_WORDS,
  docPath,
  ENTITY_WORDS,
  GROUP_OF,
  type DocKind,
  type DocRef,
  type GroupKey,
} from "./docRef";
import { emptyTrashText, trashItems, useTrashActions } from "./draftActions";
import { DraftSwitcher } from "./DraftSwitcher";
import { useEntityActions } from "./entityActions";
import { NodeMenu, type MenuEntry } from "./NodeMenu";
import { noteIcon } from "./docs/noteFile";
import { useNoteActions } from "./noteActions";
import { NoteUploadDialog } from "./NoteUploadDialog";
import { RESEARCH_START } from "./chat/checks";
import { useProjectData } from "./ProjectContext";
import { StorySearchField, StorySearchResults } from "./StorySearch";

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
  logline: Quote,
  synopsis: AlignLeft,
  treatment: ListOrdered,
  text: FileText,
};

type Row = {
  key: string;
  /** A row without an address only opens and closes. */
  to?: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  menu?: MenuEntry[];
  kids?: Row[];
  /** The row has a scene list (screenplay-text-tools, decision 9). */
  drill?: boolean;
};

/** Navigator of a story (openspec/specs/web/workspace, «Навигатор»). */
export function Navigator({ onNavigate }: { onNavigate: () => void }) {
  const data = useProjectData();
  const { project, draft, script, docSegment } = data;
  const navigate = useNavigate();
  const actions = useEntityActions(draft.id);
  const trashActions = useTrashActions(data);
  const noteActions = useNoteActions(project.id);
  const [open, setOpen] = useState<Set<string>>(
    new Set(["chars", "sp", "notes"]),
  );
  const [sorted, setSorted] = useState<Record<GroupKey, boolean>>({
    chars: false,
    locs: false,
    worlds: false,
  });
  const [adding, setAdding] = useState<DocKind | null>(null);
  const [uploading, setUploading] = useState(false);
  const [emptying, setEmptying] = useState(false);
  // The tree, or the scene list of «Текст сценария» or «Поэпизодник».
  const [mode, setMode] = useState<"tree" | "text" | "treatment">("tree");
  const [notice, setNotice] = useState<string | null>(null);

  /** «Найти всех персонажей / все локации в тексте» (scene-outline-and-cards, decision 7). */
  async function harvest(kind: "char" | "loc") {
    const have = new Set(
      (kind === "char" ? data.chars : data.locs).map((x) =>
        x.name.toUpperCase(),
      ),
    );
    const found = (kind === "char" ? castFromText : placesFromText)(data.text)
      .map(titleCase)
      .filter((name) => !have.has(name.toUpperCase()));
    for (const name of found) await actions.addFromText(kind, name);
    if (found.length > 0) setOpen((s) => new Set(s).add(GROUP_OF[kind]));
    setNotice(
      found.length === 0
        ? "Новых нет: все уже в истории."
        : `Добавлено из текста: ${found.join(", ")}.`,
    );
  }

  const path = (ref: DocRef) => docPath(draft, ref);
  const trashed = trashItems(data.trash);

  async function remove(kind: EntityKind, x: Entity) {
    await actions.trash(kind, x.id, true);
    if (docSegment === `${kind}:${x.id}`)
      navigate(path({ kind: "group", entity: kind }));
  }

  async function removeNote(id: string) {
    await noteActions.trash(id, true);
    if (docSegment === `note:${id}`) navigate(path({ kind: "notes" }));
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
          disabled: draft.locked,
          run: () => setAdding(kind),
        },
        ...(kind === "world"
          ? []
          : [
              {
                label:
                  kind === "char"
                    ? "Найти всех персонажей в тексте"
                    : "Найти все локации в тексте",
                icon: ScanSearch,
                disabled: draft.locked,
                run: () => void harvest(kind),
              },
            ]),
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
            disabled: draft.locked,
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
    group("char", data.chars),
    group("loc", data.locs),
    group("world", data.worlds),
    {
      key: "sp",
      icon: Clapperboard,
      label: "Сценарий",
      kids: [
        ...parts.map((p) => ({
          key: p,
          to: path({ kind: "part", part: p }),
          icon: PART_ICON[p],
          label: SCRIPT_PARTS[p],
          drill: p === "text" || p === "treatment",
        })),
      ],
    },
    {
      key: "notes",
      to: path({ kind: "notes" }),
      icon: NotebookPen,
      label: DOC_WORDS.note.group,
      menu: [
        {
          label: DOC_WORDS.note.add,
          icon: Plus,
          run: () => setAdding("note"),
        },
        {
          label: "Загрузить файл",
          icon: Upload,
          run: () => setUploading(true),
        },
        {
          label: "Исследование",
          icon: Telescope,
          disabled: data.coauthorBusy,
          run: () => data.askCoauthor(RESEARCH_START, "fill"),
        },
      ],
      kids: data.notes.map((n) => ({
        key: `note:${n.id}`,
        to: path({ kind: "note", id: n.id }),
        icon: noteIcon(n.file),
        label: n.title,
        menu: [
          {
            label: "Открыть",
            run: () => navigate(path({ kind: "note", id: n.id })),
          },
          {
            label: "Удалить",
            icon: Trash2,
            danger: true,
            run: () => void removeNote(n.id),
          },
        ],
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
          disabled: trashed.length === 0 || draft.locked,
          run: () => setEmptying(true),
        },
      ],
    },
  ];

  function node(row: Row, depth: number): ReactNode {
    const expandable = row.kids !== undefined && row.kids.length > 0;
    const isOpen = open.has(row.key);
    const toggle = () =>
      setOpen((s) => {
        const next = new Set(s);
        if (isOpen) next.delete(row.key);
        else next.add(row.key);
        return next;
      });
    const item = (
      <>
        <row.icon className="size-4 shrink-0" />
        <TruncatedText className="min-w-0 flex-1">{row.label}</TruncatedText>
        {row.count !== undefined && row.count > 0 && (
          <span className="text-xs text-muted-foreground">{row.count}</span>
        )}
      </>
    );
    const itemClass = `tree-item ${row.drill === true && row.menu !== undefined ? "pr-16" : "pr-8"}`;
    const itemStyle = { paddingLeft: depth * 14 + 24 };
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
            onClick={toggle}
          >
            <ChevronRight
              className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        ) : null}
        {row.to === undefined ? (
          <button
            type="button"
            className={itemClass}
            style={itemStyle}
            aria-expanded={isOpen}
            onClick={toggle}
          >
            {item}
          </button>
        ) : (
          <Link
            to={row.to}
            onClick={onNavigate}
            className={itemClass}
            style={itemStyle}
            aria-current={
              docSegment === row.to.split("/").pop() ? "page" : undefined
            }
          >
            {item}
          </Link>
        )}
        {row.drill === true && (
          <button
            type="button"
            className={`absolute grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground ${row.menu !== undefined ? "right-8" : "right-1"}`}
            aria-label={`Сцены: ${row.label}`}
            onClick={() =>
              setMode(row.key === "treatment" ? "treatment" : "text")
            }
          >
            <ListTree className="size-4" />
          </button>
        )}
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
      <div className="px-2 pt-2">
        <Link to="/" onClick={onNavigate} className="tree-item">
          <ArrowLeft className="size-4 shrink-0" />
          Все истории
        </Link>
      </div>
      <Link
        to={path({ kind: "info" })}
        onClick={onNavigate}
        className="story-head mx-2 mb-1 flex items-center gap-3 rounded-xl px-2 py-1.5 text-left"
        aria-current={docSegment === "info" ? "page" : undefined}
      >
        <span
          className="book-mini"
          data-cover={project.coverColor}
          data-pattern={coverPattern(project.id)}
          aria-hidden
        />
        <span className="min-w-0">
          <TruncatedText className="font-heading block text-lg leading-tight font-semibold">
            {project.title}
          </TruncatedText>
          <small className="text-caption text-muted-foreground">
            полный метр
          </small>
        </span>
      </Link>
      <DraftSwitcher onNavigate={onNavigate} />
      {notice !== null && (
        <p
          role="status"
          className="mx-2 mb-1 flex items-start gap-2 rounded-xl bg-paper px-3 py-2 text-caption text-paper-foreground shadow-panel"
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setNotice(null)}
          >
            Закрыть
          </button>
        </p>
      )}
      <StorySearchField />
      {searchActive(data.searchText) ? (
        <StorySearchResults onNavigate={onNavigate} />
      ) : mode === "tree" ? (
        <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {rows.map((r) => node(r, 0))}
        </ul>
      ) : (
        <SceneList
          part={mode}
          onBack={() => setMode("tree")}
          onNavigate={onNavigate}
          partPath={path({ kind: "part", part: mode })}
        />
      )}
      <button
        type="button"
        onClick={() => setAdding(draft.locked ? "note" : "char")}
        className="mx-2.5 mt-1.5 mb-3 flex items-center gap-2 rounded-full px-3 py-2.5 font-semibold text-primary hover:bg-accent"
      >
        <Plus className="size-4" />
        Добавить документ
      </button>

      <AddDocumentDialog
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        kinds={draft.locked ? ["note"] : ["char", "loc", "world", "note"]}
        initialKind={adding ?? "char"}
        onSubmit={async (kind, name) => {
          if (kind === "note") {
            const id = await noteActions.add(name, "");
            setOpen((s) => new Set(s).add("notes"));
            onNavigate();
            navigate(path({ kind: "note", id }));
            return;
          }
          const id = await actions.add(kind, name);
          setOpen((s) => new Set(s).add(GROUP_OF[kind]));
          onNavigate();
          navigate(path({ kind: "entity", entity: kind, id }));
        }}
        onUploadFile={() => setUploading(true)}
      />
      <NoteUploadDialog
        open={uploading}
        onOpenChange={setUploading}
        projectId={project.id}
        onDone={(id) => {
          setOpen((s) => new Set(s).add("notes"));
          onNavigate();
          navigate(path({ kind: "note", id }));
        }}
      />
      <ConfirmDialog
        open={emptying}
        onOpenChange={setEmptying}
        title="Очистить корзину?"
        text={emptyTrashText(trashed)}
        actionLabel="Очистить"
        onConfirm={() => {
          trashed.forEach((i) => void trashActions.purge(i));
          setEmptying(false);
        }}
      />
    </nav>
  );
}

const DRAG_TYPE = "application/x-authorled-scene";

/**
 * Scenes of the screenplay in the navigator: acts and groups as dividers, scenes as links that
 * can be dragged to another place (scene-outline-and-cards, decisions 6 and 8).
 */
function SceneList({
  part,
  onBack,
  onNavigate,
  partPath,
}: {
  part: "text" | "treatment";
  onBack: () => void;
  onNavigate: () => void;
  partPath: string;
}) {
  const { text, setText, docSegment, currentScene, draft } = useProjectData();
  const [dropAt, setDropAt] = useState<number | null>(null);
  const list = scenes(text);
  const target = (at: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setDropAt(at);
    },
    onDragLeave: () => setDropAt((d) => (d === at ? null : d)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDropAt(null);
      const n = Number(e.dataTransfer.getData(DRAG_TYPE));
      if (Number.isInteger(n) && n > 0) setText(moveScene(text, n, at));
    },
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-2 pb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          {SCRIPT_PARTS[part]}
        </button>
      </div>
      <ol
        aria-label="Сцены"
        className="grid min-h-0 flex-1 content-start gap-0.5 overflow-auto px-2 pb-2"
      >
        {list.length === 0 && (
          <li className="px-3 py-2 text-caption text-muted-foreground">
            Сцен пока нет: начните абзац с «ИНТ.» или «НАТ.».
          </li>
        )}
        {list.map((s) =>
          s.kind !== "scene" ? (
            <li
              key={`${s.kind}-${s.index}`}
              {...target(s.index + 1)}
              className={`rounded-lg px-3 pt-3 pb-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase ${dropAt === s.index + 1 ? "ring-2 ring-ring" : ""}`}
            >
              {s.name.trim() === ""
                ? s.kind === "act"
                  ? "Акт"
                  : "Группа"
                : s.name}
            </li>
          ) : (
            <li
              key={`scene-${s.index}`}
              {...target(s.index)}
              className="relative"
            >
              {dropAt === s.index && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -top-px h-0.5 rounded bg-primary"
                />
              )}
              <Link
                to={`${partPath}?scene=${s.number}`}
                onClick={onNavigate}
                draggable={!draft.locked}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, String(s.number));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDropAt(null)}
                className="tree-item relative grid! grid-cols-[minmax(0,1fr)] gap-0.5 overflow-hidden px-3 py-2"
                aria-current={
                  docSegment === part && currentScene === s.number
                    ? "location"
                    : undefined
                }
              >
                {s.params.color !== null && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0.5 w-1 rounded"
                    style={{ background: `var(--mark-${s.params.color})` }}
                  />
                )}
                <span className="flex items-baseline gap-2">
                  <TruncatedText className="min-w-0 flex-1 font-medium">
                    {s.number}.{" "}
                    {s.params.alt !== ""
                      ? s.params.alt
                      : s.heading.trim() === ""
                        ? "Без заголовка"
                        : s.heading}
                  </TruncatedText>
                  <time className="text-xs text-muted-foreground tabular-nums">
                    {screenTime(s.chars)}
                  </time>
                </span>
                {part === "treatment" ? (
                  s.beats.map((b, i) => (
                    <span
                      key={i}
                      className="truncate text-caption text-muted-foreground"
                    >
                      · {b}
                    </span>
                  ))
                ) : (
                  <span className="truncate text-caption text-muted-foreground">
                    {s.text === "" ? "—" : s.text}
                  </span>
                )}
              </Link>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

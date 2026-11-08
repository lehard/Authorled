import { AlignLeft, ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GrowingTextarea } from "@/design-system";
import {
  MARK_COLORS,
  scenes,
  screenTime,
  type EditorMode,
  type SceneEntry,
  type ScreenplayDoc,
} from "@/editor";
import {
  addAct,
  addScene,
  deleteScene,
  moveScene,
  sceneStep,
  setSceneBeats,
  setSceneHeading,
  setSceneParams,
} from "@/editor/scenes.ts";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { useProjectData } from "../ProjectContext";

type Scene = Extract<SceneEntry, { kind: "scene" }>;
type Group = {
  act: Exclude<SceneEntry, { kind: "scene" }> | null;
  scenes: Scene[];
};

const DRAG_TYPE = "application/x-authorled-scene";

/** Scenes by act; scenes before the first act are «Без акта». Groups are not cards. */
function groups(list: SceneEntry[]): Group[] {
  const out: Group[] = [{ act: null, scenes: [] }];
  for (const s of list) {
    if (s.kind === "act") out.push({ act: s, scenes: [] });
    else if (s.kind === "scene") out[out.length - 1].scenes.push(s);
  }
  return out.filter((g, i) => i > 0 || g.scenes.length > 0);
}

/** Number of the scene that starts at paragraph `start` of `doc`. */
function numberAt(doc: ScreenplayDoc, start: number): number {
  const s = scenes(doc).find((x) => x.kind === "scene" && x.index === start);
  if (s?.kind !== "scene") throw new Error(`Нет сцены в абзаце ${start}`);
  return s.number;
}

/** Moves scene `n` before paragraph `at`; returns the new text and the scene's new number. */
function move(
  doc: ScreenplayDoc,
  n: number,
  at: number,
): [ScreenplayDoc, number] {
  const s = scenes(doc).find((x) => x.kind === "scene" && x.number === n);
  if (s?.kind !== "scene") throw new Error(`Сцены ${n} нет в тексте`);
  const next = moveScene(doc, n, at);
  if (next === doc) return [doc, n];
  return [next, numberAt(next, at > s.end ? at - (s.end - s.index) : at)];
}

/** Cards of the scenes and the panel of the chosen one (scene-outline-and-cards, decisions 5 and 6). */
export function SceneBoard({
  mode,
  onOpen,
}: {
  mode: EditorMode;
  onOpen: (scene: number) => void;
}) {
  const { text, setText, draft } = useProjectData();
  const [chosen, setChosen] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const list = scenes(text);
  const all = list.filter((s): s is Scene => s.kind === "scene");
  const current = all.find((s) => s.number === chosen) ?? null;

  function drop(e: DragEvent, at: number) {
    e.preventDefault();
    setDropAt(null);
    const n = Number(e.dataTransfer.getData(DRAG_TYPE));
    if (!Number.isInteger(n) || n < 1) return;
    const [next, number] = move(text, n, at);
    setText(next);
    setChosen(number);
  }
  const target = (at: number) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setDropAt(at);
    },
    onDragLeave: () => setDropAt((d) => (d === at ? null : d)),
    onDrop: (e: DragEvent) => drop(e, at),
  });

  return (
    <div className="mx-auto grid max-w-[1000px] gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid content-start gap-4">
        <fieldset disabled={draft.locked} className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = addScene(text);
              setText(next);
              setChosen(all.length + 1);
            }}
          >
            <Plus />
            Сцена
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setText(addAct(text))}
          >
            <Plus />
            Акт
          </Button>
        </fieldset>
        {all.length === 0 ? (
          <p className="rounded-2xl bg-panel px-4 py-6 text-center text-muted-foreground shadow-panel">
            <b className="block text-foreground">Сцен пока нет</b>
            Добавьте сцену кнопкой сверху или начните писать в виде «Текст».
          </p>
        ) : (
          groups(list).map((g) => (
            <section key={g.act?.index ?? "none"} className="grid gap-2">
              <h3
                {...(g.act === null ? target(0) : target(g.act.index + 1))}
                className={`rounded-lg px-1 py-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase ${
                  dropAt === (g.act === null ? 0 : g.act.index + 1)
                    ? "ring-2 ring-ring"
                    : ""
                }`}
              >
                {g.act === null
                  ? "Без акта"
                  : g.act.name.trim() === ""
                    ? "Акт"
                    : g.act.name}
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                {g.scenes.map((s) => (
                  <button
                    key={s.index}
                    type="button"
                    draggable={!draft.locked}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, String(s.number));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDropAt(null)}
                    {...target(s.index)}
                    onClick={() => setChosen(s.number)}
                    onDoubleClick={() => onOpen(s.number)}
                    aria-pressed={chosen === s.number}
                    aria-label={`Сцена ${s.number}: ${s.heading}`}
                    className={`relative grid content-start gap-1 overflow-hidden rounded-xl bg-paper p-3 pl-4 text-left text-paper-foreground shadow-panel transition-shadow aria-pressed:ring-2 aria-pressed:ring-ring ${
                      dropAt === s.index
                        ? "before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded before:bg-primary"
                        : ""
                    }`}
                  >
                    {s.params.color !== null && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ background: `var(--mark-${s.params.color})` }}
                      />
                    )}
                    {s.params.alt !== "" && (
                      <span className="text-caption text-muted-foreground">
                        {s.params.alt}
                      </span>
                    )}
                    <span className="font-mono text-[13px] font-bold uppercase">
                      {s.number}.{" "}
                      {s.heading.trim() === "" ? "Без заголовка" : s.heading}
                    </span>
                    {mode === "outline" || s.text === "" ? (
                      s.beats.length > 0 && (
                        <ul className="list-disc pl-4 text-caption">
                          {s.beats.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <span className="line-clamp-3 text-caption text-muted-foreground">
                        {s.text}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {s.params.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                      {s.params.day !== "" && <span>{s.params.day}</span>}
                      <time className="ml-auto tabular-nums">
                        {screenTime(s.chars)}
                      </time>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
        <p className="text-center text-caption text-muted-foreground">
          Перетащите карточку, чтобы переставить сцену. Двойной клик открывает
          текст сцены.
        </p>
      </div>
      {current !== null && (
        <ScenePanel
          key={current.number}
          scene={current}
          onClose={() => setChosen(null)}
          onOpen={() => onOpen(current.number)}
          onMove={(dir) => {
            const at = sceneStep(text, current.number, dir);
            if (at === null) return;
            const [next, number] = move(text, current.number, at);
            setText(next);
            setChosen(number);
          }}
          canMove={(dir) => sceneStep(text, current.number, dir) !== null}
          onDelete={() => {
            setText(deleteScene(text, current.number));
            setChosen(null);
          }}
        />
      )}
    </div>
  );
}

function ScenePanel({
  scene,
  onClose,
  onOpen,
  onMove,
  canMove,
  onDelete,
}: {
  scene: Scene;
  onClose: () => void;
  onOpen: () => void;
  onMove: (dir: -1 | 1) => void;
  canMove: (dir: -1 | 1) => boolean;
  onDelete: () => void;
}) {
  const { text, setText, draft } = useProjectData();
  const n = scene.number;
  // Beats are edited as lines; an empty line stays on screen while the author types.
  const [beats, setBeats] = useState(scene.beats.join("\n"));
  const [tag, setTag] = useState("");
  const [deleting, setDeleting] = useState(false);
  const panel = useRef<HTMLElement>(null);
  // Below the cards on a narrow screen: bring the panel of the chosen scene into view.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1099px)").matches)
      panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const params = (patch: Parameters<typeof setSceneParams>[2]) =>
    setText(setSceneParams(text, n, patch));

  return (
    <aside
      ref={panel}
      aria-label={`Параметры сцены ${n}`}
      className="grid content-start gap-3.5 self-start rounded-2xl bg-panel p-4 shadow-panel min-[1100px]:sticky min-[1100px]:top-2"
    >
      <header className="flex items-center justify-between">
        <b>Сцена {n}</b>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Закрыть параметры"
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      <fieldset disabled={draft.locked} className="contents">
        <Field
          label="Название"
          hint="Видно на карточке и в навигаторе, в тексте не печатается."
        >
          {(id) => (
            <Input
              id={id}
              value={scene.params.alt}
              onChange={(e) => params({ alt: e.target.value })}
            />
          )}
        </Field>
        <Field label="Заголовок">
          {(id) => (
            <Input
              id={id}
              value={scene.heading}
              onChange={(e) =>
                setText(setSceneHeading(text, n, e.target.value))
              }
            />
          )}
        </Field>
        <Field label="Биты" hint="Каждая строка — отдельный бит.">
          {(id) => (
            <GrowingTextarea
              variant="field"
              minRows={4}
              limit="none"
              id={id}
              value={beats}
              onChange={(e) => {
                setBeats(e.target.value);
                const lines = e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l !== "");
                setText(setSceneBeats(text, n, lines));
              }}
            />
          )}
        </Field>
        <Field label="День истории">
          {(id) => (
            <Input
              id={id}
              placeholder="Например, 3-й день"
              value={scene.params.day}
              onChange={(e) => params({ day: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-1.5">
          <span className="text-caption text-muted-foreground">Цвет</span>
          <div role="radiogroup" aria-label="Цвет сцены" className="flex gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={scene.params.color === null}
              aria-label="Без цвета"
              onClick={() => params({ color: null })}
              className="grid size-7 place-items-center rounded-full border border-border-strong text-muted-foreground aria-checked:ring-2 aria-checked:ring-ring"
            >
              <X className="size-3.5" />
            </button>
            {MARK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={scene.params.color === c}
                aria-label={`Цвет ${c}`}
                onClick={() => params({ color: c })}
                className="size-7 rounded-full aria-checked:ring-2 aria-checked:ring-ring aria-checked:ring-offset-2 aria-checked:ring-offset-panel"
                style={{ background: `var(--mark-${c})` }}
              />
            ))}
          </div>
        </div>
        <Field label="Теги">
          {(id) => (
            <div className="grid gap-2">
              {scene.params.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scene.params.tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-caption"
                    >
                      {t}
                      <button
                        type="button"
                        aria-label={`Убрать тег «${t}»`}
                        className="grid size-5 place-items-center rounded-full hover:bg-accent"
                        onClick={() =>
                          params({
                            tags: scene.params.tags.filter((x) => x !== t),
                          })
                        }
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                id={id}
                placeholder="Новый тег и Enter"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const t = tag.trim();
                  if (t === "") return;
                  if (!scene.params.tags.includes(t))
                    params({ tags: [...scene.params.tags, t] });
                  setTag("");
                }}
              />
            </div>
          )}
        </Field>
        <p className="text-caption text-muted-foreground">
          Длительность ≈ {screenTime(scene.chars)} · битов: {scene.beats.length}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canMove(-1)}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
            Выше
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canMove(1)}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
            Ниже
          </Button>
        </div>
      </fieldset>
      <Button variant="outline" onClick={onOpen}>
        <AlignLeft />
        Открыть текст сцены
      </Button>
      <Button
        variant="ghost"
        className="text-destructive"
        disabled={draft.locked}
        onClick={() => setDeleting(true)}
      >
        <Trash2 />
        Удалить сцену
      </Button>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Удалить сцену ${n}?`}
        text="Сцена и весь её текст будут удалены."
        actionLabel="Удалить сцену"
        onConfirm={() => {
          setDeleting(false);
          onDelete();
        }}
      />
    </aside>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = `scene-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label
        htmlFor={id}
        className="text-caption font-normal text-muted-foreground"
      >
        {label}
      </Label>
      {children(id)}
      {hint !== undefined && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

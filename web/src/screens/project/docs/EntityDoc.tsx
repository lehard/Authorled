import { ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTITY_RESOURCE,
  type Character,
  type Entity,
  type EntityKind,
  type Gender,
  type Role,
} from "@/data/model";
import { PROFILE, ROLES } from "@/data/profiles";
import { useAutosave } from "@/screens/shared/useAutosave";
import { useServerChanges } from "@/screens/shared/useServerChanges";

import { docPath, ENTITY_WORDS } from "../docRef";
import { useEntityActions } from "../entityActions";
import { useProjectData } from "../ProjectContext";
import { DocHead, FieldCard } from "./DocHead";
import { Field } from "./Field";
import { SaveHistory } from "./SaveHistory";
import { useFindInDoc } from "./useFindInDoc";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "", label: "Не указан" },
  { value: "f", label: "Женский" },
  { value: "m", label: "Мужской" },
  { value: "o", label: "Другой" },
];
// Radix Select has no empty value, so «Не указан» travels as "none" inside the control only.
const NONE = "none";

/** Profile of a character, location or world, after the STARC models. */
export function EntityDoc({ kind, id }: { kind: EntityKind; id: string }) {
  const data = useProjectData();
  const list: Entity[] = {
    char: data.chars,
    loc: data.locs,
    world: data.worlds,
  }[kind];
  const record = list.find((x) => x.id === id);
  if (record === undefined) throw new Error(`Нет документа ${kind}:${id}.`);
  // key: a new record gets fresh local state instead of the previous one's fields.
  return <EntityForm key={record.id} kind={kind} record={record} />;
}

function EntityForm({ kind, record }: { kind: EntityKind; record: Entity }) {
  const { draft } = useProjectData();
  const navigate = useNavigate();
  const actions = useEntityActions(draft.id);
  const { save, status } = useAutosave<Entity>(
    ENTITY_RESOURCE[kind],
    record.id,
  );
  const [x, setX] = useState<Entity>(record);
  useFindInDoc();
  // The co-author may change the card while it is open: its fields show without a reload.
  useServerChanges(record, setX);
  const words = ENTITY_WORDS[kind];

  function set(patch: Partial<Entity>) {
    setX((prev) => ({ ...prev, ...patch }) as Entity);
    if (patch.name === undefined || patch.name.trim() !== "") save(patch);
  }

  return (
    <>
      <DocHead
        title={x.name.trim() === "" ? words.one : x.name}
        status={status}
      >
        <SaveHistory target={{ documentId: record.id, part: "fields" }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Действия с документом"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem
              variant="destructive"
              disabled={draft.locked}
              onSelect={() =>
                void actions
                  .trash(kind, record.id, true)
                  .then(() =>
                    navigate(docPath(draft, { kind: "group", entity: kind })),
                  )
              }
            >
              <Trash2 />
              Удалить в корзину
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DocHead>
      <fieldset
        disabled={draft.locked}
        className="mx-auto grid max-w-[900px] gap-4"
      >
        <FieldCard>
          <Field
            name="name"
            label={words.nameLabel}
            value={x.name}
            onChange={(name) => set({ name })}
          />
          {"role" in x && kind !== "world" && (
            <div className="grid gap-1.5">
              <span className="text-caption text-muted-foreground">
                Роль в истории
              </span>
              <div
                role="radiogroup"
                aria-label="Роль в истории"
                className="flex w-fit flex-wrap gap-1 rounded-full bg-muted p-1"
              >
                {ROLES[kind].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={x.role === r.value}
                    onClick={() => set({ role: r.value as Role })}
                    className="h-8 rounded-full px-3 text-sm aria-checked:bg-paper aria-checked:font-medium aria-checked:shadow-panel"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === "char" && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field
                name="age"
                label="Возраст"
                value={(x as Character).age}
                onChange={(age) => set({ age } as Partial<Character>)}
              />
              <div className="grid gap-1.5">
                <Label className="text-caption font-normal text-muted-foreground">
                  Пол
                </Label>
                <Select
                  value={
                    (x as Character).gender === ""
                      ? NONE
                      : (x as Character).gender
                  }
                  onValueChange={(v) =>
                    set({
                      gender: (v === NONE ? "" : v) as Gender,
                    } as Partial<Character>)
                  }
                >
                  <SelectTrigger aria-label="Пол" className="w-full bg-paper">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem
                        key={g.label}
                        value={g.value === "" ? NONE : g.value}
                      >
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <Field
            name="one"
            label="Одной фразой"
            value={x.one}
            onChange={(one) => set({ one })}
          />
          <Field
            name="long"
            label="Подробное описание"
            value={x.long}
            area
            onChange={(long) => set({ long })}
          />
          {"overview" in x && (
            <Field
              name="overview"
              label="Обзор мира"
              value={x.overview}
              area
              onChange={(overview) => set({ overview })}
            />
          )}
        </FieldCard>
        {PROFILE[kind].map((section) => {
          const filled = section.fields.filter(
            (f) => (x.ext[f.key] ?? "").trim() !== "",
          ).length;
          return (
            <details
              key={section.title}
              className="group/sect rounded-2xl bg-paper text-paper-foreground shadow-panel"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 font-semibold">
                <ChevronRight className="size-4 transition-transform group-open/sect:rotate-90" />
                {section.title}
                {filled > 0 && (
                  <small className="ml-auto text-caption font-normal text-muted-foreground">
                    заполнено {filled} из {section.fields.length}
                  </small>
                )}
              </summary>
              <div className="grid gap-3.5 px-5 pb-5">
                {section.fields.map((f) => (
                  <Field
                    key={f.key}
                    name={f.key}
                    label={f.label}
                    area
                    rows={3}
                    value={x.ext[f.key] ?? ""}
                    onChange={(v) => set({ ext: { ...x.ext, [f.key]: v } })}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </fieldset>
    </>
  );
}

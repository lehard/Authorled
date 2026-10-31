import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import type { Entity, EntityKind } from "@/data/model";
import { ROLES } from "@/data/profiles";
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

function roleLabel(kind: EntityKind, x: Entity): string | null {
  if (kind === "world" || !("role" in x)) return null;
  const role = ROLES[kind].find((r) => r.value === x.role);
  if (role === undefined)
    throw new Error(`Неизвестная роль «${x.role}» у «${x.name}».`);
  return role.label;
}

/** List of characters, locations or worlds. */
export function GroupDoc({ kind }: { kind: EntityKind }) {
  const data = useProjectData();
  const navigate = useNavigate();
  const actions = useEntityActions(data.project.id);
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
        ) : (
          list.map((x) => {
            const role = roleLabel(kind, x);
            return (
              <Link
                key={x.id}
                to={docPath(data.project.id, {
                  kind: "entity",
                  entity: kind,
                  id: x.id,
                })}
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
                {role !== null && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {role}
                  </span>
                )}
              </Link>
            );
          })
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
          navigate(
            docPath(data.project.id, { kind: "entity", entity: kind, id }),
          );
        }}
      />
    </>
  );
}

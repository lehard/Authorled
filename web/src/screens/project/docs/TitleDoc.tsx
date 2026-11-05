import { useState } from "react";

import type { Script, TitlePage } from "@/data/model";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { SaveHistory } from "./SaveHistory";

const FIELDS: {
  key: keyof TitlePage;
  label: string;
  place: "mid" | "bottom";
  className?: string;
}[] = [
  {
    key: "title",
    label: "Название",
    place: "mid",
    className: "text-[22px] font-bold uppercase",
  },
  { key: "genre", label: "Жанр или формат", place: "mid" },
  { key: "author", label: "Автор", place: "mid" },
  { key: "contacts", label: "Контакты", place: "bottom" },
  { key: "place", label: "Город, год", place: "bottom" },
];

/** «Титульная страница» as a sheet of paper. */
export function TitleDoc() {
  const { draft, script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [page, setPage] = useState(script.titlePage);

  function input(f: (typeof FIELDS)[number]) {
    return (
      <input
        key={f.key}
        aria-label={f.label}
        placeholder={f.label}
        readOnly={draft.locked}
        value={page[f.key]}
        onChange={(e) => {
          const next = { ...page, [f.key]: e.target.value };
          setPage(next);
          save({ titlePage: next });
        }}
        className={`w-full rounded bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground/60 hover:bg-accent focus:bg-accent ${f.place === "mid" ? "text-center" : ""} ${f.className ?? ""}`}
      />
    );
  }

  return (
    <>
      <DocHead title="Титульная страница" status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
      </DocHead>
      <div className="sheet sheet-title">
        <div className="my-auto grid gap-3.5">
          {FIELDS.filter((f) => f.place === "mid").map(input)}
        </div>
        <div className="flex items-end justify-between gap-4 max-[600px]:flex-col max-[600px]:items-stretch">
          {FIELDS.filter((f) => f.place === "bottom").map(input)}
        </div>
      </div>
    </>
  );
}

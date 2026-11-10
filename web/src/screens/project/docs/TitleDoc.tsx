import { useState } from "react";

import type { Script, TitlePage } from "@/data/model";
import { GrowingTextarea } from "@/design-system";
import { useAutosave } from "@/screens/shared/useAutosave";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { SaveHistory } from "./SaveHistory";

const LABELS: Record<keyof TitlePage, string> = {
  title: "Название",
  genre: "Жанр или формат",
  author: "Автор",
  contacts: "Контакты",
  place: "Город, год",
};

/**
 * «Титульная страница» as a sheet of paper, laid out like the first page of the print
 * (`titleHTML` in editor/exporters/print.ts; web/workspace, «Лист титульной страницы»): the title,
 * the genre and the author in the middle, the contacts and the place at the bottom on the left.
 * Every field wraps and grows; Enter starts a new line.
 */
export function TitleDoc() {
  const { draft, script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [page, setPage] = useState(script.titlePage);

  function field(
    key: keyof TitlePage,
    align: "center" | "left",
    textClassName = "",
  ) {
    return (
      <GrowingTextarea
        aria-label={LABELS[key]}
        placeholder={LABELS[key]}
        readOnly={draft.locked}
        value={page[key]}
        onChange={(e) => {
          const next = { ...page, [key]: e.target.value };
          setPage(next);
          save({ titlePage: next });
        }}
        variant="bare"
        minRows={1}
        limit="none"
        className={`rounded px-1 focus-within:bg-accent hover:bg-accent ${align === "center" ? "text-center" : "text-left"} ${textClassName}`}
        placeholderClassName={`placeholder:text-muted-foreground/60 ${align === "center" ? "text-center" : "text-left"} ${textClassName}`}
      />
    );
  }

  return (
    <>
      <DocHead title="Титульная страница" status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
      </DocHead>
      <div className="sheet sheet-title">
        {/* The middle stands at a third of the free height, as `.tp-main` of the print does. */}
        <div className="grow" />
        <div className="grid">
          <div className="mb-[2lh]">
            {field("title", "center", "font-bold uppercase")}
          </div>
          <div className="mb-[2lh]">{field("genre", "center")}</div>
          {page.author.trim() !== "" && (
            <p className="mb-[0.5lh] text-center">Автор</p>
          )}
          {field("author", "center")}
        </div>
        <div className="grow-[2]" />
        <div className="grid">
          {field("contacts", "left")}
          {field("place", "left")}
        </div>
      </div>
    </>
  );
}

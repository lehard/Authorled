import { type CSSProperties, useState } from "react";

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
 * «Титульная страница» as a sheet of paper, composed like the first page of the print
 * (`titleHTML` in editor/exporters/print.ts; web/workspace, «Лист титульной страницы»,
 * «Композиция титульной страницы»): the title, the genre and the author start at 42 % of the
 * height of the text area, the contacts stand bottom left and the place bottom right.
 * Every field wraps and grows; Enter starts a new line.
 */
export function TitleDoc() {
  const { draft, script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const [page, setPage] = useState(script.titlePage);
  const placeWidth = Math.max(
    ...(page.place === "" ? LABELS.place : page.place)
      .split("\n")
      .map((line) => line.length),
  );

  /** `textClassName` goes to the field and to its invisible copy that sets the height. */
  function field(key: keyof TitlePage, textClassName: string) {
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
        className={`rounded px-1 focus-within:bg-accent hover:bg-accent ${textClassName}`}
        placeholderClassName={`placeholder:text-muted-foreground/60 ${textClassName}`}
      />
    );
  }

  return (
    <>
      <DocHead title="Титульная страница" status={status}>
        <SaveHistory target={{ draftId: draft.id, part: "fields" }} />
      </DocHead>
      <div className="sheet sheet-title">
        {/* Rows of `.sheet-title`: upper gap, block, lower gap, bottom. */}
        <div />
        <div className="grid">
          <div className="mb-[1lh]">
            {field("title", "text-center font-bold uppercase")}
          </div>
          <div className="mb-[2lh]">{field("genre", "text-center")}</div>
          {page.author.trim() !== "" && <p className="text-center">Автор</p>}
          {field("author", "text-center")}
        </div>
        <div />
        <div className="flex items-end justify-between gap-6 max-[600px]:flex-col max-[600px]:items-stretch max-[600px]:gap-[1lh]">
          <div className="min-w-0 flex-1">{field("contacts", "text-left")}</div>
          {/* The place column is as wide as its longest line (or the hint): the sheet font is
              monospaced, so that is an exact width in `ch`; the contacts take the rest. */}
          <div
            className="w-(--place-width) max-w-1/2 shrink-0 max-[600px]:w-auto max-[600px]:max-w-none"
            style={
              {
                "--place-width": `calc(${placeWidth}ch + 0.5rem)`,
              } as CSSProperties
            }
          >
            {field("place", "w-0 min-w-full text-right max-[600px]:text-left")}
          </div>
        </div>
      </div>
    </>
  );
}

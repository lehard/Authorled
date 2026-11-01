import { X } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { compareDocs, type ComparedParagraph } from "@/editor/compare.ts";
import { elementClass } from "@/editor/elements.ts";
import "@/editor/styles.css";

import { CURRENT, docPath } from "../docRef";
import { draftOf, sideName } from "../docTitle";
import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

/**
 * Two texts side by side by paragraphs (screenplay-drafts, decision 4): «было» on the left with
 * removed paragraphs struck, «стало» on the right with added ones underlined. Read-only markup
 * with the paragraph classes of the editor, not an editor.
 */
export function CompareDoc({ a, b }: { a: string; b: string }) {
  const data = useProjectData();
  const navigate = useNavigate();
  const text = (id: string) =>
    id === CURRENT ? data.text : draftOf(data.drafts, id).text;
  const { before, after } = compareDocs(text(a), text(b));
  const back = data.script.show.text
    ? docPath(data.project.id, { kind: "part", part: "text" })
    : docPath(data.project.id, { kind: "sp" });

  return (
    <>
      <DocHead title="Сравнение драфтов" wide>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => navigate(back)}
        >
          <X />
          Закрыть сравнение
        </Button>
      </DocHead>
      <p className="mx-auto mb-3.5 max-w-[1000px] text-caption text-muted-foreground">
        Убранное из «было» зачёркнуто, добавленное в «стало» подчёркнуто.
      </p>
      <div className="@container mx-auto max-w-[1400px]">
        <div className="grid gap-5 @min-[560px]:grid-cols-2">
          <Side
            name={`Было: ${sideName(data.drafts, a)}`}
            list={before}
            mark="pw-diff-del"
          />
          <Side
            name={`Стало: ${sideName(data.drafts, b)}`}
            list={after}
            mark="pw-diff-add"
          />
        </div>
      </div>
    </>
  );
}

function Side({
  name,
  list,
  mark,
}: {
  name: string;
  list: ComparedParagraph[];
  mark: string;
}) {
  return (
    <section aria-label={name} className="grid min-w-0 content-start gap-3">
      <h2 className="text-caption font-semibold text-muted-foreground">
        {name}
      </h2>
      <div className="pw-editor">
        <div className="ProseMirror">
          {list.map((p, i) => (
            <p
              key={i}
              data-type={p.type}
              className={`${elementClass(p.type)}${p.changed ? ` ${mark}` : ""}`}
            >
              {p.text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { foldText } from "@/editor/fold.ts";

/**
 * «?find=…&field=…» from the search of the story (web/workspace, «Переход к совпадению из поиска
 * по истории»; design of project-search, decision 8): the field `data-field` of the open document
 * gets the caret, its closed section of the profile opens, and the first match of the query in it is
 * selected; a text changed since the search leaves the caret at the start of the field. The address
 * loses both parameters once read. `field` is the field when the address names none (a document of one
 * field). `select` selects the match in a field that is no input (the prose editor of the synopsis); without
 * it the field is an input or a textarea.
 */
export function useFindInDoc(field?: string, select?: (find: string) => void) {
  const [params, setParams] = useSearchParams();
  const find = params.get("find");
  const target = params.get("field") ?? field ?? null;
  useEffect(() => {
    if (find === null) return;
    setParams(
      (p) => {
        p.delete("find");
        p.delete("field");
        return p;
      },
      { replace: true },
    );
    if (target === null)
      throw new Error("Переход из поиска: адрес не называет поле документа.");
    if (select !== undefined) {
      select(find);
      return;
    }
    const element = document.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`[data-field="${CSS.escape(target)}"]`);
    if (element === null)
      throw new Error(`Переход из поиска: в документе нет поля «${target}».`);
    const section = element.closest("details");
    if (section !== null) section.open = true;
    element.focus();
    const at = foldText(element.value).indexOf(foldText(find));
    if (at >= 0) element.setSelectionRange(at, at + find.length);
    else element.setSelectionRange(0, 0);
    element.scrollIntoView({ block: "center" });
  }, [find, target, setParams, select]);
}

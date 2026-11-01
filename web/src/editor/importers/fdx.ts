import type { Mark, Node } from "prosemirror-model";

import { ELEMENT_NAMES, ELEMENTS, type ElementName } from "../elements.ts";
import { schema } from "../schema/index.ts";
import { ImportError } from "./ImportError.ts";

const TYPE_OF: Record<string, ElementName> = Object.fromEntries(
  ELEMENT_NAMES.map((name) => [ELEMENTS[name].fdx, name]),
);

function marks(text: Element): Mark[] {
  const style = text.getAttribute("Style") ?? "";
  const result: Mark[] = [];
  if (style.includes("Bold")) result.push(schema.marks.bold.create());
  if (style.includes("Italic")) result.push(schema.marks.italic.create());
  if (style.includes("Underline")) result.push(schema.marks.underline.create());
  return result;
}

/** Final Draft XML to a document; the whole file is read before anything changes. */
export function fdxToDoc(xml: string): Node {
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const error = dom.querySelector("parsererror");
  if (error !== null) {
    throw new ImportError(
      `Файл не разобран как XML: ${error.textContent?.trim() ?? ""}`,
    );
  }
  if (dom.documentElement.nodeName !== "FinalDraft") {
    throw new ImportError(
      `Это не файл Final Draft: корневой элемент «${dom.documentElement.nodeName}» вместо «FinalDraft».`,
    );
  }

  const nodes: Node[] = [];
  dom.querySelectorAll("Content > Paragraph").forEach((para, i) => {
    const fdxType = para.getAttribute("Type");
    if (fdxType === null)
      throw new ImportError(`У абзаца ${i + 1} нет типа (Type).`);
    const type = TYPE_OF[fdxType];
    if (type === undefined) {
      throw new ImportError(
        `Абзац ${i + 1}: неизвестный тип Final Draft «${fdxType}».`,
      );
    }
    const inline: Node[] = [];
    para.querySelectorAll("Text").forEach((text) => {
      const content = text.textContent ?? "";
      if (content !== "") inline.push(schema.text(content, marks(text)));
    });
    // Final Draft keeps the brackets of a parenthetical; the editor draws them itself.
    if (type === "parenthetical" && inline.length > 0) {
      const first = inline[0].text ?? "";
      const last = inline[inline.length - 1].text ?? "";
      if (first.startsWith("(") && last.endsWith(")")) {
        const trim = (n: Node, text: string) =>
          text === "" ? [] : [schema.text(text, n.marks)];
        const lastIndex = inline.length - 1;
        if (lastIndex === 0) {
          inline.splice(0, 1, ...trim(inline[0], first.slice(1, -1)));
        } else {
          inline.splice(
            lastIndex,
            1,
            ...trim(inline[lastIndex], last.slice(0, -1)),
          );
          inline.splice(0, 1, ...trim(inline[0], first.slice(1)));
        }
      }
    }
    nodes.push(schema.nodes[type].create(null, inline));
  });
  if (nodes.length === 0)
    throw new ImportError("В файле Final Draft нет абзацев сценария.");
  return schema.nodes.doc.create(null, nodes);
}

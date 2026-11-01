import type { Node } from "prosemirror-model";

import { ELEMENTS, isElementName } from "../elements.ts";

function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Bold, italic and underline go as Style; text colour and fill have no Final Draft form.
function texts(node: Node, wrap: boolean): string {
  if (node.childCount === 0) return wrap ? "<Text>()</Text>" : "<Text></Text>";
  const parts: string[] = [];
  node.forEach((child, _offset, i) => {
    const styles = child.marks
      .map(
        (m) =>
          ({ bold: "Bold", italic: "Italic", underline: "Underline" })[
            m.type.name
          ],
      )
      .filter((s) => s !== undefined);
    let text = child.text ?? "";
    if (wrap && i === 0) text = `(${text}`;
    if (wrap && i === node.childCount - 1) text = `${text})`;
    const style = styles.length > 0 ? ` Style="${styles.join("+")}"` : "";
    parts.push(`<Text${style}>${escapeXML(text)}</Text>`);
  });
  return parts.join("");
}

export function docToFDX(doc: Node): string {
  const paragraphs: string[] = [];
  doc.forEach((node) => {
    const name = node.type.name;
    if (name === "pageBreak") return;
    if (!isElementName(name))
      throw new Error(`Нет типа Final Draft для «${name}»`);
    paragraphs.push(
      `    <Paragraph Type="${ELEMENTS[name].fdx}">\n      ${texts(node, name === "parenthetical")}\n    </Paragraph>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
${paragraphs.join("\n")}
  </Content>
</FinalDraft>
`;
}

// Paragraph comparison of two screenplay texts (screenplay-drafts, decision 3), without DOM.
import { paragraphs, type Paragraph, type ScreenplayDoc } from "./document.ts";

export type ComparedParagraph = Paragraph & {
  /** Not in the other text: struck on the «было» side, underlined on the «стало» side. */
  changed: boolean;
};

export type Comparison = {
  before: ComparedParagraph[];
  after: ComparedParagraph[];
};

/**
 * Paragraphs of both texts, those outside the longest common subsequence by «type + text»
 * marked as changed, as `compareHTML` of mockup v2. A moved paragraph is removed and added.
 */
export function compareDocs(a: ScreenplayDoc, b: ScreenplayDoc): Comparison {
  const before = paragraphs(a);
  const after = paragraphs(b);
  const key = (p: Paragraph) => `${p.type}|${p.text.trim()}`;
  const ka = before.map(key);
  const kb = after.map(key);
  // lcs[i][j]: length of the common subsequence of ka[i..] and kb[j..].
  const lcs = Array.from({ length: ka.length + 1 }, () =>
    new Array<number>(kb.length + 1).fill(0),
  );
  for (let i = ka.length - 1; i >= 0; i--)
    for (let j = kb.length - 1; j >= 0; j--)
      lcs[i][j] =
        ka[i] === kb[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const keptA = new Set<number>();
  const keptB = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < ka.length && j < kb.length) {
    if (ka[i] === kb[j]) {
      keptA.add(i++);
      keptB.add(j++);
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return {
    before: before.map((p, n) => ({ ...p, changed: !keptA.has(n) })),
    after: after.map((p, n) => ({ ...p, changed: !keptB.has(n) })),
  };
}

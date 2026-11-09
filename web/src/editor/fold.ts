/**
 * Lower case and «ё» as «е», one character for one, as the search of the core folds text
 * (agno/core/search.py, design of project-search, decision 2): a character whose lower case is
 * longer stays as is, so a position in the folded text is the position in the written one.
 */
export function foldText(text: string): string {
  let lowered = text.toLowerCase();
  if (lowered.length !== text.length)
    lowered = Array.from(text, (char) => {
      const low = char.toLowerCase();
      return low.length === char.length ? low : char;
    }).join("");
  return lowered.replaceAll("ё", "е");
}

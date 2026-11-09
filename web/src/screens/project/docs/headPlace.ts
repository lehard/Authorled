/**
 * Place of a row at the top of a document, centred at `max-w` 900px (1000px for `wide`): the left
 * margin centres it, the right one also keeps the room of the account menu free
 * (--account-reserve of DocView; openspec/specs/web/workspace, «Шапка документа»).
 */
export function headPlace(wide: boolean): string {
  return wide
    ? "ml-[max(0px,calc((100%_-_1000px)/2))] mr-[max(var(--account-reserve),calc((100%_-_1000px)/2))]"
    : "ml-[max(0px,calc((100%_-_900px)/2))] mr-[max(var(--account-reserve),calc((100%_-_900px)/2))]";
}

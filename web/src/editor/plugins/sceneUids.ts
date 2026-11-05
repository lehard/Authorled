import { Plugin, PluginKey } from "prosemirror-state";
import { Mapping } from "prosemirror-transform";

// A lasting `uid` on every scene heading (web/screenplay-editor, «Постоянный uid сцены»): a new
// heading, a pasted copy and the second half of a split heading get a new one; the heading the
// id came from keeps it. The ids join the same undo step as the change that needed them.

export const sceneUidsKey = new PluginKey("sceneUids");

export const sceneUidsPlugin = new Plugin({
  key: sceneUidsKey,
  appendTransaction(trs, oldState, newState) {
    if (!trs.some((tr) => tr.docChanged)) return null;
    const mapping = new Mapping();
    for (const tr of trs) mapping.appendMapping(tr.mapping);
    // Where each id stood before the change, mapped into the new document.
    const origin = new Map<string, number>();
    oldState.doc.forEach((node, offset) => {
      const uid = node.attrs.uid as string | undefined;
      if (node.type.name === "sceneHeading" && uid !== undefined && uid !== "")
        origin.set(uid, mapping.map(offset, 1));
    });
    const headings: { offset: number; uid: string }[] = [];
    newState.doc.forEach((node, offset) => {
      if (node.type.name === "sceneHeading")
        headings.push({ offset, uid: node.attrs.uid as string });
    });
    const keeper = new Map<string, number>();
    for (const h of headings) {
      if (h.uid === "") continue;
      const first = keeper.get(h.uid);
      if (first === undefined || origin.get(h.uid) === h.offset)
        keeper.set(h.uid, h.offset);
    }
    const tr = newState.tr;
    for (const h of headings) {
      if (h.uid !== "" && keeper.get(h.uid) === h.offset) continue;
      tr.setNodeAttribute(h.offset, "uid", crypto.randomUUID());
    }
    return tr.docChanged ? tr : null;
  },
});

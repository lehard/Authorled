import type { Node } from "prosemirror-model";
import { PluginKey, type Command } from "prosemirror-state";

import { schema } from "../schema/index.ts";
import { hiddenIn } from "./visibility.ts";

// Places of comment threads (design of screenplay-comments, decisions 1, 2 and 4). The mark
// `comment` keeps the place in the text; the threads themselves live in the app's data.

export type CommentRange = { from: number; to: number };

export type CommentsState = {
  /** Threads shown in the text: open ones and the one being written. */
  open: Set<string>;
  /** The thread whose card is open. */
  active: string | null;
  /** Commented words of every place in the text, by thread. */
  quotes: Map<string, string>;
};

export type CommentsMeta = { open?: string[]; active?: string | null };

export const commentsKey = new PluginKey<CommentsState>("comments");

/** Ranges of the thread's mark, adjacent pieces merged. */
export function commentRanges(doc: Node, id: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    if (
      !node.marks.some(
        (m) => m.type === schema.marks.comment && m.attrs.id === id,
      )
    )
      return false;
    const last = ranges.at(-1);
    if (last !== undefined && last.to === pos) last.to = pos + node.nodeSize;
    else ranges.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return ranges;
}

/** Commented words by thread; a thread without a place in the text is absent. */
export function commentQuotes(doc: Node): Map<string, string> {
  const parts = new Map<string, string[]>();
  let block = -1;
  const lastBlock = new Map<string, number>();
  doc.forEach((paragraph, _offset, index) => {
    block = index;
    paragraph.forEach((child) => {
      for (const mark of child.marks) {
        if (mark.type !== schema.marks.comment) continue;
        const id = mark.attrs.id as string;
        const list = parts.get(id) ?? [];
        // Pieces of one paragraph join as they are; paragraphs join with a space.
        if (list.length > 0 && lastBlock.get(id) === block)
          list[list.length - 1] += child.text ?? "";
        else list.push(child.text ?? "");
        lastBlock.set(id, block);
        parts.set(id, list);
      }
    });
  });
  return new Map([...parts].map(([id, list]) => [id, list.join(" ")]));
}

/**
 * Marks the selection as the place of thread `id`, outside the undo history. In the treatment
 * only the shown paragraphs get the mark. An empty selection is an error of the caller.
 */
export function addComment(id: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) throw new Error("Комментарий ставится на выделенный текст");
    const hidden = hiddenIn(state);
    const mark = schema.marks.comment.create({ id });
    const tr = state.tr;
    state.doc.forEach((node, offset, index) => {
      const start = Math.max(from, offset + 1);
      const end = Math.min(to, offset + node.nodeSize - 1);
      if (start < end && !hidden.has(index)) tr.addMark(start, end, mark);
    });
    if (!tr.docChanged) return false;
    dispatch?.(tr.setMeta("addToHistory", false));
    return true;
  };
}

/** Removes every place of thread `id`, outside the undo history. */
export function removeComment(id: string): Command {
  return (state, dispatch) => {
    const mark = schema.marks.comment.create({ id });
    const tr = state.tr;
    for (const r of commentRanges(state.doc, id))
      tr.removeMark(r.from, r.to, mark);
    if (!tr.docChanged) return false;
    dispatch?.(tr.setMeta("addToHistory", false));
    return true;
  };
}

export function setComments(meta: CommentsMeta): Command {
  return (state, dispatch) => {
    dispatch?.(state.tr.setMeta(commentsKey, meta));
    return true;
  };
}

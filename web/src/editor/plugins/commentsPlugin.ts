import { Plugin, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { schema } from "../schema/index.ts";
import {
  commentQuotes,
  commentsKey,
  type CommentsMeta,
  type CommentsState,
} from "./comments.ts";

// Highlight and click of comment places (screenplay-comments, decision 4); the commands are in
// comments.ts, which runs without a DOM in check:editor.

/** The innermost open thread under a clicked element, or null. */
function threadAt(
  target: EventTarget | null,
  root: HTMLElement,
  open: Set<string>,
) {
  let el = target instanceof Element ? target : null;
  while (el !== null && el !== root) {
    const id = el.getAttribute("data-comment-id");
    if (id !== null && open.has(id)) return id;
    el = el.parentElement;
  }
  return null;
}

/** Highlights open threads, marks the active one, and reports a click on an open place. */
export function commentsPlugin(
  onOpen: (id: string) => void,
): Plugin<CommentsState> {
  return new Plugin<CommentsState>({
    key: commentsKey,
    state: {
      init: (_config, state) => ({
        open: new Set(),
        active: null,
        quotes: commentQuotes(state.doc),
      }),
      apply(tr, value) {
        const meta = tr.getMeta(commentsKey) as CommentsMeta | undefined;
        if (meta === undefined && !tr.docChanged) return value;
        return {
          open: meta?.open === undefined ? value.open : new Set(meta.open),
          active: meta?.active === undefined ? value.active : meta.active,
          quotes: tr.docChanged ? commentQuotes(tr.doc) : value.quotes,
        };
      },
    },
    props: {
      decorations(state: EditorState) {
        const s = commentsKey.getState(state);
        if (s === undefined || s.open.size === 0) return DecorationSet.empty;
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isText) return true;
          for (const mark of node.marks) {
            const id = mark.attrs.id as string;
            if (mark.type !== schema.marks.comment || !s.open.has(id)) continue;
            decorations.push(
              Decoration.inline(pos, pos + node.nodeSize, {
                class:
                  id === s.active
                    ? "pw-comment-open pw-comment-active"
                    : "pw-comment-open",
              }),
            );
          }
          return false;
        });
        return DecorationSet.create(state.doc, decorations);
      },
      handleClick(view, _pos, event) {
        const s = commentsKey.getState(view.state);
        if (s === undefined) return false;
        const id = threadAt(event.target, view.dom, s.open);
        if (id !== null) onOpen(id);
        // The caret still goes where the author clicked.
        return false;
      },
    },
  });
}

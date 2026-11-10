import { Plugin, TextSelection } from "prosemirror-state";

import { parentheticalInDialogue } from "../keymaps/index.ts";
import { schema } from "../schema/index.ts";

// Brackets typed in a dialogue and a parenthetical (web/screenplay-editor, «Ремарка из скобки»,
// «Скобки внутри ремарки», «Ремарка внутри реплики»). The styles draw the brackets of a
// parenthetical, so the typed ones do not go into the text. Only typed characters come here:
// pasted text and other paragraph types keep their brackets.

const WHITESPACE = /\s+$/u;

export const parenthesisPlugin = new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (from !== to || (text !== "(" && text !== ")")) return false;
      const { state } = view;
      const $at = state.doc.resolve(from);
      const parent = $at.parent;
      const size = parent.content.size;
      const offset = $at.parentOffset;
      const type = parent.type.name;

      if (type === "parenthetical") {
        // The drawn brackets are there already.
        return (
          (text === "(" && offset === 0) || (text === ")" && offset === size)
        );
      }
      if (type !== "dialogue" || text !== "(") return false;

      if (size === 0) {
        view.dispatch(
          state.tr
            .setNodeMarkup($at.before(), schema.nodes.parenthetical)
            .scrollIntoView(),
        );
        return true;
      }
      if (offset === size) {
        const trailing = WHITESPACE.exec(parent.textContent);
        const cut = trailing === null ? from : from - trailing[0].length;
        const tr = state.tr.delete(cut, from);
        tr.split(cut, 1, [{ type: schema.nodes.parenthetical }]);
        tr.setSelection(TextSelection.create(tr.doc, cut + 2));
        view.dispatch(tr.scrollIntoView());
        return true;
      }
      if (offset === 0) return false;
      return parentheticalInDialogue(state, view.dispatch);
    },
  },
});

import { toggleMark } from "prosemirror-commands";
import type { MarkType } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { clearColour, setColour } from "../commands.ts";
import { MARK_COLORS } from "../elements.ts";
import { schema } from "../schema/index.ts";

export const bubbleMenuKey = new PluginKey("bubbleMenu");

// lucide «message-square-plus», the icon of comments in the toolbar.
const COMMENT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 8v6"/><path d="M9 11h6"/></svg>';

function activeColour(state: EditorState, type: MarkType): string | null {
  const { from, to, empty, $from } = state.selection;
  if (empty)
    return (
      (type.isInSet(state.storedMarks ?? $from.marks())?.attrs
        .color as string) ?? null
    );
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    const mark = type.isInSet(node.marks);
    if (mark !== undefined) found = mark.attrs.color as string;
  });
  return found;
}

function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty)
    return type.isInSet(state.storedMarks ?? $from.marks()) !== undefined;
  return state.doc.rangeHasMark(from, to, type);
}

type Item = {
  label: string;
  className: string;
  html: string;
  run: Command;
  active: (state: EditorState) => boolean;
};

const ITEMS: (Item | "sep")[] = [
  {
    label: "Жирный",
    className: "",
    html: "<strong>Ж</strong>",
    run: toggleMark(schema.marks.bold),
    active: (s) => markActive(s, schema.marks.bold),
  },
  {
    label: "Курсив",
    className: "",
    html: "<em>К</em>",
    run: toggleMark(schema.marks.italic),
    active: (s) => markActive(s, schema.marks.italic),
  },
  {
    label: "Подчёркнутый",
    className: "",
    html: "<u>Ч</u>",
    run: toggleMark(schema.marks.underline),
    active: (s) => markActive(s, schema.marks.underline),
  },
  "sep",
  ...MARK_COLORS.map((c): Item => ({
    label: `Цвет текста ${c}`,
    className: `pw-swatch pw-swatch-text pw-mark-${c}`,
    html: "А",
    run: setColour(schema.marks.textColor, c),
    active: (s) => activeColour(s, schema.marks.textColor) === c,
  })),
  {
    label: "Без цвета",
    className: "pw-swatch pw-swatch-none",
    html: "А",
    run: clearColour(schema.marks.textColor),
    active: () => false,
  },
  "sep",
  ...MARK_COLORS.map((c): Item => ({
    label: `Заливка ${c}`,
    className: `pw-swatch pw-swatch-fill pw-mark-${c}`,
    html: "",
    run: setColour(schema.marks.highlight, c),
    active: (s) => activeColour(s, schema.marks.highlight) === c,
  })),
  {
    label: "Без заливки",
    className: "pw-swatch pw-swatch-fill pw-swatch-none",
    html: "",
    run: clearColour(schema.marks.highlight),
    active: () => false,
  },
];

/** `onComment` adds «Комментировать» at the end of the menu. */
export function createBubbleMenuPlugin(onComment?: () => void): Plugin {
  const items: (Item | "sep")[] =
    onComment === undefined
      ? ITEMS
      : [
          ...ITEMS,
          "sep",
          {
            label: "Комментировать",
            className: "pw-comment-button",
            html: COMMENT_ICON,
            run: () => {
              onComment();
              return true;
            },
            active: () => false,
          },
        ];
  return new Plugin({
    key: bubbleMenuKey,
    view(editorView) {
      const menu = document.createElement("div");
      menu.className = "pw-bubble-menu";
      menu.setAttribute("role", "toolbar");
      menu.setAttribute("aria-label", "Оформление выделенного текста");
      menu.style.display = "none";
      const buttons: [HTMLButtonElement, Item][] = [];
      for (const item of items) {
        if (item === "sep") {
          const sep = document.createElement("span");
          sep.className = "pw-separator";
          menu.appendChild(sep);
          continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = item.className;
        btn.innerHTML = item.html;
        btn.setAttribute("aria-label", item.label);
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          item.run(editorView.state, editorView.dispatch);
          // The comment card takes the focus itself.
          if (item.className !== "pw-comment-button") editorView.focus();
        });
        menu.appendChild(btn);
        buttons.push([btn, item]);
      }
      const parent = editorView.dom.parentElement;
      if (parent === null) throw new Error("Редактор не вставлен в страницу");
      parent.appendChild(menu);

      function position(view: EditorView) {
        const { from, to } = view.state.selection;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const box = parent!.getBoundingClientRect();
        const rect = menu.getBoundingClientRect();
        let left = (start.left + end.right) / 2 - box.left - rect.width / 2;
        left = Math.max(4, Math.min(left, box.width - rect.width - 4));
        menu.style.left = `${left}px`;
        menu.style.top = `${start.top - box.top - rect.height - 8}px`;
      }

      return {
        update(view) {
          if (
            view.state.selection.empty ||
            !view.editable ||
            !view.hasFocus()
          ) {
            menu.style.display = "none";
            return;
          }
          menu.style.display = "flex";
          for (const [btn, item] of buttons) {
            btn.setAttribute("aria-pressed", String(item.active(view.state)));
          }
          requestAnimationFrame(() => {
            if (!view.isDestroyed && menu.style.display !== "none")
              position(view);
          });
        },
        destroy() {
          menu.remove();
        },
      };
    },
  });
}

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

// lucide «pencil-line», «Предложить правку» of a reviewer.
const SUGGEST_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>';

/**
 * «Комментировать» and «Предложить правку» of a reviewer, who reads the text and cannot change it
 * (openspec/specs/web/workspace, «Комментарий и предложение рецензента»).
 */
export type ReviewRequests = {
  onComment: () => void;
  onSuggest: () => void;
};

// lucide «sparkles», the icon of the co-author.
const COAUTHOR_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>';

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
  /** Shown in a read-only text too: it only reads the selection. */
  reads?: boolean;
};

/** The selection of the page, when it is a non-empty range inside the editor. */
function readSelection(view: EditorView): Range | null {
  const selection = view.dom.ownerDocument.getSelection();
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const range = selection.getRangeAt(0);
  return view.dom.contains(range.commonAncestorContainer) ? range : null;
}

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

/**
 * `onComment` adds «Комментировать» at the end of the menu. `onCoauthor` adds «Соавтор» at its
 * start with the rectangle of that button; it stays in a read-only text, alone in the menu
 * (web/workspace, «Проверки над выделением»).
 */
export function createBubbleMenuPlugin(
  onComment?: () => void,
  onCoauthor?: (anchor: DOMRect) => void,
  review?: ReviewRequests,
): Plugin {
  let coauthorButton: HTMLButtonElement | null = null;
  const items: (Item | "sep")[] = [
    ...(onCoauthor === undefined
      ? []
      : [
          {
            label: "Соавтор",
            className: "pw-coauthor-button",
            html: `${COAUTHOR_ICON}<span>Соавтор</span>`,
            run: () => {
              if (coauthorButton === null)
                throw new Error("Кнопки «Соавтор» нет в меню выделения");
              onCoauthor(coauthorButton.getBoundingClientRect());
              return true;
            },
            active: () => false,
            reads: true,
          } satisfies Item,
          "sep" as const,
        ]),
    ...ITEMS,
    ...(onComment === undefined
      ? []
      : [
          "sep" as const,
          {
            label: "Комментировать",
            className: "pw-comment-button",
            html: COMMENT_ICON,
            run: () => {
              onComment();
              return true;
            },
            active: () => false,
          } satisfies Item,
        ]),
    // The review of a reviewer only reads the selection: it stays in a read-only text.
    ...(review === undefined
      ? []
      : [
          {
            label: "Комментировать",
            className: "pw-review-button",
            html: COMMENT_ICON,
            run: () => {
              review.onComment();
              return true;
            },
            active: () => false,
            reads: true,
          } satisfies Item,
          {
            label: "Предложить правку",
            className: "pw-review-button",
            html: SUGGEST_ICON,
            run: () => {
              review.onSuggest();
              return true;
            },
            active: () => false,
            reads: true,
          } satisfies Item,
        ]),
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
      // Everything but the reading buttons, hidden in a read-only text.
      const writing: HTMLElement[] = [];
      for (const item of items) {
        if (item === "sep") {
          const sep = document.createElement("span");
          sep.className = "pw-separator";
          menu.appendChild(sep);
          writing.push(sep);
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
          // The comment card and the menu of the co-author take the focus themselves.
          if (!item.reads && item.className !== "pw-comment-button")
            editorView.focus();
        });
        menu.appendChild(btn);
        buttons.push([btn, item]);
        if (item.className === "pw-coauthor-button") {
          btn.setAttribute("aria-haspopup", "menu");
          coauthorButton = btn;
        }
        if (!item.reads) writing.push(btn);
      }
      const parent = editorView.dom.parentElement;
      if (parent === null) throw new Error("Редактор не вставлен в страницу");
      parent.appendChild(menu);

      /** Over the middle of the selection, from `left` to `right` with its top at `top`. */
      function position(left: number, right: number, top: number) {
        const box = parent!.getBoundingClientRect();
        const rect = menu.getBoundingClientRect();
        let x = (left + right) / 2 - box.left - rect.width / 2;
        x = Math.max(4, Math.min(x, box.width - rect.width - 4));
        menu.style.left = `${x}px`;
        menu.style.top = `${top - box.top - rect.height - 8}px`;
      }

      function show(place: () => [number, number, number]) {
        menu.style.display = "flex";
        requestAnimationFrame(() => {
          if (!editorView.isDestroyed && menu.style.display !== "none")
            position(...place());
        });
      }

      function update(view: EditorView) {
        if (!view.editable) {
          // A read-only text has no selection of the editor: the page's one is read instead.
          const range =
            onCoauthor === undefined && review === undefined
              ? null
              : readSelection(view);
          if (range === null) {
            menu.style.display = "none";
            return;
          }
          for (const element of writing) element.hidden = true;
          show(() => {
            const rect = range.getBoundingClientRect();
            return [rect.left, rect.right, rect.top];
          });
          return;
        }
        for (const element of writing) element.hidden = false;
        if (view.state.selection.empty || !view.hasFocus()) {
          menu.style.display = "none";
          return;
        }
        for (const [btn, item] of buttons) {
          btn.setAttribute("aria-pressed", String(item.active(view.state)));
        }
        show(() => {
          const { from, to } = view.state.selection;
          const start = view.coordsAtPos(from);
          const end = view.coordsAtPos(to);
          return [start.left, end.right, start.top];
        });
      }

      // A read-only text dispatches nothing when the author selects in it.
      const page = editorView.dom.ownerDocument;
      const onSelection = () => {
        if (!editorView.editable) update(editorView);
      };
      page.addEventListener("selectionchange", onSelection);

      return {
        update,
        destroy() {
          page.removeEventListener("selectionchange", onSelection);
          menu.remove();
        },
      };
    },
  });
}

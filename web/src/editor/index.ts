// Screenplay editor: a fork of @plotwell/editor (ORIGIN.md) with the paragraph types and keys
// of STARC (openspec/specs/web/screenplay-editor).
import { baseKeymap } from "prosemirror-commands";
import { history, redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node } from "prosemirror-model";
import { EditorState, TextSelection, type Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import {
  isElementName,
  type EditorMode,
  type ElementName,
} from "./elements.ts";
import {
  placeAnchors,
  placeCommentAnchors,
  type SuggestionAnchor,
} from "./anchors.ts";
import {
  ensureSceneUids,
  toJSON,
  toNode,
  type ScreenplayDoc,
} from "./document.ts";
import { docToFDX } from "./exporters/fdx.ts";
import { docToFountain } from "./exporters/fountain.ts";
import { printScreenplay, type TitlePage } from "./exporters/print.ts";
import { screenplayKeymap, setElement } from "./keymaps/index.ts";
import { createBubbleMenuPlugin } from "./plugins/bubbleMenu.ts";
import {
  cardGapKey,
  cardGapStatePlugin,
  type CardGapMeta,
} from "./plugins/cardGap.ts";
import { cardGapPlugin } from "./plugins/cardGapPlugin.ts";
import {
  addComment,
  commentRanges,
  commentsKey,
  removeComment,
  setComments,
  type CommentsMeta,
} from "./plugins/comments.ts";
import { commentsPlugin } from "./plugins/commentsPlugin.ts";
import {
  acceptSuggestion,
  rejectSuggestion,
  setSuggestions,
  suggestionRanges,
  suggestionsKey,
  suggestionsStatePlugin,
  type SuggestionsMeta,
} from "./plugins/suggestions.ts";
import { suggestionsPlugin } from "./plugins/suggestionsPlugin.ts";
import { createFadeInAlignPlugin } from "./plugins/fadeInAlign.ts";
import {
  closeFind,
  findKey,
  findPlugin,
  replaceAll,
  replaceCurrent,
  setFind,
  type FindScope,
} from "./plugins/find.ts";
import { screenplayInputRules } from "./plugins/inputRules.ts";
import { emptyParagraphsPlugin } from "./plugins/emptyParagraphs.ts";
import { capitalsPlugin } from "./plugins/capitals.ts";
import { parenthesisPlugin } from "./plugins/parenthesis.ts";
import { paginationPlugin } from "./plugins/pagination.ts";
import { sceneNumbersPlugin } from "./plugins/sceneNumbers.ts";
import { sceneUidsPlugin } from "./plugins/sceneUids.ts";
import {
  pick,
  setSuggestData,
  suggestKey,
  suggestPlugin,
  type SuggestData,
  type Suggestion,
} from "./plugins/suggest.ts";
import {
  blockIndex,
  hiddenIn,
  outlineCaret,
  outlineGuardKey,
  outlineGuardPlugin,
  sceneRange,
  visibilityKey,
  visibilityPlugin,
  type ViewOptions,
} from "./plugins/visibility.ts";

/** What the toolbar, the find bar and the suggestion list draw (design of screenplay-text-tools, decision 1). */
export type EditorSnapshot = {
  element: ElementName | null;
  canUndo: boolean;
  canRedo: boolean;
  view: ViewOptions;
  find: { query: string; scope: FindScope; count: number; current: number };
  suggest: {
    head: string;
    items: Suggestion[];
    index: number;
    /** Caret position relative to the editor container, for placing the list under it. */
    left: number;
    bottom: number;
  } | null;
  /** Number of the scene with the caret, or null without scenes. */
  scene: number | null;
  /** Commented words by thread id; threads without a place in the text are absent. */
  comments: ReadonlyMap<string, string>;
  /** Suggestions with a shown place and the text they would replace, in text order. */
  suggestions: [id: string, old: string][];
  /** Ids of every suggestion with a mark in the text, shown or hidden, in text order. */
  marked: string[];
};

/** Where a comment's or suggestion's place is, relative to the editor container (screenplay-comments, decision 6). */
export type CommentAnchor = {
  top: number;
  bottom: number;
  /** Right edge of the page. */
  pageRight: number;
  /** Width of the container. */
  width: number;
};

/** Where the gap for a card stands, relative to the editor container (web/workspace, «Карточки у текста»). */
export type CardGapPlace = {
  top: number;
  /** Distances from the left and right edges of the container: the card spans the page. */
  left: number;
  right: number;
};

export type ScreenplayEditorOptions = {
  container: HTMLElement;
  doc: ScreenplayDoc;
  /** The text, or the treatment (scene headings, beats, groups and acts) of the same document. */
  mode: EditorMode;
  onChange?: (doc: ScreenplayDoc) => void;
  /** The state of the editor, after every change of state. */
  onState?: (snapshot: EditorSnapshot) => void;
  /** ⌘F or Ctrl+F in the text. */
  onFindRequest?: () => void;
  /** «Комментировать» in the selection menu; without it the menu has no such button. */
  onCommentRequest?: () => void;
  /**
   * «Соавтор» in the selection menu, with the rectangle of that button; without it the menu has
   * no such button. It stays in a read-only text.
   */
  onCoauthorRequest?: (anchor: DOMRect) => void;
  /** A click on an open comment's place. */
  onCommentOpen?: (id: string) => void;
  /** A click on an open co-author suggestion. */
  onSuggestionOpen?: (id: string) => void;
  readOnly?: boolean;
  /** Additional ProseMirror plugins, after ours. */
  extraPlugins?: Plugin[];
};

/** Space around a card in its gap: above and below together, and on the sides of the page. */
const CARD_GAP_MARGIN = 12;
const CARD_GAP_INSET = 12;
/** Width of the US Letter page at 96 dpi; the styles set the same `--pw-page-w`. */
const PAGE_WIDTH = 816;
/** Below this scale the page would be too small to read: one continuous sheet instead. */
const MIN_SCALE = 0.6;
/** Space between the sticky toolbar and the line scrolled to below it. */
const SCROLL_GAP = 8;

export class ScreenplayEditorView {
  readonly view: EditorView;
  private readonly container: HTMLElement;
  private readOnly: boolean;
  private readonly fitting: ResizeObserver;
  /** Scale of the page set by `fit`; 1 at full size and for the continuous sheet. */
  private scale = 1;
  private fitFrame: number | null = null;

  constructor(options: ScreenplayEditorOptions) {
    this.readOnly = options.readOnly ?? false;
    this.container = options.container;
    const plugins = [
      // Before the input rules: a typed bracket in a dialogue makes a parenthetical.
      parenthesisPlugin,
      screenplayInputRules,
      // Before the keys of the types: an open list takes arrows, Enter, Tab and Escape.
      suggestPlugin,
      keymap({
        "Mod-f": () => {
          options.onFindRequest?.();
          return options.onFindRequest !== undefined;
        },
      }),
      screenplayKeymap(options.mode),
      keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
      // Without Escape: its «select the parent node» selected the whole paragraph and kept Escape
      // from closing the card of a comment or a suggestion (web/workspace, «Карточки у текста»).
      keymap(
        Object.fromEntries(
          Object.entries(baseKeymap).filter(([key]) => key !== "Escape"),
        ),
      ),
      history(),
      capitalsPlugin,
      sceneUidsPlugin,
      // Visibility before find: find skips the paragraphs it hides.
      visibilityPlugin(options.mode === "outline"),
      ...(options.mode === "outline" ? [outlineGuardPlugin] : []),
      // Before find: find skips open suggestions.
      suggestionsStatePlugin,
      findPlugin,
      paginationPlugin,
      sceneNumbersPlugin,
      emptyParagraphsPlugin,
      createFadeInAlignPlugin(),
      commentsPlugin((id) => options.onCommentOpen?.(id)),
      suggestionsPlugin((id) => options.onSuggestionOpen?.(id)),
      createBubbleMenuPlugin(
        options.onCommentRequest,
        options.onCoauthorRequest,
      ),
      cardGapStatePlugin,
      cardGapPlugin,
      ...(options.extraPlugins ?? []),
    ];
    // A text without scene ids (sample data) gets them on opening.
    const doc = toNode(ensureSceneUids(options.doc));
    // The treatment opens with the caret in its first shown paragraph.
    const at = options.mode === "outline" ? outlineCaret(doc, 1) : null;
    const state = EditorState.create({
      doc,
      plugins,
      selection: at === null ? undefined : TextSelection.create(doc, at),
    });
    const report = (s: EditorState) => options.onState?.(this.snapshot(s));

    this.view = new EditorView(options.container, {
      state,
      editable: () => !this.readOnly,
      attributes: {
        "aria-label": "Текст сценария",
        lang: "ru",
        spellcheck: "true",
      },
      handleDOMEvents: {
        dragstart: (_, e) => {
          e.preventDefault();
          return true;
        },
        drop: (_, e) => {
          e.preventDefault();
          return true;
        },
      },
      dispatchTransaction: (tr) => {
        const next = this.view.state.apply(tr);
        this.view.updateState(next);
        if (tr.docChanged) options.onChange?.(toJSON(next.doc));
        report(next);
      },
    });
    report(state);
    // The page follows the width of the container (web/screenplay-editor, «Масштаб листа»),
    // and the space it takes follows the height of the pages.
    // In the next frame, not in the observer's callback: the margin `fit` sets changes the height
    // of the observed container, which the callback could not deliver in the same frame.
    this.fitting = new ResizeObserver(() => {
      if (this.fitFrame !== null) return;
      this.fitFrame = requestAnimationFrame(() => {
        this.fitFrame = null;
        this.fit();
      });
    });
    this.fitting.observe(this.container);
    this.fitting.observe(this.view.dom);
    this.fit();
  }

  /**
   * Scales the page to the width of the container, down to 60%; narrower, the continuous sheet.
   * `transform` keeps the layout of the 100% page, so the page breaks stay its own; it does not
   * shrink the space the page takes, so a negative bottom margin gives back the height the
   * scale removes, and the container clips the unused width on the sides. `zoom` is not used:
   * in WebKit clicks and selection under it miss the text (editor-fit-and-speed, design).
   */
  private fit(): void {
    const width = this.container.clientWidth;
    const scale = Math.min(1, width / PAGE_WIDTH);
    const paged = scale >= MIN_SCALE;
    this.container.classList.toggle("pw-paged", paged);
    this.container.classList.toggle("pw-continuous", !paged);
    this.scale = paged ? scale : 1;
    const style = this.view.dom.style;
    if (this.scale === 1) {
      style.transform = "";
      style.transformOrigin = "";
      style.marginBottom = "";
      return;
    }
    style.transform = `scale(${this.scale})`;
    style.transformOrigin = "top center";
    style.marginBottom = `${-(1 - this.scale) * this.view.dom.offsetHeight}px`;
  }

  /**
   * Keeps the line scrolled to below the sticky toolbar above the page: `px` is its height
   * (web/screenplay-editor, «Каретка ниже панели инструментов»). ProseMirror scrolls to the
   * caret by `scrollThreshold` and `scrollMargin`; `scrollIntoView` of a scene, a comment or a suggestion reads
   * `scroll-margin-top` from `--pw-scroll-top`. Both are in pixels of the scrolling column,
   * so the scale of the page does not change them.
   */
  setTopInset(px: number): void {
    if (!Number.isFinite(px) || px < 0)
      throw new Error(
        `Отступ прокрутки сверху: недопустимая высота панели ${px}`,
      );
    const top = px + SCROLL_GAP;
    // The threshold decides when to scroll, the margin how far: with the threshold at 0 a caret
    // under the toolbar counts as visible and nothing scrolls.
    this.view.setProps({
      scrollThreshold: { top, right: 0, bottom: 0, left: 0 },
      scrollMargin: { top, right: 5, bottom: 5, left: 5 },
    });
    this.container.style.setProperty("--pw-scroll-top", `${top}px`);
  }

  private snapshot(s: EditorState): EditorSnapshot {
    const name = s.selection.$from.parent.type.name;
    const find = findKey.getState(s);
    const view = visibilityKey.getState(s);
    const suggest = suggestKey.getState(s);
    const comments = commentsKey.getState(s);
    const suggestions = suggestionsKey.getState(s);
    if (
      find === undefined ||
      view === undefined ||
      suggest === undefined ||
      comments === undefined ||
      suggestions === undefined
    ) {
      throw new Error("Плагины редактора не подключены");
    }
    const range = sceneRange(s.doc, blockIndex(s.doc, s.selection.head));
    let scene: number | null = null;
    if (range !== null) {
      scene = 0;
      s.doc.forEach((n, _o, i) => {
        if (i <= range[0] && n.type.name === "sceneHeading")
          scene = (scene ?? 0) + 1;
      });
    }
    let list: EditorSnapshot["suggest"] = null;
    if (suggest.list !== null) {
      const at = this.view.coordsAtPos(s.selection.head);
      const box = this.container.getBoundingClientRect();
      list = {
        ...suggest.list,
        index: suggest.index,
        left: at.left - box.left,
        bottom: at.bottom - box.top,
      };
    }
    return {
      element: isElementName(name) ? name : null,
      canUndo: undoDepth(s) > 0,
      canRedo: redoDepth(s) > 0,
      view,
      find: {
        query: find.query,
        scope: find.scope,
        count: find.matches.length,
        current: find.current,
      },
      suggest: list,
      scene,
      comments: comments.quotes,
      suggestions: this.shownSuggestions(s, suggestions.order),
      marked: suggestions.order,
    };
  }

  private shownSuggestions(
    s: EditorState,
    order: string[],
  ): [string, string][] {
    const hidden = hiddenIn(s);
    return order.flatMap((id): [string, string][] => {
      const ranges = suggestionRanges(s.doc, id);
      const first = ranges[0];
      if (first === undefined || hidden.has(blockIndex(s.doc, first.from)))
        return [];
      return [
        [id, ranges.map((r) => s.doc.textBetween(r.from, r.to)).join(" ")],
      ];
    });
  }

  undo(): void {
    undo(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  redo(): void {
    redo(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  setView(options: Partial<ViewOptions>): void {
    this.view.dispatch(this.view.state.tr.setMeta(visibilityKey, options));
  }

  /** Sets the query or the scope, or moves to match `current` (selected and scrolled to). */
  find(meta: { query?: string; scope?: FindScope; current?: number }): void {
    setFind(meta)(this.view.state, this.view.dispatch);
    // With the focus in the find bar ProseMirror does not scroll to the selected match: its
    // scrolling needs the DOM selection inside the editor. The match is scrolled to here,
    // below the toolbar by `scroll-margin-top` (web/screenplay-editor, «Каретка ниже панели
    // инструментов»). Find skips hidden paragraphs, so the current match is always shown.
    if (meta.current === undefined) return;
    const find = findKey.getState(this.view.state);
    if (find === undefined) throw new Error("Плагин find не подключён");
    if (find.matches.length === 0) return;
    const match = this.view.dom.querySelector(".pw-find-current");
    if (match === null)
      throw new Error("Поиск: текущее совпадение не показано в листе");
    match.scrollIntoView({ block: "nearest" });
  }

  /**
   * Opens the search with `query` in the whole text; the current match is the first one from the
   * caret on, or from the start of the text (web/workspace, «Переход к совпадению из поиска по
   * истории»).
   */
  openFind(query: string, from: "caret" | "start"): void {
    const at = from === "start" ? 0 : this.view.state.selection.from;
    setFind({ query, scope: "all" })(this.view.state, this.view.dispatch);
    const find = findKey.getState(this.view.state);
    if (find === undefined) throw new Error("Плагин find не подключён");
    if (find.matches.length === 0) return;
    const next = find.matches.findIndex((m) => m.from >= at);
    this.find({ current: next === -1 ? 0 : next });
  }

  /** Ends the search; a selected match becomes the caret after it. */
  closeFind(): void {
    closeFind()(this.view.state, this.view.dispatch);
  }

  replaceCurrent(text: string): void {
    replaceCurrent(text)(this.view.state, this.view.dispatch);
  }

  replaceAll(text: string): void {
    replaceAll(text)(this.view.state, this.view.dispatch);
  }

  /** Puts the caret at the start of scene `number`; false when there is no such scene. */
  goToScene(number: number): boolean {
    const { state } = this.view;
    let found: number | null = null;
    let n = 0;
    state.doc.forEach((node, offset) => {
      if (node.type.name === "sceneHeading" && ++n === number) found = offset;
    });
    if (found === null) return false;
    const pos = (found as number) + 1;
    this.view.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, pos)),
    );
    this.view.focus();
    const dom = this.view.nodeDOM(found);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center" });
    return true;
  }

  pickSuggestion(index: number): void {
    this.view.dispatch(pick(this.view.state, index));
    this.view.focus();
  }

  setSuggestData(data: SuggestData): void {
    this.view.dispatch(setSuggestData(data)(this.view.state));
  }

  focus(): void {
    this.view.focus();
  }

  /** Marks the selection as the place of thread `id`; false when nothing shown is selected. */
  addComment(id: string): boolean {
    return addComment(id)(this.view.state, this.view.dispatch);
  }

  removeComment(id: string): void {
    removeComment(id)(this.view.state, this.view.dispatch);
  }

  /** Which threads are highlighted (open and the one being written) and whose card is open. */
  setComments(meta: CommentsMeta): void {
    setComments(meta)(this.view.state, this.view.dispatch);
  }

  /** Which suggestions are shown (open ones with their text) and whose card is open. */
  setSuggestions(meta: SuggestionsMeta): void {
    setSuggestions(meta)(this.view.state, this.view.dispatch);
  }

  /** «Принять»: the old text becomes `text`; false when the suggestion is not in the text. */
  acceptSuggestion(id: string, text: string): boolean {
    return acceptSuggestion(id, text)(this.view.state, this.view.dispatch);
  }

  /**
   * Marks open suggestions that have no place in the text yet by their anchor, as one ordinary
   * edit (it is saved and undone like typing); the rest stay without a mark.
   */
  placeSuggestions(anchors: SuggestionAnchor[]): void {
    const tr = this.view.state.tr;
    placeAnchors(tr, anchors);
    if (tr.docChanged) this.view.dispatch(tr);
  }

  /**
   * Marks open comment threads of the co-author that have no place in the text yet by their
   * anchor, outside the undo history, as a new comment of the author is; the rest stay without
   * a mark (web/workspace, «Комментарий соавтора по якорю»).
   */
  placeComments(anchors: SuggestionAnchor[]): void {
    const tr = this.view.state.tr;
    placeCommentAnchors(tr, anchors);
    if (tr.docChanged) this.view.dispatch(tr.setMeta("addToHistory", false));
  }

  /** «Отклонить»: the text stays; false when the suggestion is not in the text. */
  rejectSuggestion(id: string): boolean {
    return rejectSuggestion(id)(this.view.state, this.view.dispatch);
  }

  /** Like `commentAnchor`; the bottom also takes the suggested text shown after the place. */
  suggestionAnchor(id: string): CommentAnchor | null {
    const anchor = this.anchor(suggestionRanges(this.view.state.doc, id));
    const ins = this.view.dom.querySelector(
      `ins[data-suggestion-id="${CSS.escape(id)}"]`,
    );
    if (anchor === null || ins === null) return anchor;
    const box = this.container.getBoundingClientRect();
    const bottom = ins.getBoundingClientRect().bottom - box.top;
    return { ...anchor, bottom: Math.max(anchor.bottom, bottom) };
  }

  scrollToSuggestion(id: string): boolean {
    const dom = this.firstPlace(suggestionRanges(this.view.state.doc, id));
    dom?.scrollIntoView({ block: "center" });
    return dom !== null;
  }

  /** Selects the old text of the suggestion and focuses the editor, so the chat picks it up. */
  selectSuggestion(id: string): boolean {
    const ranges = suggestionRanges(this.view.state.doc, id);
    const first = ranges[0];
    const last = ranges.at(-1);
    if (first === undefined || last === undefined) return false;
    const { state } = this.view;
    this.view.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, first.from, last.to),
      ),
    );
    this.view.focus();
    return true;
  }

  /** The first shown place of thread `id`, or null when it is not in the text or hidden. */
  commentAnchor(id: string): CommentAnchor | null {
    return this.anchor(commentRanges(this.view.state.doc, id));
  }

  private anchor(ranges: { from: number }[]): CommentAnchor | null {
    const dom = this.firstPlace(ranges);
    if (dom === null) return null;
    const at = dom.getBoundingClientRect();
    const box = this.container.getBoundingClientRect();
    const page = this.view.dom.getBoundingClientRect();
    return {
      top: at.top - box.top,
      bottom: at.bottom - box.top,
      pageRight: page.right - box.left,
      width: box.width,
    };
  }

  /**
   * Opens, or resizes, the gap under the paragraph where the place of comment thread or
   * suggestion `id` ends, for a card `height` screen pixels high; null when the place is not
   * shown. The gap does not change the document: no save and no step of undo.
   */
  showCardGap(id: string, height: number): CardGapPlace | null {
    const { state } = this.view;
    const ranges = [
      ...commentRanges(state.doc, id),
      ...suggestionRanges(state.doc, id),
    ];
    if (this.firstPlace(ranges) === null) return null;
    const end = Math.max(...ranges.map((r) => r.to));
    const pos = state.doc.resolve(end).after(1);
    // The gap is inside the page, so it is scaled with it; the card over it is not.
    const meta: CardGapMeta = {
      show: {
        id,
        pos,
        height: Math.ceil((height + CARD_GAP_MARGIN) / this.scale),
      },
    };
    this.view.dispatch(
      state.tr.setMeta(cardGapKey, meta).setMeta("addToHistory", false),
    );
    const gap = this.view.dom.querySelector(
      `.pw-card-gap[data-for="${CSS.escape(id)}"]`,
    );
    if (!(gap instanceof HTMLElement))
      throw new Error("Зазор для карточки не появился в тексте.");
    const box = this.container.getBoundingClientRect();
    const page = this.view.dom.getBoundingClientRect();
    return {
      top: gap.getBoundingClientRect().top - box.top + CARD_GAP_MARGIN / 2,
      left: page.left - box.left + CARD_GAP_INSET,
      right: box.right - page.right + CARD_GAP_INSET,
    };
  }

  /** Closes the gap of the card of `id`; a gap another card opened since stays. */
  hideCardGap(id: string): void {
    const meta: CardGapMeta = { hide: id };
    this.view.dispatch(
      this.view.state.tr
        .setMeta(cardGapKey, meta)
        .setMeta("addToHistory", false),
    );
  }

  /** Scrolls the first shown place of thread `id` into view; false when there is none. */
  scrollToComment(id: string): boolean {
    const dom = this.firstPlace(commentRanges(this.view.state.doc, id));
    dom?.scrollIntoView({ block: "center" });
    return dom !== null;
  }

  private firstPlace(ranges: { from: number }[]): HTMLElement | null {
    for (const r of ranges) {
      const { node } = this.view.domAtPos(r.from + 1);
      const el = node instanceof HTMLElement ? node : node.parentElement;
      // A paragraph hidden by the treatment or by «only this scene» has no box.
      if (el !== null && el.getClientRects().length > 0) return el;
    }
    return null;
  }

  get json(): ScreenplayDoc {
    return toJSON(this.view.state.doc);
  }

  /** Replaces the whole text; undo brings the previous one back. */
  replace(doc: Node): void {
    const { state } = this.view;
    this.view.dispatch(
      state.tr
        .replaceWith(0, state.doc.content.size, doc.content)
        .setMeta(outlineGuardKey, true),
    );
  }

  /** Puts a document from outside (another tab, a reload) without an undo step. */
  load(doc: ScreenplayDoc): void {
    const { state } = this.view;
    const tr = state.tr
      .replaceWith(
        0,
        state.doc.content.size,
        toNode(ensureSceneUids(doc)).content,
      )
      .setMeta(outlineGuardKey, true);
    this.view.dispatch(tr.setMeta("addToHistory", false));
  }

  setElement(type: ElementName): void {
    setElement(type)(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    this.view.setProps({ editable: () => !this.readOnly });
  }

  toFountain(): string {
    return docToFountain(this.view.state.doc);
  }

  toFDX(): string {
    return docToFDX(this.view.state.doc);
  }

  print(titlePage: TitlePage): void {
    printScreenplay(this.view.state.doc, titlePage);
  }

  destroy(): void {
    this.fitting.disconnect();
    if (this.fitFrame !== null) cancelAnimationFrame(this.fitFrame);
    this.view.destroy();
  }
}

export { ELEMENT_NAMES, ELEMENTS, MARK_COLORS } from "./elements.ts";
export type { EditorMode, ElementName, MarkColor } from "./elements.ts";
export { elementsOf } from "./keymaps/index.ts";
export { paragraphs, plainDoc, scenes, screenTime } from "./document.ts";
export type { Paragraph, SceneEntry, ScreenplayDoc } from "./document.ts";
export { FIND_SCOPES, type FindScope } from "./plugins/find.ts";
export type { SuggestData } from "./plugins/suggest.ts";
export type { CommentsMeta } from "./plugins/comments.ts";
export type { SuggestionsMeta } from "./plugins/suggestions.ts";
export type { SuggestionAnchor } from "./anchors.ts";
export { PrintError } from "./exporters/print.ts";
export type { TitlePage } from "./exporters/print.ts";

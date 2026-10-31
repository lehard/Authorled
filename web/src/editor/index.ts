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
import { toJSON, toNode, type ScreenplayDoc } from "./document.ts";
import { docToFDX } from "./exporters/fdx.ts";
import { docToFountain } from "./exporters/fountain.ts";
import { printScreenplay, type TitlePage } from "./exporters/print.ts";
import { fdxToDoc } from "./importers/fdx.ts";
import { fountainToDoc } from "./importers/fountain.ts";
import { ImportError } from "./importers/ImportError.ts";
import { screenplayKeymap, setElement } from "./keymaps/index.ts";
import { createBubbleMenuPlugin } from "./plugins/bubbleMenu.ts";
import {
  addComment,
  commentRanges,
  commentsKey,
  removeComment,
  setComments,
  type CommentsMeta,
} from "./plugins/comments.ts";
import { commentsPlugin } from "./plugins/commentsPlugin.ts";
import { createFadeInAlignPlugin } from "./plugins/fadeInAlign.ts";
import {
  findKey,
  findPlugin,
  replaceAll,
  replaceCurrent,
  setFind,
  type FindScope,
} from "./plugins/find.ts";
import { screenplayInputRules } from "./plugins/inputRules.ts";
import { paginationPlugin } from "./plugins/pagination.ts";
import { sceneNumbersPlugin } from "./plugins/sceneNumbers.ts";
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
};

/** Where a comment's place is, relative to the editor container (screenplay-comments, decision 6). */
export type CommentAnchor = {
  top: number;
  bottom: number;
  /** Right edge of the page. */
  pageRight: number;
  /** Width of the container. */
  width: number;
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
  /** A click on an open comment's place. */
  onCommentOpen?: (id: string) => void;
  readOnly?: boolean;
  /** Additional ProseMirror plugins, after ours. */
  extraPlugins?: Plugin[];
};

/** Reads a Fountain (.fountain) or Final Draft (.fdx) file; throws ImportError. */
export function parseScreenplayFile(name: string, text: string): Node {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "fdx") return fdxToDoc(text);
  if (ext === "fountain" || ext === "spmd") return fountainToDoc(text);
  throw new ImportError(
    `Формат «${name}» не поддерживается: нужен .fountain или .fdx.`,
  );
}

export class ScreenplayEditorView {
  readonly view: EditorView;
  private readonly container: HTMLElement;
  private readOnly: boolean;

  constructor(options: ScreenplayEditorOptions) {
    this.readOnly = options.readOnly ?? false;
    this.container = options.container;
    const plugins = [
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
      keymap(baseKeymap),
      history(),
      // Visibility before find: find skips the paragraphs it hides.
      visibilityPlugin(options.mode === "outline"),
      ...(options.mode === "outline" ? [outlineGuardPlugin] : []),
      findPlugin,
      paginationPlugin,
      sceneNumbersPlugin,
      createFadeInAlignPlugin(),
      commentsPlugin((id) => options.onCommentOpen?.(id)),
      createBubbleMenuPlugin(options.onCommentRequest),
      ...(options.extraPlugins ?? []),
    ];
    const doc = toNode(options.doc);
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
  }

  private snapshot(s: EditorState): EditorSnapshot {
    const name = s.selection.$from.parent.type.name;
    const find = findKey.getState(s);
    const view = visibilityKey.getState(s);
    const suggest = suggestKey.getState(s);
    const comments = commentsKey.getState(s);
    if (
      find === undefined ||
      view === undefined ||
      suggest === undefined ||
      comments === undefined
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
    };
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

  /** The first shown place of thread `id`, or null when it is not in the text or hidden. */
  commentAnchor(id: string): CommentAnchor | null {
    const dom = this.firstPlace(id);
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

  /** Scrolls the first shown place of thread `id` into view; false when there is none. */
  scrollToComment(id: string): boolean {
    const dom = this.firstPlace(id);
    dom?.scrollIntoView({ block: "center" });
    return dom !== null;
  }

  private firstPlace(id: string): HTMLElement | null {
    for (const r of commentRanges(this.view.state.doc, id)) {
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
      .replaceWith(0, state.doc.content.size, toNode(doc).content)
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
    this.view.destroy();
  }
}

export { ELEMENT_NAMES, ELEMENTS, MARK_COLORS } from "./elements.ts";
export type { EditorMode, ElementName, MarkColor } from "./elements.ts";
export { elementsOf } from "./keymaps/index.ts";
export { paragraphs, plainDoc, scenes, screenTime } from "./document.ts";
export type { Paragraph, SceneEntry, ScreenplayDoc } from "./document.ts";
export { ImportError } from "./importers/ImportError.ts";
export { FIND_SCOPES, type FindScope } from "./plugins/find.ts";
export type { SuggestData } from "./plugins/suggest.ts";
export type { CommentsMeta } from "./plugins/comments.ts";
export { PrintError } from "./exporters/print.ts";
export type { TitlePage } from "./exporters/print.ts";

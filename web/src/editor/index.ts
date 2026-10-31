// Screenplay editor: a fork of @plotwell/editor (ORIGIN.md) with the paragraph types and keys
// of STARC (openspec/specs/web/screenplay-editor).
import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node } from "prosemirror-model";
import { EditorState, type Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { isElementName, type ElementName } from "./elements.ts";
import { toJSON, toNode, type ScreenplayDoc } from "./document.ts";
import { docToFDX } from "./exporters/fdx.ts";
import { docToFountain } from "./exporters/fountain.ts";
import { printScreenplay, type TitlePage } from "./exporters/print.ts";
import { fdxToDoc } from "./importers/fdx.ts";
import { fountainToDoc } from "./importers/fountain.ts";
import { ImportError } from "./importers/ImportError.ts";
import { screenplayKeymap, setElement } from "./keymaps/index.ts";
import { createBubbleMenuPlugin } from "./plugins/bubbleMenu.ts";
import { createFadeInAlignPlugin } from "./plugins/fadeInAlign.ts";
import { screenplayInputRules } from "./plugins/inputRules.ts";
import { paginationPlugin } from "./plugins/pagination.ts";
import { sceneNumbersPlugin } from "./plugins/sceneNumbers.ts";

export type ScreenplayEditorOptions = {
  container: HTMLElement;
  doc: ScreenplayDoc;
  onChange?: (doc: ScreenplayDoc) => void;
  /** The type of the paragraph with the caret, after every change of state. */
  onElement?: (type: ElementName | null) => void;
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
  private readOnly: boolean;

  constructor(options: ScreenplayEditorOptions) {
    this.readOnly = options.readOnly ?? false;
    const plugins = [
      screenplayInputRules,
      screenplayKeymap,
      keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
      keymap(baseKeymap),
      history(),
      paginationPlugin,
      sceneNumbersPlugin,
      createFadeInAlignPlugin(),
      createBubbleMenuPlugin(),
      ...(options.extraPlugins ?? []),
    ];
    const state = EditorState.create({ doc: toNode(options.doc), plugins });
    const report = (s: EditorState) => {
      const name = s.selection.$from.parent.type.name;
      options.onElement?.(isElementName(name) ? name : null);
    };

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

  get json(): ScreenplayDoc {
    return toJSON(this.view.state.doc);
  }

  /** Replaces the whole text; undo brings the previous one back. */
  replace(doc: Node): void {
    const { state } = this.view;
    this.view.dispatch(
      state.tr.replaceWith(0, state.doc.content.size, doc.content),
    );
  }

  /** Puts a document from outside (another tab, a reload) without an undo step. */
  load(doc: ScreenplayDoc): void {
    const { state } = this.view;
    const tr = state.tr.replaceWith(
      0,
      state.doc.content.size,
      toNode(doc).content,
    );
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
export type { ElementName, MarkColor } from "./elements.ts";
export { paragraphs, plainDoc } from "./document.ts";
export type { Paragraph, ScreenplayDoc } from "./document.ts";
export { ImportError } from "./importers/ImportError.ts";
export { PrintError } from "./exporters/print.ts";
export type { TitlePage } from "./exporters/print.ts";

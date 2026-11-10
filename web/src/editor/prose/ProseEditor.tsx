// The prose editor of the synopsis (openspec/specs/web/prose-editor; design of synopsis-editor, decisions
// 1, 7, 9 and 11): ProseMirror with the prose schema on the continuous sheet, the sticky toolbar with the
// count of pages, and the marks of the page starts. Its value is the Markdown of the field.
import { baseKeymap } from "prosemirror-commands";
import { history, redo, redoDepth, undo, undoDepth } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node } from "prosemirror-model";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

import { hardBreak, PROSE_COMMANDS } from "./commands.ts";
import { layoutProse, type ProseLayout } from "./layout.ts";
import { parseProse, ProseMarkupError, serializeProse } from "./markdown.ts";
import { pageMarks, type PageMark } from "./pageMarks.ts";
import { findInProse } from "./positions.ts";
import { printProse } from "./print.ts";
import { ProseToolbar, type ProseSnapshot } from "./ProseToolbar.tsx";
import { proseSchema, type HeadingLevel } from "./schema.ts";

import "./styles.css";

/** Space between the sticky toolbar and the line scrolled to below it, as in the screenplay editor. */
const SCROLL_GAP = 8;
/** Milliseconds after the last change before the pages are laid out again. */
const LAYOUT_DELAY = 150;

export type ProseEditorHandle = {
  /** Selects the first match of a query of the story search; without a match the caret goes to the start. */
  selectFind: (query: string) => void;
  /** Opens the print window with the pages of the current layout. */
  print: () => Promise<void>;
  /** Whether the layout of the current text is ready (the print needs it). */
  canPrint: () => boolean;
};

function placeholderPlugin(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        const first = doc.firstChild;
        if (doc.childCount !== 1 || first === null || first.content.size > 0)
          return null;
        return DecorationSet.create(doc, [
          Decoration.node(0, first.nodeSize, {
            class: "prose-empty",
            "data-placeholder": text,
          }),
        ]);
      },
    },
  });
}

function tryParse(markdown: string): { doc: Node } | { error: string } {
  try {
    return { doc: parseProse(markdown) };
  } catch (e) {
    if (e instanceof ProseMarkupError) return { error: e.message };
    throw e;
  }
}

function snapshotOf(state: EditorState): ProseSnapshot {
  const { $from, from, to, empty } = state.selection;
  const parent = $from.parent;
  const style =
    parent.type === proseSchema.nodes.heading
      ? (`heading${parent.attrs.level as HeadingLevel}` as const)
      : ("paragraph" as const);
  const active = (type: (typeof proseSchema.marks)["strong"]) =>
    empty
      ? type.isInSet(state.storedMarks ?? $from.marks()) !== undefined
      : state.doc.rangeHasMark(from, to, type);
  return {
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    style,
    bold: active(proseSchema.marks.strong),
    italic: active(proseSchema.marks.em),
  };
}

export function ProseEditor({
  ref,
  value,
  onChange,
  readOnly,
  title,
  field,
  label,
  placeholder,
  children,
}: {
  ref?: Ref<ProseEditorHandle>;
  value: string;
  onChange: (markdown: string) => void;
  readOnly: boolean;
  /** Title of the story: the head of the first printed page. */
  title: string;
  /** `data-field` of the editable text, for the jump from the story search. */
  field: string;
  label: string;
  placeholder: string;
  /** Drawn on the sheet over the text (the tasks of the co-author on an empty synopsis). */
  children?: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The Markdown the editor wrote last: a value that differs came from elsewhere.
  const written = useRef(value);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  });
  // The document of the value, or why the editor cannot show it (a heading of the third level).
  const parsed = useMemo(() => tryParse(value), [value]);
  const first = useRef(parsed);
  const [snap, setSnap] = useState<ProseSnapshot | null>(null);
  const [doc, setDoc] = useState<Node | null>(null);
  const [layout, setLayout] = useState<ProseLayout | null>(null);
  const [marks, setMarks] = useState<PageMark[]>([]);
  const [layoutError, setLayoutError] = useState<Error | null>(null);

  // A layout error is a broken page font or geometry: it stops the screen, as any other error.
  if (layoutError !== null) throw layoutError;

  useEffect(() => {
    const opened = first.current;
    // A text the editor cannot show is reported instead of the editor.
    if ("error" in opened) return;
    const initial = opened.doc;
    const host = mount.current;
    if (host === null) throw new Error("ProseEditor: нет места для редактора");
    const editor = new EditorView(host, {
      state: EditorState.create({
        doc: initial,
        plugins: [
          history(),
          keymap({
            "Mod-z": undo,
            "Shift-Mod-z": redo,
            "Mod-y": redo,
            "Mod-b": PROSE_COMMANDS.bold,
            "Mod-i": PROSE_COMMANDS.italic,
            "Mod-Alt-1": PROSE_COMMANDS.heading1,
            "Mod-Alt-2": PROSE_COMMANDS.heading2,
            "Mod-Alt-0": PROSE_COMMANDS.paragraph,
            "Shift-Enter": hardBreak,
          }),
          keymap(baseKeymap),
          placeholderPlugin(placeholder),
        ],
      }),
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        "data-field": field,
        class: "prose-text",
      },
      dispatchTransaction(tr) {
        const next = editor.state.apply(tr);
        editor.updateState(next);
        setSnap(snapshotOf(next));
        if (!tr.docChanged) return;
        setDoc(next.doc);
        const markdown = serializeProse(next.doc);
        if (markdown === written.current) return;
        written.current = markdown;
        change.current(markdown);
      },
    });
    view.current = editor;
    setSnap(snapshotOf(editor.state));
    setDoc(editor.state.doc);
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is made once; the value, read-only state and labels reach it through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value from elsewhere (the co-author, a save restored): one step of the history, so undo brings
  // the previous text back.
  useEffect(() => {
    const editor = view.current;
    if (editor === null || value === written.current || "error" in parsed)
      return;
    const next = parsed.doc;
    written.current = value;
    const { state } = editor;
    const tr = state.tr.replaceWith(0, state.doc.content.size, next.content);
    editor.dispatch(tr.setSelection(TextSelection.atStart(tr.doc)));
  }, [value, parsed]);

  useEffect(() => {
    view.current?.setProps({ editable: () => !readOnly });
  }, [readOnly]);

  const mounted = doc !== null;
  // The scrolled-to line stays below the sticky toolbar (web/prose-editor, «Каретка не под панелью»).
  useEffect(() => {
    const editor = view.current;
    const bar = toolbar.current;
    if (editor === null || bar === null) return;
    const inset = new ResizeObserver(() => {
      const top = bar.offsetHeight + SCROLL_GAP;
      editor.setProps({
        scrollThreshold: { top, right: 0, bottom: 0, left: 0 },
        scrollMargin: { top, right: 5, bottom: 5, left: 5 },
      });
    });
    inset.observe(bar);
    return () => inset.disconnect();
  }, [mounted]);

  // The pages of the current text, a moment after the last change: typing does not lay out on every key.
  // A timer, not a frame: the layout does not need the screen, and a hidden tab has no frames.
  useEffect(() => {
    if (doc === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      layoutProse(doc, title).then(
        (laid) => {
          if (!cancelled) setLayout(laid);
        },
        (error: unknown) => {
          if (!cancelled)
            setLayoutError(
              error instanceof Error ? error : new Error(String(error)),
            );
        },
      );
    }, LAYOUT_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, title]);

  // Marks follow the layout and the width of the sheet.
  useEffect(() => {
    const editor = view.current;
    const page = sheet.current;
    if (editor === null || page === null || layout === null) return;
    const place = () => {
      if (layout.doc !== editor.state.doc) return;
      setMarks(pageMarks(editor, layout, page));
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(page);
    return () => resize.disconnect();
  }, [layout]);

  const current = layout !== null && layout.doc === doc ? layout : null;

  useImperativeHandle(
    ref,
    () => ({
      selectFind(query) {
        const editor = view.current;
        if (editor === null) return;
        const found = findInProse(editor.state.doc, query);
        const { tr } = editor.state;
        const selection =
          found === null
            ? TextSelection.atStart(tr.doc)
            : TextSelection.create(tr.doc, found.from, found.to);
        editor.focus();
        editor.dispatch(tr.setSelection(selection).scrollIntoView());
      },
      async print() {
        if (current === null)
          throw new Error("Печать синопсиса: страницы ещё не свёрстаны");
        await printProse(current.doc, current, title);
      },
      canPrint: () => current !== null,
    }),
    [current, title],
  );

  if ("error" in parsed)
    return (
      <div role="alert" className="sheet sheet-prose text-destructive">
        Синопсис не открывается: {parsed.error}
      </div>
    );

  const empty = doc !== null && doc.textContent === "" && doc.childCount === 1;
  return (
    <>
      <ProseToolbar
        ref={toolbar}
        snap={snap}
        readOnly={readOnly}
        pages={current === null ? null : empty ? 0 : current.pages.length}
        words={current?.words ?? null}
        chars={current?.chars ?? null}
        run={(command) => {
          const editor = view.current;
          if (editor === null) return;
          command(editor.state, editor.dispatch);
          editor.focus();
        }}
      />
      <div ref={sheet} className="sheet sheet-prose relative">
        <div ref={mount} />
        {children}
        {marks.map((mark) => (
          <span
            key={mark.page}
            aria-hidden
            className="prose-page-mark"
            data-page={`стр. ${mark.page}`}
            data-page-short={String(mark.page)}
            style={{ top: mark.top }}
          />
        ))}
      </div>
    </>
  );
}

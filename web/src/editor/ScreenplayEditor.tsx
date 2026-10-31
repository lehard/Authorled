import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Node } from "prosemirror-model";

import {
  ELEMENT_NAMES,
  ELEMENTS,
  ScreenplayEditorView,
  type ElementName,
  type ScreenplayDoc,
  type TitlePage,
} from "./index.ts";
import { toJSON, toNode } from "./document.ts";
import "./styles.css";

/** What the screen can ask of the editor. */
export type ScreenplayEditorHandle = {
  toFountain(): string;
  toFDX(): string;
  print(titlePage: TitlePage): void;
  /** Replaces the whole text (an import); undo brings the previous one back. */
  replace(doc: Node): void;
  focus(): void;
};

/**
 * The screenplay editor in React (design, decision 11): one ProseMirror view per mount,
 * destroyed on unmount, and a new `doc` from outside replaces the text only when it differs
 * from what the author has typed.
 */
export function ScreenplayEditor({
  doc,
  onChange,
  readOnly = false,
  toolbar,
  ref,
}: {
  doc: ScreenplayDoc;
  onChange?: (doc: ScreenplayDoc) => void;
  readOnly?: boolean;
  /** Actions at the end of the editor toolbar. */
  toolbar?: ReactNode;
  ref?: Ref<ScreenplayEditorHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<ScreenplayEditorView | null>(null);
  const [element, setElementName] = useState<ElementName | null>(null);
  // The latest props, read by the editor's callbacks and the first mount.
  const latest = useRef({ doc, onChange });
  // Texts this editor has reported: a saved copy coming back is an echo, not a change from
  // outside, even when the author has typed on since (an older echo must not undo typing).
  const reported = useRef<string[]>([]);
  useEffect(() => {
    latest.current = { doc, onChange };
  });

  useEffect(() => {
    if (host.current === null)
      throw new Error("ScreenplayEditor: нет контейнера");
    const view = new ScreenplayEditorView({
      container: host.current,
      doc: latest.current.doc,
      onChange: (next) => {
        reported.current = [
          ...reported.current.slice(-49),
          JSON.stringify(next),
        ];
        latest.current.onChange?.(next);
      },
      onElement: setElementName,
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (view === null) return;
    // Normalised through the schema: key order of the incoming JSON may differ.
    const json = JSON.stringify(toJSON(toNode(doc)));
    if (reported.current.includes(json) || json === JSON.stringify(view.json))
      return;
    view.load(doc);
  }, [doc]);

  useEffect(() => {
    editor.current?.setReadOnly(readOnly);
  }, [readOnly]);

  useImperativeHandle(ref, () => {
    const view = () => {
      if (editor.current === null)
        throw new Error("Редактор сценария ещё не открыт");
      return editor.current;
    };
    return {
      toFountain: () => view().toFountain(),
      toFDX: () => view().toFDX(),
      print: (titlePage) => view().print(titlePage),
      replace: (next) => view().replace(next),
      focus: () => view().view.focus(),
    };
  }, []);

  return (
    <div className="grid gap-3">
      <div className="sticky top-2 z-10 mx-auto flex w-full max-w-[816px] flex-wrap items-center gap-2 rounded-2xl bg-panel px-2 py-1.5 shadow-panel">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly || element === null}
              aria-label="Тип абзаца"
              className="min-w-48 justify-between"
            >
              {element === null ? "Тип абзаца" : ELEMENTS[element].label}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-72"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              editor.current?.view.focus();
            }}
          >
            {ELEMENT_NAMES.map((name) => (
              <DropdownMenuItem
                key={name}
                aria-current={name === element ? "true" : undefined}
                className={name === element ? "font-semibold" : undefined}
                onSelect={() => editor.current?.setElement(name)}
              >
                {ELEMENTS[name].label}
                <DropdownMenuShortcut>
                  {ELEMENTS[name].shortcut}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {toolbar}
        </div>
      </div>
      <div ref={host} className="pw-editor" />
    </div>
  );
}

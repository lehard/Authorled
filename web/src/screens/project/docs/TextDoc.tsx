import { Download, FileUp, Printer } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Script } from "@/data/model";
import { ImportError, parseScreenplayFile, PrintError } from "@/editor";
import {
  ScreenplayEditor,
  type ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";
import { useAutosave } from "@/screens/shared/useAutosave";

import type { Node } from "prosemirror-model";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** «Текст сценария»: the screenplay editor with autosave, import, export and print. */
export function TextDoc() {
  const { script } = useProjectData();
  const { save, status } = useAutosave<Script>("scripts", script.id);
  const editor = useRef<ScreenplayEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ name: string; doc: Node } | null>(
    null,
  );
  const base = script.name.trim() === "" ? "Сценарий" : script.name.trim();

  function act(action: () => void) {
    setError(null);
    try {
      action();
    } catch (e) {
      if (e instanceof ImportError || e instanceof PrintError) {
        setError(e.message);
        return;
      }
      throw e;
    }
  }

  async function chooseFile(file: File) {
    const text = await file.text();
    act(() =>
      setPending({
        name: file.name,
        doc: parseScreenplayFile(file.name, text),
      }),
    );
  }

  return (
    <>
      <DocHead title="Текст сценария" status={status} wide />
      <input
        ref={fileInput}
        type="file"
        accept=".fountain,.spmd,.fdx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file !== undefined) void chooseFile(file);
        }}
      />
      <ScreenplayEditor
        ref={editor}
        doc={script.text}
        onChange={(text) => save({ text })}
        toolbar={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp />
              Импорт
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Download />
                  Экспорт
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    download(
                      `${base}.fountain`,
                      "text/plain;charset=utf-8",
                      editor.current!.toFountain(),
                    )
                  }
                >
                  Fountain (.fountain)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    download(
                      `${base}.fdx`,
                      "application/xml;charset=utf-8",
                      editor.current!.toFDX(),
                    )
                  }
                >
                  Final Draft (.fdx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => act(() => editor.current!.print(script.titlePage))}
            >
              <Printer />
              Печать
            </Button>
          </>
        }
      />
      {error !== null && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-2xl bg-paper px-4 py-3 text-caption text-destructive shadow-paper"
        >
          {error}{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setError(null)}
          >
            Закрыть
          </button>
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Заменить текст сценария?"
        text={`Текст заменится содержимым файла «${pending?.name ?? ""}». Вернуть прежний можно отменой правки (Ctrl+Z или ⌘Z).`}
        actionLabel="Заменить"
        // After the import the caret goes to the text, so undo works at once.
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.current!.focus();
        }}
        onConfirm={() => {
          if (pending !== null) editor.current!.replace(pending.doc);
          setPending(null);
        }}
      />
    </>
  );
}

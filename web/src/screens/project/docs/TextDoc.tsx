import { AlignLeft, Download, FileUp, LayoutGrid, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SCRIPT_PARTS } from "@/data/model";
import {
  ImportError,
  parseScreenplayFile,
  PrintError,
  type EditorMode,
} from "@/editor";
import {
  ScreenplayEditor,
  type ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import type { Node } from "prosemirror-model";

import { useProjectData } from "../ProjectContext";
import { DocHead } from "./DocHead";
import { SceneBoard } from "./SceneBoard";

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * «Текст сценария» and «Поэпизодник»: the editor over the shared text of the story, or its
 * scene cards (`?view=cards`, scene-outline-and-cards, decision 5).
 */
export function TextDoc({ mode }: { mode: EditorMode }) {
  const { script, chars, locs, text, setText, textStatus, setCurrentScene } =
    useProjectData();
  const editor = useRef<ScreenplayEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ name: string; doc: Node } | null>(
    null,
  );
  const base = script.name.trim() === "" ? "Сценарий" : script.name.trim();
  const suggestData = useMemo(
    () => ({
      characters: chars.map((c) => c.name),
      locations: locs.map((l) => l.name),
    }),
    [chars, locs],
  );

  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "cards" ? "cards" : "text";
  // «?scene=N» from the scene list or a card: the caret goes to that scene once.
  const sceneParam = view === "text" ? params.get("scene") : null;
  useEffect(() => {
    if (sceneParam === null) return;
    const number = Number(sceneParam);
    const found = Number.isInteger(number) && editor.current!.goToScene(number);
    setParams(
      (p) => {
        p.delete("scene");
        return p;
      },
      { replace: true },
    );
    if (!found) setError(`Сцены ${sceneParam} нет в тексте.`);
  }, [sceneParam, setParams]);

  function show(next: "text" | "cards", scene?: number) {
    const p = new URLSearchParams();
    if (next === "cards") p.set("view", "cards");
    if (scene !== undefined) p.set("scene", String(scene));
    setParams(p);
  }
  useEffect(() => () => setCurrentScene(null), [setCurrentScene]);

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
      <DocHead
        title={SCRIPT_PARTS[mode === "text" ? "text" : "treatment"]}
        status={textStatus}
        wide
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(v) => {
            if (v === "text" || v === "cards") show(v);
          }}
          aria-label="Вид"
        >
          <ToggleGroupItem
            value="text"
            aria-label="Текст"
            className="gap-1.5 px-2.5"
          >
            <AlignLeft />
            <span className="max-sm:sr-only">Текст</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="cards"
            aria-label="Карточки"
            className="gap-1.5 px-2.5"
          >
            <LayoutGrid />
            <span className="max-sm:sr-only">Карточки</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </DocHead>
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
      {view === "cards" ? (
        <SceneBoard mode={mode} onOpen={(n) => show("text", n)} />
      ) : (
        <ScreenplayEditor
          key={mode}
          ref={editor}
          mode={mode}
          doc={text}
          onChange={setText}
          suggestData={suggestData}
          onScene={setCurrentScene}
          menu={
            mode === "outline" ? undefined : (
              <>
                <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                  <FileUp />
                  Импорт…
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Download />
                    Экспорт
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
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
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onSelect={() =>
                    act(() => editor.current!.print(script.titlePage))
                  }
                >
                  <Printer />
                  Печать…
                </DropdownMenuItem>
              </>
            )
          }
        />
      )}
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

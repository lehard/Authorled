import { useInvalidate } from "@refinedev/core";
import { AlignLeft, FileUp, LayoutGrid } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MANUSCRIPT_TYPES,
  useStoryFiles,
  type SkippedRecord,
} from "@/data/files";
import { SCRIPT_PARTS } from "@/data/model";
import { PrintError, type EditorMode } from "@/editor";
import { toNode } from "@/editor/document.ts";
import {
  ScreenplayEditor,
  type ScreenplayEditorHandle,
} from "@/editor/ScreenplayEditor";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { ChecksAtSelection } from "../chat/ChecksMenu";

import { useProjectData } from "../ProjectContext";
import { ActionError, ExportItems } from "./ExportItems";
import { useEditorComments } from "./useEditorComments";
import { useEditorSuggestions } from "./useEditorSuggestions";
import { DocHead } from "./DocHead";
import { ImportSkipped } from "./ImportSkipped";
import { SaveHistory } from "./SaveHistory";
import { SceneBoard } from "./SceneBoard";

/**
 * «Текст сценария» and «Поэпизодник»: the editor over the shared text of the story, or its
 * scene cards (`?view=cards`, scene-outline-and-cards, decision 5).
 */
export function TextDoc({ mode }: { mode: EditorMode }) {
  const data = useProjectData();
  const {
    project,
    draft,
    script,
    chars,
    locs,
    text,
    setText,
    textStatus,
    setCurrentScene,
    openChat,
  } = data;
  const editor = useRef<ScreenplayEditorHandle>(null);
  // One card at a time: a comment thread or a co-author suggestion.
  const closeSuggestion = useRef<(() => void) | null>(null);
  const comments = useEditorComments(
    draft.id,
    editor,
    () => {
      if (closeSuggestion.current === null)
        throw new Error("Предложения соавтора ещё не подключены");
      closeSuggestion.current();
    },
    draft.locked,
  );
  const suggestions = useEditorSuggestions(
    draft.id,
    editor,
    () => comments.close(),
    openChat,
    draft.locked,
  );
  useEffect(() => {
    closeSuggestion.current = suggestions.close;
  });
  const [error, setError] = useState<string | null>(null);
  // «Соавтор» of the selection menu: its checks open at the rectangle of that button.
  const [checksAt, setChecksAt] = useState<DOMRect | null>(null);
  // Import through the core (web/workspace, «Импорт, экспорт и печать на экране»).
  const files = useStoryFiles();
  const invalidate = useInvalidate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  // What the imported file did not have (web/workspace, «Предупреждение о пропущенном при
  // импорте»): from the import here, or from the shelf once, in the state of the address of a new
  // story; that state is dropped at once, so a reload or «Назад» does not show it again.
  const location = useLocation();
  const navigate = useNavigate();
  const [skipped, setSkipped] = useState<SkippedRecord[]>(() =>
    importSkippedOf(location.state),
  );
  useEffect(() => {
    if (importSkippedOf(location.state).length > 0)
      void navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
  }, [location, navigate]);
  const suggestData = useMemo(
    () => ({
      characters: chars.map((c) => c.name),
      locations: locs.map((l) => l.name),
    }),
    [chars, locs],
  );

  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "cards" ? "cards" : "text";
  // «?scene=N» from the scene list or a card: the caret goes to that scene once. «find=…» from the
  // search of the story then opens the find bar with that query, its current match the first one in
  // the scene, or in the whole text without a scene (web/workspace, «Переход к совпадению из поиска
  // по истории»).
  const sceneParam = view === "text" ? params.get("scene") : null;
  const findParam = view === "text" ? params.get("find") : null;
  useEffect(() => {
    if (sceneParam === null && findParam === null) return;
    const number = Number(sceneParam);
    const found =
      sceneParam === null ||
      (Number.isInteger(number) && editor.current!.goToScene(number));
    if (found && findParam !== null)
      editor.current!.openFind(
        findParam,
        sceneParam === null ? "start" : "caret",
      );
    setParams(
      (p) => {
        p.delete("scene");
        p.delete("find");
        return p;
      },
      { replace: true },
    );
    if (!found) setError(`Сцены ${sceneParam} нет в тексте.`);
  }, [sceneParam, findParam, setParams]);

  // The core reads the file and replaces the text with its revision; the editor takes the new
  // text as an ordinary edit, so undo brings the previous one back. A refusal leaves the text.
  async function importFile(file: File) {
    setError(null);
    setSkipped([]);
    setImporting(true);
    try {
      const uploaded = await files.upload({
        projectId: project.id,
        file,
        purpose: "import",
      });
      const { text: imported, skipped: missing } = await files.importInto(
        draft.id,
        uploaded.id,
      );
      // The cards may be open by now: then the text of the window takes it.
      if (editor.current === null) setText(imported);
      else editor.current.replace(toNode(imported));
      // New characters and locations of the manuscript.
      for (const resource of ["characters", "locations", "scripts"])
        void invalidate({ resource, invalidates: ["list", "detail"] });
      setSkipped(missing);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

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
      if (e instanceof PrintError) {
        setError(e.message);
        return;
      }
      throw e;
    }
  }

  return (
    <>
      <DocHead
        title={SCRIPT_PARTS[mode === "text" ? "text" : "treatment"]}
        status={textStatus}
        wide
      >
        <SaveHistory target={{ draftId: draft.id, part: "text" }} />
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
        accept={MANUSCRIPT_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file !== undefined) setPending(file);
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
          readOnly={draft.locked}
          onChange={setText}
          suggestData={suggestData}
          onScene={setCurrentScene}
          comments={comments.comments}
          suggestions={suggestions.suggestions}
          onCoauthorRequest={setChecksAt}
          tools={
            <>
              {suggestions.tools}
              {comments.tools}
            </>
          }
          overlay={
            <>
              {comments.overlay}
              {suggestions.overlay}
            </>
          }
          menu={
            mode === "outline" ? undefined : (
              <>
                <DropdownMenuItem
                  disabled={importing || draft.locked}
                  onSelect={() => fileInput.current?.click()}
                >
                  <FileUp />
                  {importing ? "Импортируем…" : "Импорт…"}
                </DropdownMenuItem>
                <ExportItems
                  name={project.title}
                  editor={editor}
                  titlePage={script.titlePage}
                  act={act}
                />
              </>
            )
          }
        />
      )}
      <ChecksAtSelection anchor={checksAt} onClose={() => setChecksAt(null)} />
      <ActionError error={error} onClose={() => setError(null)} />
      <ImportSkipped skipped={skipped} onClose={() => setSkipped([])} />
      {comments.dialog}
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
          if (pending !== null) void importFile(pending);
          setPending(null);
        }}
      />
    </>
  );
}

/** The list a new story from a manuscript brings in the state of its address (shelf/ShelfScreen). */
function importSkippedOf(state: unknown): SkippedRecord[] {
  if (
    typeof state !== "object" ||
    state === null ||
    !("importSkipped" in state)
  )
    return [];
  return (state as { importSkipped: SkippedRecord[] }).importSkipped;
}

import { Download, Printer } from "lucide-react";
import type { RefObject } from "react";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { TitlePage } from "@/data/model";
import type { ScreenplayEditorHandle } from "@/editor/ScreenplayEditor";

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** «Экспорт» and «Печать…» of the «⋯» menu of an editor: the text, or a draft. */
export function ExportItems({
  name,
  editor,
  titlePage,
  act,
}: {
  /** File name without the extension. */
  name: string;
  editor: RefObject<ScreenplayEditorHandle | null>;
  titlePage: TitlePage;
  /** Runs an action and shows its print error. */
  act: (action: () => void) => void;
}) {
  const view = () => {
    if (editor.current === null)
      throw new Error("Редактор сценария ещё не открыт");
    return editor.current;
  };
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Download />
          Экспорт
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            onSelect={() =>
              download(
                `${name}.fountain`,
                "text/plain;charset=utf-8",
                view().toFountain(),
              )
            }
          >
            Fountain (.fountain)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              download(
                `${name}.fdx`,
                "application/xml;charset=utf-8",
                view().toFDX(),
              )
            }
          >
            Final Draft (.fdx)
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onSelect={() => act(() => view().print(titlePage))}>
        <Printer />
        Печать…
      </DropdownMenuItem>
    </>
  );
}

/** An error of an editor action at the bottom of the window. */
export function ActionError({
  error,
  onClose,
}: {
  error: string | null;
  onClose: () => void;
}) {
  if (error === null) return null;
  return (
    <p
      role="alert"
      className="fixed bottom-6 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-2xl bg-paper px-4 py-3 text-caption text-destructive shadow-paper"
    >
      {error}{" "}
      <button
        type="button"
        className="text-primary hover:underline"
        onClick={onClose}
      >
        Закрыть
      </button>
    </p>
  );
}

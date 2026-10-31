import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BLOCK_TYPES } from "@/data/model";

import { useProjectData } from "../ProjectContext";

/** «Текст сценария» for reading until the editor arrives (openspec/specs/web/workspace). */
export function TextDoc() {
  const { script } = useProjectData();
  const empty = script.blocks.every((b) => b.text.trim() === "");
  return (
    <>
      <p className="mx-auto mb-4 flex max-w-[760px] items-center gap-2 rounded-2xl bg-panel px-4 py-2.5 text-caption text-muted-foreground shadow-panel">
        <Info className="size-4 shrink-0" />
        Редактор сценария подключается следующим этапом — пока текст только для
        чтения.
      </p>
      <article
        className="sheet sheet-script script"
        aria-label="Текст сценария"
        lang="ru"
      >
        {empty ? (
          <p className="text-muted-foreground">
            Текста пока нет: первая сцена начнётся с заголовка, когда подключим
            редактор.
          </p>
        ) : (
          // The paragraph type shows in the design-system tooltip, not a native `title`.
          <TooltipProvider delayDuration={600}>
            {script.blocks.map((b) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <p className={`b-${b.t}`}>{b.text}</p>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  {BLOCK_TYPES[b.t]}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        )}
      </article>
    </>
  );
}

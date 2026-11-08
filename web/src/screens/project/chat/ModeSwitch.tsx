import { useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { CoauthorMode } from "@/account/meApi";
import { useAccount, useSaveAccount } from "@/account/useAccount";

const MODES: { value: CoauthorMode; label: string; hint: string }[] = [
  {
    value: "ask",
    label: "Спрашивать",
    hint: "Соавтор спрашивает разрешения перед каждым изменением",
  },
  {
    value: "auto",
    label: "Сам",
    hint: "Соавтор вносит изменения сразу и пишет, что сделал",
  },
];

/**
 * The mode of the co-author, saved in the account (openspec/specs/web/workspace, «Режим соавтора
 * в чате»): it works from the next message in every conversation.
 */
export function ModeSwitch() {
  const { data: me } = useAccount();
  const save = useSaveAccount();
  // undefined: nothing chosen here yet, the account's mode is shown.
  const [chosen, setChosen] = useState<CoauthorMode | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  if (me === undefined) return null;
  const current = chosen ?? me.coauthorMode;

  async function choose(mode: CoauthorMode) {
    if (mode === current) return;
    setChosen(mode);
    setError(null);
    try {
      await save({ coauthor_mode: mode });
    } catch (err) {
      setError(
        `Режим не удалось сохранить: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // Saved: the account in the cache has the new mode; refused: the saved one shows again.
    setChosen(undefined);
  }

  return (
    <div className="grid gap-1">
      <div
        role="radiogroup"
        aria-label="Режим соавтора"
        className="inline-flex justify-self-start rounded-full bg-muted p-0.5 text-caption"
      >
        <TooltipProvider delayDuration={400}>
          {MODES.map((mode) => (
            <Tooltip key={mode.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode.value === current}
                  onClick={() => void choose(mode.value)}
                  className="rounded-full px-2.5 py-0.5 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-checked:bg-paper aria-checked:text-foreground aria-checked:shadow-panel"
                >
                  {mode.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>{mode.hint}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

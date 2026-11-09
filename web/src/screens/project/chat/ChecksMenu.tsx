import { ChevronDown, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useProjectData } from "../ProjectContext";
import { CHECKS } from "./checks";

function ChecksItems({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (request: string) => void;
}) {
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Проверки наставника
      </DropdownMenuLabel>
      {CHECKS.map((check) => (
        <DropdownMenuItem
          key={check.id}
          disabled={disabled}
          onSelect={() => onPick(check.request)}
        >
          {check.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** «Проверки» at the field of the chat (web/workspace, «Проверки наставника»). */
export function ChecksButton({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (request: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="rounded-full text-muted-foreground"
          disabled={disabled}
        >
          <ListChecks />
          Проверки
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="max-w-[calc(100vw-16px)]"
      >
        <ChecksItems disabled={disabled} onPick={onPick} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The checks of «Соавтор» in the selection menu of the editor, at the rectangle of that button
 * (web/workspace, «Проверки над выделением»). The selection is in the chat's state already: the
 * button keeps it on mousedown.
 */
export function ChecksAtSelection({
  anchor,
  onClose,
}: {
  anchor: DOMRect | null;
  onClose: () => void;
}) {
  const { askCoauthor, coauthorBusy } = useProjectData();
  return (
    <DropdownMenu
      open={anchor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger asChild>
        {/* The trigger is only the place of the menu: the button of the editor opens it. */}
        <span
          aria-hidden
          className="pointer-events-none fixed"
          style={
            anchor === null
              ? { display: "none" }
              : {
                  left: anchor.left,
                  top: anchor.top,
                  width: anchor.width,
                  height: anchor.height,
                }
          }
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[calc(100vw-16px)]">
        <ChecksItems
          disabled={coauthorBusy}
          onPick={(request) => {
            askCoauthor(request, "send");
            onClose();
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

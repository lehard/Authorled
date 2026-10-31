import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MenuEntry =
  | {
      label: string;
      icon?: LucideIcon;
      danger?: boolean;
      disabled?: boolean;
      run: () => void;
    }
  | "sep";

/** The same actions of a navigator node by right click and by the «⋮» button. */
export function NodeMenu({
  label,
  items,
  children,
}: {
  label: string;
  items: MenuEntry[];
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/node relative flex items-center">
          {children}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 rounded-full opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-[900px]:opacity-100"
                aria-label={`Действия: ${label}`}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {items.map((it, i) =>
                it === "sep" ? (
                  <DropdownMenuSeparator key={i} />
                ) : (
                  <DropdownMenuItem
                    key={it.label}
                    variant={it.danger ? "destructive" : "default"}
                    disabled={it.disabled}
                    onSelect={it.run}
                  >
                    {it.icon !== undefined && <it.icon />}
                    {it.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((it, i) =>
          it === "sep" ? (
            <ContextMenuSeparator key={i} />
          ) : (
            <ContextMenuItem
              key={it.label}
              variant={it.danger ? "destructive" : "default"}
              disabled={it.disabled}
              onSelect={it.run}
            >
              {it.icon !== undefined && <it.icon />}
              {it.label}
            </ContextMenuItem>
          ),
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

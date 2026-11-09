import { ChevronDown, Sparkles } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useProjectData } from "../ProjectContext";
import { DOC_TASKS } from "./docTasks";

/**
 * «Соавтор» in the head of «Логлайн» and «Синопсис» (web/workspace, «Логлайн и синопсис с
 * соавтором»): a task goes to the co-author like a check of the mentor, «Под заявку» goes into the
 * field. A locked draft hides the tasks that end in the document («Задачи соавтора в запертом
 * драфте»).
 */
export function DocTasksButton({ part }: { part: "logline" | "synopsis" }) {
  const { askCoauthor, coauthorBusy, draft } = useProjectData();
  const tasks = DOC_TASKS[part].filter((t) => !(draft.locked && t.writes));
  // «Под заявку» goes into the chat's field once the menu is closed: an open menu keeps the focus
  // inside itself, and a closing one takes it back to the button.
  const filling = useRef<string | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          disabled={coauthorBusy}
        >
          <Sparkles />
          Соавтор
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-w-[calc(100vw-16px)] min-w-52"
        onCloseAutoFocus={(e) => {
          const request = filling.current;
          if (request === null) return;
          filling.current = null;
          e.preventDefault();
          askCoauthor(request, "fill");
        }}
      >
        {tasks.map((task) => (
          <DropdownMenuItem
            key={task.id}
            disabled={coauthorBusy}
            onSelect={() => {
              if (task.fill) filling.current = task.request;
              else askCoauthor(task.request, "send");
            }}
          >
            {task.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

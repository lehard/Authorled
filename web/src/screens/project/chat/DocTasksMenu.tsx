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
import { DOC_TASKS, type DocTask } from "./docTasks";

type Part = "logline" | "synopsis";

/**
 * The tasks of a document the author may choose now: a locked draft hides the tasks that end in the
 * document («Задачи соавтора в запертом драфте»). `run` sends a task to the co-author, or puts the
 * start of «Под заявку» into the chat's field.
 */
function useDocTasks(part: Part) {
  const { askCoauthor, coauthorBusy, draft } = useProjectData();
  const tasks = DOC_TASKS[part].filter((t) => !(draft.locked && t.writes));
  const run = (task: DocTask) =>
    askCoauthor(task.request, task.fill ? "fill" : "send");
  return { tasks, busy: coauthorBusy, run };
}

/**
 * «Соавтор» in the head of «Логлайн» and «Синопсис» (web/workspace, «Логлайн и синопсис с
 * соавтором»): a filled button, apart from the save status and the history beside it; a task goes to
 * the co-author like a check of the mentor, «Под заявку» goes into the field.
 */
export function DocTasksButton({ part }: { part: Part }) {
  const { tasks, busy, run } = useDocTasks(part);
  // «Под заявку» goes into the chat's field once the menu is closed: an open menu keeps the focus
  // inside itself, and a closing one takes it back to the button.
  const filling = useRef<DocTask | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="rounded-full" disabled={busy}>
          <Sparkles />
          Соавтор
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-w-[calc(100vw-16px)] min-w-52"
        onCloseAutoFocus={(e) => {
          const task = filling.current;
          if (task === null) return;
          filling.current = null;
          e.preventDefault();
          run(task);
        }}
      >
        {tasks.map((task) => (
          <DropdownMenuItem
            key={task.id}
            disabled={busy}
            onSelect={() => {
              if (task.fill) filling.current = task;
              else run(task);
            }}
          >
            {task.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The tasks that write a text, on the empty sheet of an unlocked «Логлайн» or «Синопсис»
 * (web/workspace, «Задачи соавтора на пустом листе»), after «Попросить соавтора:» so the author sees
 * whom they ask. The sheet shows it only while its text is empty. The row lets clicks through to the field; only the buttons catch them.
 */
export function DocSheetTasks({ part }: { part: Part }) {
  const { draft } = useProjectData();
  const { tasks, busy, run } = useDocTasks(part);
  if (draft.locked) return null;
  return (
    <div className="sheet-tasks">
      <span className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
        <Sparkles className="size-4 text-primary" aria-hidden />
        Попросить соавтора:
      </span>
      {tasks
        .filter((t) => t.onSheet)
        .map((task) => (
          <Button
            key={task.id}
            variant="outline"
            size="sm"
            className="pointer-events-auto rounded-full font-sans"
            disabled={busy}
            onClick={() => run(task)}
          >
            {task.label}
          </Button>
        ))}
    </div>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SkippedRecord } from "@/data/files";

const GROUPS: { kind: SkippedRecord["kind"]; label: string }[] = [
  { kind: "screenplay", label: "Сценарии" },
  { kind: "character", label: "Персонажи" },
  { kind: "location", label: "Локации" },
];

/**
 * What an imported STARC file did not have: a dialog over the dimmed screen, groups by kind with
 * their count and the names one per line, the reason, and «Понятно» (openspec/specs/web/workspace,
 * «Предупреждение о пропущенном при импорте»). Esc closes it, a click outside does not; nothing
 * is shown when the list is empty.
 */
export function ImportSkipped({
  skipped,
  onClose,
}: {
  skipped: SkippedRecord[];
  onClose: () => void;
}) {
  const groups = GROUPS.map(({ kind, label }) => ({
    label,
    names: skipped.filter((record) => record.kind === kind).map((r) => r.name),
  })).filter((group) => group.names.length > 0);
  return (
    <AlertDialog
      open={skipped.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="rounded-panel bg-paper shadow-paper data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-heading-2">
            Часть проекта не перенеслась
          </AlertDialogTitle>
          <AlertDialogDescription>
            Текст сценария импортирован. В файле STARC не было:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid max-h-[40vh] gap-3 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.label} className="grid gap-1">
              <h3 className="text-body font-semibold">
                {group.label} ({group.names.length})
              </h3>
              <ul className="grid gap-0.5 text-body">
                {group.names.map((name, index) => (
                  <li key={`${index}-${name}`}>{name}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          Так бывает, когда облачный проект STARC выгружен не полностью. Чтобы
          перенести остальное, сохраните проект в STARC на компьютер целиком и
          импортируйте снова.
        </p>
        <AlertDialogFooter>
          <AlertDialogAction className="rounded-full">
            Понятно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

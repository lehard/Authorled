import type { SkippedRecord } from "@/data/files";

const GROUPS: { kind: SkippedRecord["kind"]; label: string }[] = [
  { kind: "screenplay", label: "Сценарии" },
  { kind: "character", label: "Персонажи" },
  { kind: "location", label: "Локации" },
];

function quoted(names: string[]): string {
  return names.map((name) => `«${name}»`).join(", ");
}

/**
 * What an imported STARC file did not have, by name and kind, with the reason: a warning, not an
 * error (openspec/specs/web/workspace, «Предупреждение о пропущенном при импорте»). Shown in the
 * place of ActionError, nothing when the list is empty.
 */
export function ImportSkipped({
  skipped,
  onClose,
}: {
  skipped: SkippedRecord[];
  onClose: () => void;
}) {
  if (skipped.length === 0) return null;
  const groups = GROUPS.map(({ kind, label }) => ({
    label,
    names: skipped.filter((record) => record.kind === kind).map((r) => r.name),
  })).filter((group) => group.names.length > 0);
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-20 grid max-h-[50vh] w-[min(560px,calc(100%-32px))] -translate-x-1/2 gap-2 overflow-y-auto rounded-2xl bg-paper px-4 py-3 text-caption text-foreground shadow-paper"
    >
      <p>Импорт прошёл, но в файле STARC нет содержимого:</p>
      <ul className="grid gap-1">
        {groups.map((group) => (
          <li key={group.label}>
            {group.label}: {quoted(group.names)}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        Этих данных не было в самом файле — так бывает, когда облачный проект
        STARC выгружен не полностью. Чтобы перенести их, сохраните проект в
        STARC на компьютер целиком и импортируйте снова.
      </p>
      <button
        type="button"
        className="justify-self-start text-primary hover:underline"
        onClick={onClose}
      >
        Закрыть
      </button>
    </div>
  );
}

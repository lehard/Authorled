import { Sparkles } from "lucide-react";

/** Place of the co-author chat until CopilotKit arrives (openspec/specs/web/workspace, «Место чата»). */
export function ChatColumn({ sees }: { sees: string }) {
  return (
    <section aria-label="Соавтор" className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-13 items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="size-4 text-ai" />
            Соавтор
          </b>
          <small className="block truncate text-xs text-muted-foreground">
            Видит: {sees}
          </small>
        </div>
      </header>
      <div className="m-auto max-w-72 p-5 text-center text-muted-foreground">
        <b className="mb-1.5 block text-foreground">
          Чат появится на следующем этапе
        </b>
        Соавтор будет видеть открытый документ и всю историю: сцены, персонажей,
        локации.
      </div>
    </section>
  );
}

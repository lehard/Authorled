import type { ReactNode } from "react";

import { InkLoader } from "@/design-system";

/** Full-page message on the desk: waiting steps, errors, «Не найдено». */
export function MessageScreen({
  title,
  text,
  loading = false,
  children,
}: {
  title: string;
  text?: string;
  /** A waiting step: the ink line animates above the title. */
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div
        role={loading ? "status" : undefined}
        className="grid w-full max-w-md justify-items-center gap-4 rounded-panel bg-paper p-8 text-center text-paper-foreground shadow-paper"
      >
        {loading && <InkLoader />}
        <h1 className="text-heading-2">{title}</h1>
        {text !== undefined && <p className="text-muted-foreground">{text}</p>}
        {children !== undefined && (
          <div className="flex justify-center gap-2">{children}</div>
        )}
      </div>
    </main>
  );
}

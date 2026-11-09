import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { ChunkLoadError } from "@/app/chunkLoadError";

import { MessageScreen } from "./MessageScreen";

/** A part of the app did not load: the only way on is to reload the page (no retries). */
export function LoadErrorScreen() {
  return (
    <MessageScreen
      title="Не удалось загрузить Соавтор"
      text="Часть приложения не пришла. Проверьте соединение и обновите страницу."
    >
      <Button className="rounded-full" onClick={() => window.location.reload()}>
        Обновить
      </Button>
    </MessageScreen>
  );
}

/** Shows LoadErrorScreen for a part that did not load; any other error goes on up as before. */
export class ChunkBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    if (error instanceof ChunkLoadError) return { failed: true };
    throw error;
  }

  render() {
    return this.state.failed ? <LoadErrorScreen /> : this.props.children;
  }
}

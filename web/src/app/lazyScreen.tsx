import { lazy, Suspense, type ComponentType } from "react";

import { ChunkBoundary } from "@/screens/system/LoadErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";

import { ChunkLoadError } from "./chunkLoadError";

/**
 * Screens loaded as separate parts (openspec/specs/web/app, «Окно истории отдельной частью»).
 * One promise per screen serves both the background preload and the screen itself, so a part
 * is requested once. A failed part is a ChunkLoadError: the screen shows «Не удалось загрузить
 * Соавтор» with «Обновить», and nothing is retried or replaced.
 */
export function lazyScreen(
  name: string,
  load: () => Promise<ComponentType>,
  waiting: string,
) {
  let loading: Promise<{ default: ComponentType }> | null = null;
  const part = () => {
    loading ??= load().then(
      (screen) => ({ default: screen }),
      (error: unknown) => {
        throw new ChunkLoadError(name, error);
      },
    );
    return loading;
  };
  const Lazy = lazy(part);

  function Screen() {
    return (
      <ChunkBoundary>
        <Suspense fallback={<MessageScreen loading title={waiting} />}>
          <Lazy />
        </Suspense>
      </ChunkBoundary>
    );
  }

  /**
   * Starts loading in the background. A failure is not shown here: the promise stays rejected,
   * and opening the screen shows it; the console gets the cause for whoever investigates.
   */
  function preload() {
    part().then(undefined, (error: unknown) => {
      console.error(error);
    });
  }

  return { Screen, preload };
}

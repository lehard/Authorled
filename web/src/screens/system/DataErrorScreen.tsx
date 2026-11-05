import { Button } from "@/components/ui/button";

import { MessageScreen } from "./MessageScreen";

/**
 * Data that did not load (openspec/specs/web/workspace, «Источник данных», «Ошибка ядра»): the
 * reason and «Повторить», never an empty screen or sample data in its place.
 */
export function DataErrorScreen({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: { message: string };
  onRetry: () => void;
}) {
  return (
    <MessageScreen title={title} text={error.message}>
      <Button className="rounded-full" onClick={onRetry}>
        Повторить
      </Button>
    </MessageScreen>
  );
}

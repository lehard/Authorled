import type { ConfigError } from "@/app/config";

import { MessageScreen } from "./MessageScreen";

/** Shown instead of the app when a required setting is missing or wrong. */
export function ConfigErrorScreen({ error }: { error: ConfigError }) {
  return (
    <MessageScreen title="Приложение не настроено" text={error.message}>
      <code className="rounded-md bg-muted px-2 py-1 text-caption">
        {error.setting}
      </code>
    </MessageScreen>
  );
}

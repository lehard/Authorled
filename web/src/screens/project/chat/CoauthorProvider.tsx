import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useMemo, useState, type ReactNode } from "react";

import { COAUTHOR_ID, createCoauthorAgent } from "./api";
import { ChatRunsContext, type ChatRuns } from "./chatRuns";
import type { Mark } from "./feedback";

/**
 * CopilotKit with the co-author as a self-managed AG-UI agent: no CopilotKit runtime or cloud,
 * no dev console or inspector (openspec/specs/web/app, no third-party hosts).
 */
export function CoauthorProvider({ children }: { children: ReactNode }) {
  const [agent] = useState(createCoauthorAgent);
  const [runOf, setRunOf] = useState<ReadonlyMap<string, string>>(new Map());
  const [marks, setMarks] = useState<ReadonlyMap<string, Mark>>(new Map());
  const runs = useMemo<ChatRuns>(
    () => ({
      runOf,
      marks,
      reset: (nextRuns, nextMarks) => {
        setRunOf(nextRuns);
        setMarks(nextMarks);
      },
      addRun: (messageId, runId) =>
        setRunOf((found) => new Map(found).set(messageId, runId)),
      setMark: (runId, mark) =>
        setMarks((found) => {
          const next = new Map(found);
          if (mark === null) next.delete(runId);
          else next.set(runId, mark);
          return next;
        }),
    }),
    [runOf, marks],
  );
  return (
    <CopilotKitProvider
      selfManagedAgents={{ [COAUTHOR_ID]: agent }}
      showDevConsole={false}
      // The AG-UI inspector loads fonts.googleapis.com and cdn.copilotkit.ai: never on.
      enableInspector={false}
    >
      <ChatRunsContext.Provider value={runs}>
        {children}
      </ChatRunsContext.Provider>
    </CopilotKitProvider>
  );
}

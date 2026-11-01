import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useState, type ReactNode } from "react";

import { COAUTHOR_ID, createCoauthorAgent } from "./api";

/**
 * CopilotKit with the co-author as a self-managed AG-UI agent: no CopilotKit runtime or cloud,
 * no dev console or inspector (openspec/specs/web/app, no third-party hosts).
 */
export function CoauthorProvider({ children }: { children: ReactNode }) {
  const [agent] = useState(createCoauthorAgent);
  return (
    <CopilotKitProvider
      selfManagedAgents={{ [COAUTHOR_ID]: agent }}
      showDevConsole={false}
      // The AG-UI inspector loads fonts.googleapis.com and cdn.copilotkit.ai: never on.
      enableInspector={false}
    >
      {children}
    </CopilotKitProvider>
  );
}

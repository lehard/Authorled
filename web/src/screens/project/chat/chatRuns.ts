import { createContext, useContext } from "react";

import type { Mark } from "./feedback";

/**
 * What the chat knows about the answers of the open conversation: the run of each answer that
 * can be marked (by message id) and the author's marks (by run id). It lives in CoauthorProvider, with the
 * agent, so a chat that closes with its sheet (narrow screens) finds it again.
 */
export type ChatRuns = {
  runOf: ReadonlyMap<string, string>;
  marks: ReadonlyMap<string, Mark>;
  /** A new conversation, or one opened from the history, with what is known about it. */
  reset: (runOf: Map<string, string>, marks: Map<string, Mark>) => void;
  addRun: (messageId: string, runId: string) => void;
  setMark: (runId: string, mark: Mark | null) => void;
};

export const ChatRunsContext = createContext<ChatRuns | null>(null);

export function useChatRuns(): ChatRuns {
  const runs = useContext(ChatRunsContext);
  if (runs === null) throw new Error("useChatRuns вне CoauthorProvider.");
  return runs;
}

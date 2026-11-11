import { useFrontendTool, type ToolCall } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CoauthorMode } from "@/account/meApi";

import { ALLOW, type Args, type ToolName } from "./actions";

// Answers to the pauses of the co-author (openspec/specs/web/workspace, «Подтверждение действия
// соавтора», «Режим соавтора в чате»; design of coauthor-actions, decisions 1 and 7). Agno pauses
// the run on every changing tool; CopilotKit calls the handler of a tool of that name, and what it
// returns goes back as the tool's answer and resumes the run. In the mode «Сам» the answer is
// «Разрешить» at once; in «Спрашивать» it waits for the author's button.

export type Answer = typeof ALLOW | { accepted: false; note: string };

export type Confirmations = {
  /** Calls waiting for the author's answer. */
  asked: string[];
  answer: (toolCallId: string, answer: Answer) => void;
};

function useAnswered(
  name: ToolName,
  handler: (args: Args, context: { toolCall: ToolCall }) => Promise<Answer>,
) {
  useFrontendTool<Args>(
    {
      name,
      // Not offered to the agent as a browser tool: the backend owns it, and Agno would add a
      // second tool of the same name. The chat only answers the pauses on it.
      available: false,
      handler,
    },
    [handler],
  );
}

export function useConfirmations(
  mode: CoauthorMode | undefined,
): Confirmations {
  const modeNow = useRef(mode);
  useEffect(() => {
    modeNow.current = mode;
  }, [mode]);
  const waiting = useRef(new Map<string, (answer: Answer) => void>());
  const [asked, setAsked] = useState<string[]>([]);

  const handler = useCallback(
    (_args: Args, { toolCall }: { toolCall: ToolCall }): Promise<Answer> => {
      if (modeNow.current === undefined)
        throw new Error("Режим соавтора ещё не загружен из аккаунта.");
      if (modeNow.current === "auto") return Promise.resolve(ALLOW);
      return new Promise((resolve) => {
        waiting.current.set(toolCall.id, resolve);
        setAsked((ids) => [...ids, toolCall.id]);
      });
    },
    [],
  );
  // One per changing tool of the backend (actions.ts, CHANGING_TOOLS).
  useAnswered("create_story_note", handler);
  useAnswered("save_chat_file_to_notes", handler);
  useAnswered("update_story_note", handler);
  useAnswered("create_story_document", handler);
  useAnswered("update_story_document", handler);
  useAnswered("comment_on_screenplay", handler);

  const answer = useCallback((toolCallId: string, given: Answer) => {
    const resolve = waiting.current.get(toolCallId);
    if (resolve === undefined)
      throw new Error(`Действие ${toolCallId} уже не ждёт ответа.`);
    waiting.current.delete(toolCallId);
    setAsked((ids) => ids.filter((id) => id !== toolCallId));
    resolve(given);
  }, []);

  return { asked, answer };
}

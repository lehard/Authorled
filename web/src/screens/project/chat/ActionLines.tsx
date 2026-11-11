import type { Message, ToolCall } from "@ag-ui/client";
import { Check, CircleAlert, X } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { useProjectData } from "../ProjectContext";
import { docPath } from "../docRef";
import {
  ALLOW,
  DENY,
  decisionOf,
  describeAction,
  parseArgs,
  targetRef,
  toolMessages,
  type ToolName,
} from "./actions";
import type { Answer, Confirmations } from "./confirmations";
import { readOutcome } from "./outcome";
import { ResearchCard } from "./ResearchCard";

// The changing calls of the co-author under its answer (openspec/specs/web/workspace,
// «Сделанное соавтором в чате») and the card of a call waiting for the author («Подтверждение
// действия соавтора»); confirmations.ts gets the pauses and their answers.

export function Line({
  tone,
  children,
}: {
  tone: "done" | "muted" | "refused";
  children: React.ReactNode;
}) {
  const Icon = tone === "refused" ? CircleAlert : tone === "done" ? Check : X;
  return (
    <p
      className={`mt-2 flex items-start gap-1.5 text-caption ${tone === "refused" ? "text-destructive" : "text-muted-foreground"}`}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function Outcome({
  callId,
  content,
}: {
  callId: string;
  content: string;
}) {
  const data = useProjectData();
  const outcome = readOutcome(content);
  if (outcome.kind === "refused")
    return <Line tone="refused">{outcome.text}</Line>;
  if (outcome.kind === "unreadable") {
    console.error(
      `The result of the co-author's call ${callId} is neither done nor a refusal:`,
      content,
    );
    return <Line tone="refused">Не удалось прочитать результат действия</Line>;
  }
  return (
    <Line tone="done">
      <Link
        to={docPath(data.draft, targetRef(outcome.target))}
        className="text-foreground underline underline-offset-2 hover:text-ai"
      >
        {outcome.done}
      </Link>
    </Line>
  );
}

/** The card of a call waiting for the author: what the co-author wants to do and the answer. */
function ConfirmCard({
  title,
  detail,
  onAnswer,
}: {
  title: string;
  detail: string;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-paper p-3 shadow-panel">
      <p className="font-medium">{title}</p>
      {detail !== "" && (
        <p className="line-clamp-4 text-caption whitespace-pre-wrap text-muted-foreground">
          {detail}
        </p>
      )}
      <div className="flex gap-1.5">
        <Button size="xs" onClick={() => onAnswer(ALLOW)}>
          Разрешить
        </Button>
        <Button size="xs" variant="outline" onClick={() => onAnswer(DENY)}>
          Отклонить
        </Button>
      </div>
    </div>
  );
}

/**
 * The changing calls of an assistant message under its text: the card while it waits for the
 * author, then what was done or refused.
 */
export function ActionLines({
  calls,
  messages,
  outcomes,
  confirmations,
}: {
  /** The changing calls this message shows first (actions.ts, firstChangingCalls). */
  calls: ToolCall[];
  messages: Message[];
  /**
   * Results of changing calls by call id, as the backend sent them in this chat. After the
   * author's answer the client keeps the answer as the call's result and drops the backend's.
   */
  outcomes: ReadonlyMap<string, string>;
  confirmations: Confirmations;
}) {
  const data = useProjectData();
  return calls.map((call) => {
    const answers = toolMessages(messages, call.id);
    const outcome =
      outcomes.get(call.id) ?? answers.find((c) => decisionOf(c) === null);
    const args = parseArgs(call.function.arguments);
    if (outcome !== undefined) {
      // A done research brief shows its card instead of the line («Карточка задания на исследование»).
      const done = readOutcome(outcome);
      if (
        call.function.name === "create_research_brief" &&
        done.kind === "done"
      )
        return (
          <ResearchCard
            key={call.id}
            args={args}
            noteId={done.target.id}
            done={done.done}
          />
        );
      return <Outcome key={call.id} callId={call.id} content={outcome} />;
    }
    const { title, detail } = describeAction(
      call.function.name as ToolName,
      args,
      data,
    );
    const decision = answers.map(decisionOf).find((d) => d !== null);
    if (decision !== undefined && decision !== null)
      return (
        <Line key={call.id} tone="muted">
          {decision.accepted ? "Разрешено" : "Отклонено"}: {title}
        </Line>
      );
    // Not asked: the arguments still come, or the chat answers by itself in the mode «Сам».
    if (!confirmations.asked.includes(call.id)) return null;
    return (
      <ConfirmCard
        key={call.id}
        title={title}
        detail={detail}
        onAnswer={(answer: Answer) => confirmations.answer(call.id, answer)}
      />
    );
  });
}

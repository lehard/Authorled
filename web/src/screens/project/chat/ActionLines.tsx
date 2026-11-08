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
  doneOf,
  parseArgs,
  targetRef,
  toolMessages,
  type ToolName,
} from "./actions";
import type { Answer, Confirmations } from "./confirmations";

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

export function Outcome({ content }: { content: string }) {
  const data = useProjectData();
  const done = doneOf(content);
  if (done === null) return <Line tone="refused">{content}</Line>;
  return (
    <Line tone="done">
      <Link
        to={docPath(data.draft, targetRef(done.target))}
        className="text-foreground underline underline-offset-2 hover:text-ai"
      >
        {done.done}
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
    if (outcome !== undefined)
      return <Outcome key={call.id} content={outcome} />;
    const { title, detail } = describeAction(
      call.function.name as ToolName,
      parseArgs(call.function.arguments),
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

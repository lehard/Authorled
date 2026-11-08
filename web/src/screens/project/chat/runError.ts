// What the chat shows the author when a run of the co-author fails (openspec/specs/web/workspace,
// «Чат с соавтором»). Agno 3.1.10 sends a failed run as AG-UI RUN_ERROR (`on_run_error`,
// agno/os/interfaces/agui/handlers.py): `message` is the text of the exception, `rawEvent` is
// Agno's RunErrorEvent with `additional_data`. Only refusals of the product carry a reason and a
// message written for the author (agents/coauthor_usage.py); any other failure, a refused model
// call among them, must not reach the author as text. No runtime imports here: `npm run
// check:chat` runs this in Node.

export const UNAVAILABLE = "Соавтор сейчас недоступен. Попробуйте позже.";
export const NO_CONNECTION =
  "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";

export type Tone = "error" | "notice";

/** The reasons of the product's refusals and how each is shown; the list is the contract. */
const REFUSALS: Record<string, Tone> = {
  usage_limit_reached: "notice",
  subscription_ended: "error",
  usage_check_failed: "error",
  usage_record_failed: "error",
};

export type RunError =
  { kind: "refusal"; text: string; tone: Tone } | { kind: "failure" };

function reasonOf(rawEvent: unknown): string | undefined {
  if (typeof rawEvent !== "object" || rawEvent === null) return undefined;
  const data = (rawEvent as { additional_data?: unknown }).additional_data;
  if (typeof data !== "object" || data === null) return undefined;
  const reason = (data as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

export function readRunError(message: string, rawEvent: unknown): RunError {
  const reason = reasonOf(rawEvent);
  if (reason === undefined || !Object.hasOwn(REFUSALS, reason))
    return { kind: "failure" };
  return { kind: "refusal", text: message, tone: REFUSALS[reason] };
}

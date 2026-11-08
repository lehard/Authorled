// The result of a changing call of the co-author, as the chat shows it under the call
// (openspec/specs/web/workspace, «Сделанное соавтором в чате»). Agno 3.1.10 sends every tool
// result over AG-UI as JSON (`to_json_str`, agno/os/interfaces/agui/utils.py): the tools'
// `{"done", "target"}` as it is, a refusal of the core («Отказ: …») as a JSON string. No runtime
// imports here: `npm run check:chat` runs this in Node.

export type Target = { type: string; id: string; kind?: string };

export type Outcome =
  | { kind: "done"; done: string; target: Target }
  | { kind: "refused"; text: string }
  | { kind: "unreadable" };

export function readOutcome(content: string): Outcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Agno sends only JSON: anything else is a result the chat cannot read.
    return { kind: "unreadable" };
  }
  if (typeof parsed === "string") return { kind: "refused", text: parsed };
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const { done, target } = parsed as { done?: unknown; target?: unknown };
    if (
      typeof done === "string" &&
      typeof target === "object" &&
      target !== null &&
      typeof (target as Target).type === "string" &&
      typeof (target as Target).id === "string"
    )
      return { kind: "done", done, target: target as Target };
  }
  return { kind: "unreadable" };
}

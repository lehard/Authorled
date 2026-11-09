import { apiRequest, HttpError } from "@/data/apiClient";

import { NO_CONNECTION } from "./runError";

// Marks of the co-author's answers (openspec/specs/api/coauthor-feedback): one per run of the
// co-author, by its Agno run id; the server knows the conversation of the run.

export type Mark = "useful" | "not_useful";

function isMark(value: unknown): value is Mark {
  return value === "useful" || value === "not_useful";
}

function strange(): Error {
  return new Error("Сервер вернул оценки ответов в неизвестном виде.");
}

/** The author's marks in a conversation, by run id. */
export async function loadMarks(sessionId: string): Promise<Map<string, Mark>> {
  const { body } = await apiRequest("/coauthor-feedback", {
    query: { session_id: sessionId },
  });
  if (!Array.isArray(body)) throw strange();
  return new Map(
    body.map((row: unknown) => {
      const { run_id, value } = (row ?? {}) as Record<string, unknown>;
      if (typeof run_id !== "string" || !isMark(value)) throw strange();
      return [run_id, value];
    }),
  );
}

export async function putMark(runId: string, mark: Mark): Promise<void> {
  const { body } = await apiRequest(
    `/coauthor-feedback/${encodeURIComponent(runId)}`,
    { method: "PUT", json: { value: mark } },
  );
  const stored = (body ?? {}) as Record<string, unknown>;
  if (stored.run_id !== runId || stored.value !== mark) throw strange();
}

export async function clearMark(runId: string): Promise<void> {
  await apiRequest(`/coauthor-feedback/${encodeURIComponent(runId)}`, {
    method: "DELETE",
  });
}

/** The reason of a failed mark for the author, without technical details. */
export function markError(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.statusCode === null) return NO_CONNECTION;
    return e.message;
  }
  console.error("A mark of the co-author's answer failed", e);
  return "Оценку не удалось сохранить. Попробуйте ещё раз.";
}

// Requests to the product routes of the core, /api/v1 (openspec/specs/api/stories, api/review,
// api/files, api/story-import), on the frontend's own origin under /os/ (dev: Vite proxy), with
// the Access Token of the signed-in user. A refusal (`application/problem+json`) becomes an
// HttpError with the HTTP status and the reason of the core for a person.
import { activeUser } from "@/auth/userManager";

const API = "/os/api/v1";

/** A refused or failed request; `statusCode` is null when the server did not answer. */
export class HttpError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode: number | null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

/** Whether a failed request was refused by the core because the record has a newer revision. */
export const isConflict = (e: unknown): e is HttpError =>
  e instanceof HttpError && e.statusCode === 409;

function describe(status: number, detail: string | null): string {
  if (status === 401) return "Вход истёк. Войдите снова.";
  if (status === 502 || status === 503 || status === 504)
    return "Сервер сейчас не отвечает. Попробуйте ещё раз через минуту.";
  if (detail !== null) return detail;
  if (status >= 500) return "На сервере произошла ошибка. Попробуйте ещё раз.";
  return `Сервер отказал в запросе (код ${status}).`;
}

export type ApiRequest = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Query parameters of the path. */
  query?: Record<string, string>;
  /** A JSON body. */
  json?: unknown;
  /** A multipart body (an upload). */
  form?: FormData;
  /** The revision the change is based on (`If-Match`). */
  revision?: number;
};

export type ApiResponse = {
  /** The parsed JSON body; null for 204. */
  body: unknown;
  /** The revision of the `ETag` header, when the route sends one. */
  revision: number | null;
};

function etag(response: Response): number | null {
  const value = response.headers.get("ETag");
  if (value === null) return null;
  const revision = Number(value.replace(/^W\//, "").replaceAll('"', ""));
  if (!Number.isInteger(revision))
    throw new HttpError(
      `Сервер вернул ревизию в неизвестном виде: ETag ${value}.`,
      response.status,
    );
  return revision;
}

export async function apiRequest(
  path: string,
  request: ApiRequest = {},
): Promise<ApiResponse> {
  const user = await activeUser();
  if (user === null) throw new HttpError("Вход истёк. Войдите снова.", 401);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${user.access_token}`,
  };
  if (request.json !== undefined) headers["Content-Type"] = "application/json";
  if (request.revision !== undefined)
    headers["If-Match"] = String(request.revision);
  const query =
    request.query === undefined
      ? ""
      : `?${new URLSearchParams(request.query).toString()}`;
  let response: Response;
  try {
    response = await fetch(`${API}${path}${query}`, {
      method: request.method ?? "GET",
      headers,
      body:
        request.form ??
        (request.json === undefined ? undefined : JSON.stringify(request.json)),
    });
  } catch (e) {
    throw new HttpError(
      `Нет связи с сервером. Проверьте интернет и попробуйте ещё раз (${e instanceof Error ? e.message : String(e)}).`,
      null,
    );
  }
  if (!response.ok) {
    let detail: string | null = null;
    if (response.headers.get("content-type") === "application/problem+json") {
      const problem = (await response.json()) as { detail?: unknown };
      if (typeof problem.detail === "string") detail = problem.detail;
    }
    throw new HttpError(describe(response.status, detail), response.status);
  }
  const body: unknown = response.status === 204 ? null : await response.json();
  return { body, revision: etag(response) };
}

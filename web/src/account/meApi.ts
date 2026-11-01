// The user's account on the backend: GET and PATCH /api/v1/me (openspec/specs/api/me),
// on the frontend's own origin under /os/ (dev: Vite proxy), with the current Access Token.
import { THEMES, type Theme } from "@/design-system/theme";
import { activeUser } from "@/auth/userManager";

const ME_URL = "/os/api/v1/me";

export type Account = {
  id: string;
  name: string;
  email: string;
  /** null: as the system. */
  theme: Theme | null;
};

export type AccountChanges = { display_name?: string; theme?: Theme | null };

/** A refused or failed account request, with its reason for a person. */
export class AccountError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = "AccountError";
    this.statusCode = statusCode;
  }
}

function describe(status: number, detail: string | null): string {
  if (status === 401) return "Вход истёк. Войдите снова.";
  if (status === 502 || status === 503 || status === 504)
    return "Сервер сейчас не отвечает. Попробуйте ещё раз через минуту.";
  if (detail !== null) return detail;
  if (status >= 500) return "На сервере произошла ошибка. Попробуйте ещё раз.";
  return `Сервер отказал в запросе (код ${status}).`;
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

function account(body: unknown): Account {
  const b = body as {
    id?: unknown;
    email?: unknown;
    display_name?: unknown;
    settings?: { theme?: unknown };
  };
  const theme = b.settings?.theme;
  if (
    typeof b.id !== "string" ||
    typeof b.email !== "string" ||
    typeof b.display_name !== "string" ||
    (theme !== null && !isTheme(theme))
  ) {
    throw new AccountError(
      `Сервер вернул аккаунт в неизвестном виде: ${JSON.stringify(body)}`,
    );
  }
  return { id: b.id, email: b.email, name: b.display_name, theme };
}

async function request(init: RequestInit = {}): Promise<Account> {
  const user = await activeUser();
  if (user === null) throw new AccountError("Вход истёк. Войдите снова.", 401);
  let response: Response;
  try {
    response = await fetch(ME_URL, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${user.access_token}`,
      },
    });
  } catch (e) {
    throw new AccountError(
      `Нет связи с сервером. Проверьте интернет и попробуйте ещё раз (${e instanceof Error ? e.message : String(e)}).`,
    );
  }
  if (!response.ok) {
    let detail: string | null = null;
    if (response.headers.get("content-type") === "application/problem+json") {
      const problem = (await response.json()) as { detail?: unknown };
      if (typeof problem.detail === "string") detail = problem.detail;
    }
    throw new AccountError(describe(response.status, detail), response.status);
  }
  return account(await response.json());
}

/** The account of the signed-in user; the first call creates it on the backend. */
export function getMe(): Promise<Account> {
  return request();
}

export function patchMe(changes: AccountChanges): Promise<Account> {
  return request({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

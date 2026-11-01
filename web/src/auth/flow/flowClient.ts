// Client of the Authentik flow executor for the sign-in screens (openspec/specs/auth,
// «Вход фронтенда»; design of sign-in-screens, decision 6). The API is reached on the
// frontend's own origin (dev: Vite proxy), so the Authentik session cookie lands on our host.

const FLOW_URL = "/api/v3/flows/executor/authorled-authentication/?query=";
// Resets the flow plan kept in the session (an unfinished sign-in).
const CANCEL_URL = "/flows/-/cancel/";
// Sign-out flow of the product (auth/blueprints/20-oidc.yaml): ends the Authentik session.
const SIGN_OUT_URL = "/api/v3/flows/executor/authorled-invalidation/?query=";

type FieldErrors = Record<string, { string: string; code: string }[]>;

export type DeviceChallenge = {
  device_class: string;
  device_uid: string;
  challenge: Record<string, unknown>;
  last_used: string | null;
};

type Challenge =
  | { component: "ak-stage-identification"; response_errors?: FieldErrors }
  | { component: "ak-stage-password"; response_errors?: FieldErrors }
  | { component: "ak-stage-authenticator-email"; response_errors?: FieldErrors }
  | {
      component: "ak-stage-authenticator-validate";
      device_challenges: DeviceChallenge[];
      response_errors?: FieldErrors;
    }
  | { component: "xak-flow-redirect"; to: string }
  | { component: "ak-stage-access-denied"; error_message?: string }
  | { component: "ak-stage-flow-error"; error?: string };

/** What the screen shows next. */
export type Step = "password" | "code" | "done";

/** A sign-in failure the screen shows next to a field or as a page message. */
export class SignInError extends Error {
  readonly field: "email" | "password" | "code" | "page";

  constructor(field: SignInError["field"], message: string) {
    super(message);
    this.name = "SignInError";
    this.field = field;
  }
}

// Authentik answers in the browser language, so each case is listed in English and Russian.
const WRONG_CODE = {
  field: "code",
  text: "Неверный код. Проверьте письмо или запросите новый.",
} as const;
const KNOWN: Record<string, { field: SignInError["field"]; text: string }> = {
  "Failed to authenticate.": {
    field: "email",
    text: "Аккаунта с такой почтой нет.",
  },
  "Invalid password": { field: "password", text: "Неверный пароль." },
  "Неверный пароль": { field: "password", text: "Неверный пароль." },
  "Code does not match": WRONG_CODE,
  "Invalid Token": WRONG_CODE,
  // The validate stage speaks of authenticator apps; for an e-mail code it means a wrong code.
  "Invalid Token. Please ensure the time on your device is accurate and try again.":
    WRONG_CODE,
  "Недействительный токен. Убедитесь, что время на вашем устройстве указано точно, и повторите попытку.":
    WRONG_CODE,
};

function firstError(errors: FieldErrors | undefined): string | null {
  if (errors === undefined) return null;
  for (const list of Object.values(errors))
    if (list.length > 0) return list[0].string;
  return null;
}

function toError(
  text: string,
  fallbackField: SignInError["field"],
): SignInError {
  const known = KNOWN[text.trim()] as (typeof KNOWN)[string] | undefined;
  if (known !== undefined) return new SignInError(known.field, known.text);
  return new SignInError(fallbackField, `Authentik ответил: ${text}`);
}

async function send(body?: object, url = FLOW_URL): Promise<Challenge> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch (e) {
    throw new SignInError(
      "page",
      `Authentik недоступен: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!response.ok)
    throw new SignInError(
      "page",
      `Authentik ответил ${response.status} ${response.statusText}.`,
    );
  const data = (await response.json()) as { component?: unknown };
  const known = [
    "ak-stage-identification",
    "ak-stage-password",
    "ak-stage-authenticator-email",
    "ak-stage-authenticator-validate",
    "xak-flow-redirect",
    "ak-stage-access-denied",
    "ak-stage-flow-error",
  ];
  if (typeof data.component !== "string" || !known.includes(data.component)) {
    throw new SignInError(
      "page",
      `Неизвестный шаг входа Authentik: «${String(data.component)}».`,
    );
  }
  return data as Challenge;
}

/** Drops the flow plan of the session (Authentik /flows/-/cancel/); its redirect is not followed. */
async function cancelUnfinished(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(CANCEL_URL, {
      redirect: "manual",
      credentials: "same-origin",
    });
  } catch (e) {
    throw new SignInError(
      "page",
      `Authentik недоступен: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (response.type !== "opaqueredirect" && !response.ok) {
    throw new SignInError(
      "page",
      `Не удалось сбросить незаконченный вход: Authentik ответил ${response.status}.`,
    );
  }
}

/** One pass through the sign-in flow; a new pass starts with start(). */
export class SignInFlow {
  private current: Challenge | null = null;
  // Requests of one session must not overlap: Authentik saves the session at the end of each
  // request, so a parallel start (React StrictMode runs effects twice) would restore a
  // cancelled flow. One start per instance, shared by its callers.
  private starting: Promise<"email" | "done"> | null = null;

  private async advance(
    challenge: Challenge,
    field: SignInError["field"],
  ): Promise<Step> {
    this.current = challenge;
    switch (challenge.component) {
      case "ak-stage-access-denied":
        throw new SignInError(
          "page",
          challenge.error_message ?? "Authentik отказал во входе.",
        );
      case "ak-stage-flow-error":
        throw new SignInError(
          "page",
          challenge.error ?? "Ошибка потока входа Authentik.",
        );
      case "xak-flow-redirect":
        return "done";
      case "ak-stage-password":
        return "password";
      case "ak-stage-authenticator-email":
        // First sign-in: Authentik sets up the e-mail device and has sent the code already.
        return "code";
      case "ak-stage-authenticator-validate":
        await this.requestCode();
        return "code";
      case "ak-stage-identification":
        throw toError(
          firstError(challenge.response_errors) ?? "поток вернулся к почте",
          field,
        );
    }
  }

  /**
   * Starts the flow. "done" means Authentik has a session already (another tab, an earlier
   * sign-in): the app can take tokens without asking anything.
   */
  start(): Promise<"email" | "done"> {
    this.starting ??= this.begin();
    return this.starting;
  }

  private async begin(): Promise<"email" | "done"> {
    let first = await send();
    // Authentik keeps an unfinished sign-in in its session (a reload on the code step):
    // cancel it and start from the e-mail again.
    if (
      first.component !== "xak-flow-redirect" &&
      first.component !== "ak-stage-identification"
    ) {
      await cancelUnfinished();
      first = await send();
    }
    this.current = first;
    if (first.component === "xak-flow-redirect") return "done";
    if (first.component === "ak-stage-identification") return "email";
    await this.advance(first, "page");
    throw new SignInError(
      "page",
      `Поток входа начался с шага «${first.component}» вместо почты.`,
    );
  }

  /** Ends the Authentik session (sign-out flow), so another user can sign in. */
  async endAuthentikSession(): Promise<void> {
    const result = await send(undefined, SIGN_OUT_URL);
    if (result.component !== "xak-flow-redirect") {
      throw new SignInError(
        "page",
        `Выход из Authentik остановился на шаге «${result.component}».`,
      );
    }
    this.current = null;
    this.starting = null;
  }

  async identify(email: string): Promise<Step> {
    if (
      this.current?.component !== "ak-stage-identification" &&
      (await this.start()) === "done"
    ) {
      throw new SignInError(
        "page",
        "В Authentik уже есть вход: обновите страницу.",
      );
    }
    return this.advance(
      await send({ component: "ak-stage-identification", uid_field: email }),
      "email",
    );
  }

  async password(password: string): Promise<Step> {
    const next = await send({ component: "ak-stage-password", password });
    if (next.component === "ak-stage-password") {
      throw toError(
        firstError(next.response_errors) ?? "пароль не принят",
        "password",
      );
    }
    return this.advance(next, "password");
  }

  /** Sends a code by e-mail (again). */
  async requestCode(): Promise<void> {
    const c = this.current;
    if (c?.component !== "ak-stage-authenticator-validate") {
      throw new SignInError(
        "code",
        "Новый код можно запросить, начав вход заново: «Другая почта».",
      );
    }
    const device = c.device_challenges.find((d) => d.device_class === "email");
    if (device === undefined)
      throw new SignInError("page", "У аккаунта нет почты для кода.");
    // Selecting the device sends the e-mail; Authentik answers «Empty response» because no code
    // came with it, which is expected here.
    const next = await send({
      component: "ak-stage-authenticator-validate",
      selected_challenge: device,
    });
    if (next.component !== "ak-stage-authenticator-validate")
      return void (await this.advance(next, "code"));
    const error = firstError(next.response_errors);
    if (error !== null && error !== "Empty response")
      throw toError(error, "code");
    this.current = next;
  }

  async code(code: string): Promise<Step> {
    const c = this.current;
    if (
      c?.component !== "ak-stage-authenticator-email" &&
      c?.component !== "ak-stage-authenticator-validate"
    ) {
      throw new SignInError("page", "Сейчас не шаг кода: начните вход заново.");
    }
    const next = await send({ component: c.component, code });
    if (next.component === c.component) {
      this.current = next;
      throw toError(
        firstError(next.response_errors) ?? "код не принят",
        "code",
      );
    }
    return this.advance(next, "code");
  }

  /** Whether «Отправить ещё раз» can work on the current step. */
  canResend(): boolean {
    return this.current?.component === "ak-stage-authenticator-validate";
  }
}

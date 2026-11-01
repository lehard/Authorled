import { useState } from "react";

import { Button } from "@/components/ui/button";

import { SignInError, SignInFlow } from "./flowClient";

// Quick sign-in of the development users (openspec/specs/web/workspace, «Быстрый вход для
// разработки»): the same flow as a person, the code is read from Mailpit (Vite proxy /mailpit/).
// Loaded only in `vite serve`; production builds do not contain this module.

const USERS = [
  { label: "Сценарист", email: "writer@authorled.test" },
  { label: "Редактор", email: "editor@authorled.test" },
];
const WAIT_MS = 10_000;
const POLL_MS = 500;

type MailpitSearch = { messages: { ID: string; Created: string }[] };
type MailpitMessage = { Text: string };

async function json<T>(url: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch (e) {
    throw new SignInError(
      "page",
      `Mailpit недоступен: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!r.ok)
    throw new SignInError(
      "page",
      `Mailpit ответил ${r.status}: запущен ли стек (docker compose up -d)?`,
    );
  return (await r.json()) as T;
}

/** The code of the first e-mail to `email` that arrived after `since`. */
async function codeFromMailpit(email: string, since: number): Promise<string> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const found = await json<MailpitSearch>(
      `/mailpit/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    const fresh = found.messages.find(
      (m) => new Date(m.Created).getTime() >= since,
    );
    if (fresh !== undefined) {
      const message = await json<MailpitMessage>(
        `/mailpit/api/v1/message/${fresh.ID}`,
      );
      const code = /\b(\d{6})\b/.exec(message.Text);
      if (code === null)
        throw new SignInError(
          "page",
          "В письме Mailpit нет шестизначного кода.",
        );
      return code[1];
    }
    await new Promise((r) => window.setTimeout(r, POLL_MS));
  }
  throw new SignInError(
    "page",
    `Письмо с кодом для ${email} не пришло в Mailpit за 10 секунд.`,
  );
}

/** Walks the sign-in flow as `email` with the development password and the code from Mailpit. */
async function quickSignIn(email: string, password: string): Promise<void> {
  const flow = new SignInFlow();
  // A session of another user in Authentik would sign in as that user: end it first.
  if ((await flow.start()) === "done") {
    await flow.endAuthentikSession();
    await flow.start();
  }
  const since = Date.now() - 1000;
  let step = await flow.identify(email);
  if (step === "password") step = await flow.password(password);
  if (step === "code")
    step = await flow.code(await codeFromMailpit(email, since));
  if (step !== "done")
    throw new SignInError(
      "page",
      `Быстрый вход остановился на шаге «${step}».`,
    );
}

type Props = {
  onError: (e: SignInError | null) => void;
  onBusy: (busy: boolean) => void;
  onDone: (email: string) => Promise<void>;
};

export default function DevSignIn({ onError, onBusy, onDone }: Props) {
  const [running, setRunning] = useState<string | null>(null);

  async function signInAs(email: string) {
    if (__DEV_USER_PASSWORD__ === null) {
      onError(
        new SignInError(
          "page",
          "Не задан AUTH_DEV_USER_PASSWORD в .env (пароль пользователей для разработки).",
        ),
      );
      return;
    }
    setRunning(email);
    onBusy(true);
    onError(null);
    try {
      await quickSignIn(email, __DEV_USER_PASSWORD__);
      await onDone(email);
    } catch (e) {
      onError(
        e instanceof SignInError
          ? e
          : new SignInError("page", e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setRunning(null);
      onBusy(false);
    }
  }

  return (
    <section
      aria-label="Быстрый вход для разработки"
      className="mt-6 grid gap-2 rounded-2xl border border-dashed border-border-strong p-4"
    >
      <p className="text-caption text-muted-foreground">
        Разработка: вход пользователями <code>./scripts/dev.sh auth-users</code>
        , код берётся из Mailpit.
      </p>
      <div className="flex flex-wrap gap-2">
        {USERS.map((u) => (
          <Button
            key={u.email}
            variant="outline"
            className="rounded-full"
            disabled={running !== null}
            onClick={() => void signInAs(u.email)}
          >
            {running === u.email ? "Входим…" : `Войти как ${u.label}`}
          </Button>
        ))}
      </div>
    </section>
  );
}

import { useId, useState, type FormEvent } from "react";

import { BETA_REQUEST_URL, PAGES } from "../site";
import { buttonClass } from "./ui";

// The request for the beta (openspec/specs/web/site, «Форма заявки в бету», «Ответы формы»).
// The browser checks only for convenience; the core decides.

const ROLES = [
  { value: "screenwriter", label: "Сценарист" },
  { value: "writer", label: "Писатель" },
  { value: "other", label: "Другое" },
] as const;

type Role = (typeof ROLES)[number]["value"];
type Field = "email" | "name" | "role" | "consent";
type Errors = Partial<Record<Field, string>>;
type State =
  | { kind: "editing" }
  | { kind: "sending" }
  | { kind: "accepted" }
  | { kind: "refused"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function check(
  email: string,
  name: string,
  role: Role | "",
  consent: boolean,
): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = "Укажите почту.";
  else if (!EMAIL.test(email.trim()))
    errors.email = "Это не похоже на адрес почты.";
  if (!name.trim()) errors.name = "Укажите имя.";
  else if (name.trim().length > 100) errors.name = "Имя длиннее 100 символов.";
  if (!role) errors.role = "Выберите, кто вы.";
  if (!consent) errors.consent = "Без согласия мы не можем принять заявку.";
  return errors;
}

async function refusal(response: Response): Promise<string> {
  if (
    response.headers.get("content-type")?.startsWith("application/problem+json")
  ) {
    const problem: unknown = await response.json();
    if (
      typeof problem === "object" &&
      problem !== null &&
      "detail" in problem &&
      typeof problem.detail === "string"
    ) {
      return problem.detail;
    }
  }
  return `Заявку отправить не удалось: сервер ответил ${response.status}. Попробуйте ещё раз позже.`;
}

const INPUT =
  "w-full rounded-xl bg-paper px-3 py-3 body-3 text-paper-foreground ring-1 ring-border-strong transition-shadow duration-300 ease-base placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none aria-invalid:ring-destructive";

export function BetaForm() {
  const ids = {
    email: useId(),
    name: useId(),
    role: useId(),
    consent: useId(),
    trap: useId(),
  };
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<State>({ kind: "editing" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = check(email, name, role, consent);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setState({ kind: "sending" });
    let response: Response;
    try {
      response = await fetch(BETA_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          consent,
          website: trap,
        }),
      });
    } catch (error) {
      setState({
        kind: "refused",
        message: `Заявку отправить не удалось: нет связи с сервером (${error instanceof Error ? error.message : String(error)}).`,
      });
      return;
    }
    if (response.status === 202) {
      setState({ kind: "accepted" });
      return;
    }
    setState({ kind: "refused", message: await refusal(response) });
  }

  if (state.kind === "accepted") {
    return (
      <div
        role="status"
        className="site-fade-in flex flex-col gap-2 rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8"
      >
        <p className="heading-5 text-paper-foreground">Заявка принята</p>
        <p className="body-3 text-muted-foreground">
          Мы ответим на {email.trim()}, когда откроем доступ.
        </p>
      </div>
    );
  }

  const error = (field: Field) =>
    errors[field] ? (
      <p id={`${ids[field]}-error`} className="body-6 text-destructive">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      onSubmit={submit}
      className="relative flex flex-col gap-6 rounded-2xl bg-paper p-6 ring-1 ring-border sm:p-8"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor={ids.email}
            className="caption-1 text-paper-foreground"
          >
            Почта
          </label>
          <input
            id={ids.email}
            className={INPUT}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${ids.email}-error` : undefined}
          />
          {error("email")}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.name} className="caption-1 text-paper-foreground">
            Имя
          </label>
          <input
            id={ids.name}
            className={INPUT}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${ids.name}-error` : undefined}
          />
          {error("name")}
        </div>
      </div>
      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.role ? `${ids.role}-error` : undefined}
      >
        <legend className="mb-2 caption-1 text-paper-foreground">Кто вы</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-full px-4 py-2 body-6 text-paper-foreground ring-1 ring-border-strong transition-colors duration-300 ease-base has-checked:bg-primary has-checked:text-primary-foreground has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                className="sr-only"
                type="radio"
                name={ids.role}
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {error("role")}
      </fieldset>
      {/* A field for bots: hidden from people and from the keyboard. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] size-px overflow-hidden"
      >
        <label htmlFor={ids.trap}>Сайт</label>
        <input
          id={ids.trap}
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={ids.consent}
          className="flex items-start gap-3 body-6 text-paper-foreground"
        >
          <input
            id={ids.consent}
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={
              errors.consent ? `${ids.consent}-error` : undefined
            }
          />
          <span>
            Даю согласие на обработку персональных данных по{" "}
            <a
              className="text-primary underline underline-offset-2 hover:no-underline"
              href={PAGES.privacy.path}
            >
              политике
            </a>
            .
          </span>
        </label>
        {error("consent")}
      </div>
      {state.kind === "refused" ? (
        <p role="alert" className="body-6 text-destructive">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          className={buttonClass("primary")}
          disabled={state.kind === "sending"}
        >
          {state.kind === "sending" ? "Отправляем…" : "Отправить заявку"}
        </button>
      </div>
    </form>
  );
}

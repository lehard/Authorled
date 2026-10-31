import { ArrowRight, Clock } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InkLoader } from "@/design-system";

import { CodeInput } from "./CodeInput";
import { SignInError, SignInFlow, type Step } from "./flow/flowClient";
import { activeUser, signIn } from "./userManager";

// Quick sign-in of the development users: only `vite serve` has it, production builds drop it.
const DevSignIn = import.meta.env.DEV
  ? lazy(() => import("./flow/DevSignIn"))
  : null;

const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = "email" | "password" | "code" | "finishing";

/** Safe return address: a path of this app, never another origin. */
function returnPath(value: string | null): string {
  return value !== null && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

/** Sign-in screens after mockup v1 (openspec/specs/web/workspace, «Вход»). */
export function LoginScreen() {
  const [params] = useSearchParams();
  const returnTo = returnPath(params.get("returnTo"));
  const navigate = useNavigate();
  const flow = useRef(new SignInFlow());
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [codeKey, setCodeKey] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const ids = { email: useId(), password: useId() };

  // Signed in already — in this tab (tokens) or in Authentik (another tab): go straight on.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if ((await activeUser()) !== null) {
        navigate(returnTo, { replace: true });
        return;
      }
      if ((await flow.current.start()) === "done") {
        setStage("finishing");
        await signIn(returnTo);
        return;
      }
      if (!cancelled) setChecking(false);
    };
    check().catch((e: unknown) => {
      if (cancelled) return;
      setError(
        e instanceof SignInError
          ? e
          : new SignInError("page", e instanceof Error ? e.message : String(e)),
      );
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, returnTo]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  async function go(next: Step) {
    if (next === "done") {
      setStage("finishing");
      await signIn(returnTo);
    } else {
      if (next === "code") {
        setWait(RESEND_SECONDS);
        setCanResend(flow.current.canResend());
      }
      setStage(next);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const err =
        e instanceof SignInError
          ? e
          : new SignInError("page", e instanceof Error ? e.message : String(e));
      setError(err);
      if (err.field === "code") setCodeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError(
        new SignInError(
          "email",
          "Проверьте почту: нужен адрес вида name@example.com.",
        ),
      );
      return;
    }
    void run(async () => go(await flow.current.identify(value)));
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (password === "") {
      setError(new SignInError("password", "Введите пароль."));
      return;
    }
    void run(async () => go(await flow.current.password(password)));
  }

  function restart() {
    flow.current = new SignInFlow();
    setStage("email");
    setPassword("");
    setError(null);
  }

  const fieldError = (field: SignInError["field"]) =>
    error?.field === field ? (
      <p role="alert" className="text-caption text-destructive">
        {error.message}
      </p>
    ) : null;

  const who = (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2.5">
      <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {email.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate">{email}</span>
      <button
        type="button"
        className="text-caption text-primary hover:underline"
        onClick={restart}
      >
        Изменить
      </button>
    </div>
  );

  let card: ReactNode;
  if (checking && stage === "email") {
    card = <Waiting>Проверяем вход…</Waiting>;
  } else if (stage === "email") {
    card = (
      <form onSubmit={submitEmail} noValidate className="grid gap-2">
        <h1 className="text-heading-1 text-[28px] leading-tight font-medium">
          Вход в Authorled
        </h1>
        <p className="mb-4 text-muted-foreground">
          Введите почту, на которую заведён аккаунт.
        </p>
        <Label
          htmlFor={ids.email}
          className="text-caption font-normal text-muted-foreground"
        >
          Почта
        </Label>
        <Input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="name@example.com"
          value={email}
          aria-invalid={error?.field === "email"}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          className="h-11 bg-paper text-[15.5px]"
        />
        {fieldError("email")}
        <Go busy={busy}>Продолжить</Go>
      </form>
    );
  } else if (stage === "password") {
    card = (
      <form onSubmit={submitPassword} noValidate className="grid gap-2">
        <h1 className="mb-2 text-heading-1 font-medium">Пароль</h1>
        {who}
        <Label
          htmlFor={ids.password}
          className="text-caption font-normal text-muted-foreground"
        >
          Пароль
        </Label>
        <div className="relative">
          <Input
            id={ids.password}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            value={password}
            aria-invalid={error?.field === "password"}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="h-11 bg-paper pr-24 text-[15.5px]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-caption text-muted-foreground hover:bg-accent"
          >
            {showPassword ? "Скрыть" : "Показать"}
          </button>
        </div>
        {fieldError("password")}
        <Go busy={busy}>Дальше</Go>
        <p className="mt-3 text-caption text-muted-foreground">
          Потом — код из письма.
        </p>
      </form>
    );
  } else if (stage === "code") {
    card = (
      <div className="grid gap-3">
        <h1 className="text-heading-1 font-medium">Код из письма</h1>
        <p className="text-muted-foreground">
          Отправили 6 цифр на <b className="text-foreground">{email}</b>. Код
          действует 10 минут.
        </p>
        <CodeInput
          resetKey={codeKey}
          invalid={error?.field === "code"}
          disabled={busy}
          onComplete={(code) =>
            void run(async () => go(await flow.current.code(code)))
          }
        />
        {fieldError("code")}
        <div className="mt-1 flex flex-wrap justify-between gap-x-3.5 gap-y-1.5 text-caption text-muted-foreground">
          {wait > 0 ? (
            <span>
              Отправить ещё раз через 0:{String(wait).padStart(2, "0")}
            </span>
          ) : canResend ? (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() =>
                void run(async () => {
                  await flow.current.requestCode();
                  setWait(RESEND_SECONDS);
                })
              }
            >
              Отправить ещё раз
            </button>
          ) : (
            <span>Нового кода нет? Начните заново: «Другая почта».</span>
          )}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={restart}
          >
            Другая почта
          </button>
        </div>
        <p className="mt-1 flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-caption text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          Письма нет? Проверьте «Спам» и «Промоакции».
        </p>
      </div>
    );
  } else {
    card = <Waiting>Входим…</Waiting>;
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-6">
      <div className="w-full max-w-[440px]">
        <div className="font-heading mb-5 flex items-center justify-center gap-2.5 text-[19px]">
          <span
            className="inline-block size-7 rounded-lg bg-primary"
            aria-hidden
          />
          Authorled
        </div>
        <div className="rounded-[22px] bg-paper px-6 py-7 text-paper-foreground shadow-paper sm:px-8">
          {card}
          {error?.field === "page" && (
            <div
              role="alert"
              className="mt-4 grid gap-2 rounded-xl bg-muted px-3 py-2.5 text-caption"
            >
              <span className="text-destructive">{error.message}</span>
              <button
                type="button"
                className="justify-self-start text-primary hover:underline"
                onClick={restart}
              >
                Начать заново
              </button>
            </div>
          )}
        </div>
        <p className="mx-1 mt-4 text-center text-xs text-muted-foreground">
          Ваши тексты не используются для обучения моделей.
        </p>
        {DevSignIn !== null && stage === "email" && !checking && (
          <Suspense fallback={null}>
            <DevSignIn
              onError={setError}
              onBusy={setBusy}
              onDone={(who) => {
                setEmail(who);
                return go("done");
              }}
            />
          </Suspense>
        )}
      </div>
    </main>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="grid justify-items-center gap-4 py-6 text-muted-foreground"
    >
      <InkLoader />
      {children}
    </div>
  );
}

function Go({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={busy}
      className="mt-3 h-11 w-full rounded-full text-[15px] font-semibold"
    >
      {children}
      <ArrowRight />
    </Button>
  );
}

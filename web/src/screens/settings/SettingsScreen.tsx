import { useLogout } from "@refinedev/core";
import { Check, ChevronLeft } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Account } from "@/account/meApi";
import { useAccount, useSaveAccount } from "@/account/useAccount";
import { applyAccountTheme, type Theme } from "@/design-system/theme";
import { TopBar } from "@/screens/shelf/TopBar";
import { MessageScreen } from "@/screens/system/MessageScreen";

import { Row, Section } from "./parts";
import { PlanSection } from "./PlanSection";

// Settings, the personal cabinet (openspec/specs/web/workspace, «Настройки», «Тариф в настройках», «Тема в настройках»),
// after the screen #settings of mockup v1.

const SECTIONS = [
  { id: "profile", title: "Профиль" },
  { id: "plan", title: "Тариф" },
  { id: "appearance", title: "Внешний вид" },
] as const;

const THEME_TILES: { value: Theme | null; label: string }[] = [
  { value: "light", label: "Утро" },
  { value: "sepia", label: "Бумага" },
  { value: "dark", label: "Вечер у лампы" },
  { value: null, label: "Как в системе" },
];

export function SettingsScreen() {
  const { data: me, error, isLoading, refetch } = useAccount();
  if (isLoading) return <MessageScreen loading title="Загружаем настройки…" />;
  if (error !== null || me === undefined) {
    return (
      <MessageScreen
        title="Настройки не загрузились"
        text={error?.message ?? "Сервер не вернул аккаунт."}
      >
        <Button className="rounded-full" onClick={() => void refetch()}>
          Повторить
        </Button>
      </MessageScreen>
    );
  }
  return <Settings me={me} />;
}

function Settings({ me }: { me: Account }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-[960px] px-4 pt-2 pb-16 md:px-10">
        <article className="rounded-panel bg-paper px-5 py-7 text-paper-foreground shadow-paper md:px-16 md:py-12">
          <button
            type="button"
            className="flex items-center gap-1 text-caption text-muted-foreground hover:text-paper-foreground"
            // The first page of a tab has no history entry to go back to: then the shelf.
            onClick={() =>
              location.key === "default" ? navigate("/") : navigate(-1)
            }
          >
            <ChevronLeft className="size-4" aria-hidden />
            Назад
          </button>
          <h1 className="font-heading mt-5 mb-8 text-display md:mb-10">
            Настройки
          </h1>
          <div className="grid gap-8 md:grid-cols-[180px_1fr] md:gap-10">
            <nav aria-label="Разделы настроек">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 md:sticky md:top-6 md:grid md:gap-3">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:text-paper-foreground"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="grid min-w-0 gap-10">
              <Section id="profile" title="Профиль">
                <NameRow me={me} />
                <Row label="Почта для входа" hint="на неё приходит код">
                  <p className="pt-1 break-all">{me.email}</p>
                </Row>
                <Row label="Выход">
                  <SignOut />
                </Row>
              </Section>
              <hr className="border-border" />
              <PlanSection />
              <hr className="border-border" />
              <Section id="appearance" title="Внешний вид">
                <ThemeRow me={me} />
              </Section>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}

function NameRow({ me }: { me: Account }) {
  const id = useId();
  const save = useSaveAccount();
  const [value, setValue] = useState(me.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (name === "") {
      setError("Введите имя.");
      return;
    }
    setBusy(true);
    try {
      const account = await save({ display_name: name });
      setValue(account.name);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row label="Имя" hint="так вас видят соавтор и комментарии" labelFor={id}>
      <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            value={value}
            autoComplete="name"
            className="h-10 max-w-sm flex-1 basis-56 rounded-xl px-3"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? `${id}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSaved(false);
            }}
          />
          <Button
            type="submit"
            className="h-10 rounded-full px-5"
            disabled={busy || value === me.name}
          >
            Сохранить
          </Button>
        </div>
        {error !== null && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-caption text-destructive"
          >
            {error}
          </p>
        )}
        {saved && error === null && (
          <p role="status" className="text-caption text-muted-foreground">
            Сохранено.
          </p>
        )}
      </form>
    </Row>
  );
}

function SignOut() {
  const { mutate: logout, error } = useLogout();
  return (
    <div className="grid justify-items-start gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-full px-4"
        onClick={() => logout()}
      >
        Выйти
      </Button>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          Не удалось выйти: {error.message}
        </p>
      )}
    </div>
  );
}

function ThemeRow({ me }: { me: Account }) {
  const save = useSaveAccount();
  // undefined: nothing chosen on this page yet, the account's theme is shown.
  const [chosen, setChosen] = useState<Theme | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const current = chosen === undefined ? me.theme : chosen;

  async function choose(theme: Theme | null) {
    if (theme === current) return;
    setChosen(theme);
    setError(null);
    applyAccountTheme(theme);
    try {
      await save({ theme });
    } catch (err) {
      setChosen(undefined);
      applyAccountTheme(me.theme);
      setError(
        `Тему не удалось сохранить: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return (
    <Row label="Тема" hint="меняется сразу и на всех устройствах">
      <div className="grid gap-3">
        <div
          role="radiogroup"
          aria-label="Тема"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {THEME_TILES.map((tile) => {
            const checked = tile.value === current;
            return (
              <button
                key={tile.label}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => void choose(tile.value)}
                className="grid content-start gap-2 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={
                    "relative block h-20 overflow-hidden rounded-xl border-2 " +
                    (checked ? "border-primary" : "border-border")
                  }
                >
                  {tile.value === null ? (
                    <span className="flex h-full">
                      <ThemePreview theme="light" />
                      <ThemePreview theme="dark" />
                    </span>
                  ) : (
                    <ThemePreview theme={tile.value} />
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  {checked && (
                    <Check className="size-4 text-primary" aria-hidden />
                  )}
                  <span className={checked ? "font-semibold" : undefined}>
                    {tile.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {error !== null && (
          <p role="alert" className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    </Row>
  );
}

/** A small desk with a sheet, painted by the tokens of its own theme. */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span
      data-theme={theme}
      aria-hidden
      className="flex h-full flex-1 items-end justify-center bg-desk px-3 pt-3"
    >
      <span className="grid h-full w-full max-w-16 content-start gap-1.5 rounded-t-md bg-paper p-2 shadow-paper">
        <span className="h-1 w-3/4 rounded-full bg-paper-foreground/60" />
        <span className="h-1 w-full rounded-full bg-muted-foreground/40" />
        <span className="h-1 w-5/6 rounded-full bg-muted-foreground/40" />
      </span>
    </span>
  );
}

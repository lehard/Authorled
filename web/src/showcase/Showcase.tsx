import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AiLabel,
  DOCUMENT_STATUSES,
  Paper,
  StatusBadge,
  THEMES,
  ThemeSwitcher,
  type DocumentStatus,
} from "@/design-system";

// Design-system showcase (openspec/specs/web/design-system, requirement «Витрина»).
// It is the only screen allowed to show layer-1 primitives, because documenting them is its job.

const PANGRAM = "Съешь же ещё этих мягких французских булок, да выпей чаю.";
const SCALES = ["neutral", "blue", "violet", "teal", "amber", "crimson"];
const STEPS = Array.from({ length: 12 }, (_, i) => i + 1);
const SEMANTIC = [
  "background",
  "foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "accent",
  "destructive",
  "border",
  "input",
  "ring",
  "paper",
  "paper-foreground",
  "ai",
  "ai-subtle",
];
const DECORATIONS = [
  "insert",
  "delete",
  "comment",
  "ai",
  "conflict",
  "mention",
  "stale",
];
const THEME_LABELS = {
  light: "Светлая",
  sepia: "Сепия",
  dark: "Тёмная",
} as const;
const TYPE_SCALE = [
  ["text-display", "display"],
  ["text-heading-1", "heading-1"],
  ["text-heading-2", "heading-2"],
  ["text-heading-3", "heading-3"],
  ["text-body", "body"],
  ["text-body-prose font-serif", "body-prose"],
  ["text-caption", "caption"],
  ["text-code font-mono", "code"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-10 rounded-md border"
        style={{ background: `var(--${token})` }}
      />
      <code className="text-caption text-muted-foreground">--{token}</code>
    </div>
  );
}

function StatusRow() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(DOCUMENT_STATUSES) as DocumentStatus[]).map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}

export function Showcase() {
  const [grayscale, setGrayscale] = useState(false);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">
            Дизайн-система Authorled
          </h1>
          <p className="text-body text-muted-foreground">
            Токены, темы, шрифты и базовые компоненты
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <Section title="Слой 1 — примитивы">
        {SCALES.map((scale) => (
          <div key={scale} className="grid grid-cols-6 gap-2 md:grid-cols-12">
            {STEPS.map((step) => (
              <Swatch key={step} token={`${scale}-${step}`} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Слои 2 и 3 — семантика">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEMANTIC.map((token) => (
            <Swatch key={token} token={token} />
          ))}
        </div>
      </Section>

      <Section title="Темы">
        <div className="grid gap-4 md:grid-cols-3">
          {THEMES.map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground"
            >
              <p className="text-heading-3 font-semibold">
                {THEME_LABELS[theme]}
              </p>
              <Paper className="text-body-prose">{PANGRAM}</Paper>
              <StatusRow />
              <div className="flex gap-2">
                <Button>Утвердить</Button>
                <Button variant="outline">Отложить</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Шрифты">
        <p className="font-sans text-heading-3">
          Golos Text — интерфейс. {PANGRAM}
        </p>
        <p className="font-serif text-heading-3">
          Literata — документы и проза. {PANGRAM}
        </p>
        <p className="font-mono text-heading-3">
          Cousine — сценарий. {PANGRAM}
        </p>
      </Section>

      <Section title="Шкала текста">
        {TYPE_SCALE.map(([className, name]) => (
          <p key={name} className={className}>
            {name} — {PANGRAM}
          </p>
        ))}
      </Section>

      <Section title="Бумага">
        <Paper className="rounded-lg border p-8">
          <p>
            Автор открывает документ этапа и видит колонку текста шириной около
            шестидесяти пяти знаков: такую строку глаз охватывает без усилий, а
            переносы расставляет сам браузер. Достопримечательности,
            человеконенавистничество и высокопревосходительство переносятся по
            слогам, если браузер знает правила русского языка.
          </p>
        </Paper>
      </Section>

      <Section title="Статусы документа">
        <label className="flex items-center gap-2 text-body">
          <input
            type="checkbox"
            checked={grayscale}
            onChange={(event) => setGrayscale(event.target.checked)}
          />
          Оттенки серого: статус различим без цвета
        </label>
        <div className={grayscale ? "grayscale" : undefined}>
          <StatusRow />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="stale" label="Устарел после правки Д4" />
          <StatusBadge status="conflict" label="Противоречит Д7" />
        </div>
      </Section>

      <Section title="Метка ИИ">
        <p className="flex items-center gap-2 text-body">
          Формулировка темы
          <AiLabel
            action="Предложил формулировку темы"
            sources={[
              { code: "Д1", title: "Карта импульсов" },
              { code: "Д2", title: "Манифест темы" },
            ]}
            acceptedAt={new Date("2026-10-27T10:30:00Z")}
            acceptedBy="Автор"
          />
        </p>
        <p className="flex items-center gap-2 text-body">
          Вариант логлайна
          <AiLabel
            action="Предложил вариант логлайна"
            sources={[{ code: "Д9", title: "Концепт-вектор" }]}
          />
        </p>
      </Section>

      <Section title="Пометки в тексте">
        <div className={grayscale ? "grayscale" : undefined}>
          <Paper className="flex flex-col gap-4 rounded-lg border p-8 pl-12">
            <p>
              Анна{" "}
              <span className="deco-insert">вернулась домой на рассвете</span>,{" "}
              <span className="deco-delete">хотя обещала</span> не опаздывать.{" "}
              <span className="deco-comment">Соседи видели её у реки</span>, а{" "}
              <span className="deco-conflict">
                брат утверждал, что она не выходила из комнаты
              </span>
              . <span className="deco-mention">Марк</span> молчал.
            </p>
            <p className="deco-ai">
              Этот абзац предложил ИИ, автор его принял.
            </p>
            <p className="deco-stale">Этот абзац устарел после правки Д4.</p>
          </Paper>
        </div>
        <Separator />
        <ul className="grid gap-1 text-body md:grid-cols-2">
          {DECORATIONS.map((name) => (
            <li key={name}>
              <code className="text-code">.deco-{name}</code>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

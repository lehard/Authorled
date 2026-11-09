import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  AiLabel,
  InkLoader,
  Paper,
  THEMES,
  ThemeSwitcher,
} from "@/design-system";
import { plainDoc, type ScreenplayDoc } from "@/editor/document.ts";
import { ScreenplayEditor } from "@/editor/ScreenplayEditor";
import { COVER_COLORS } from "@/data/model";
import "@/screens/workspace.css";

// Design-system showcase (openspec/specs/web/design-system, requirement «Витрина»).
// It is the only screen allowed to show layer-1 primitives, because documenting them is its job.

const PANGRAM = "Съешь же ещё этих мягких французских булок, да выпей чаю.";
const SCALES = ["neutral", "blue", "plum", "teal", "amber", "crimson"];
const STEPS = Array.from({ length: 12 }, (_, i) => i + 1);
const SEMANTIC = [
  "desk",
  "panel",
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
  "border-strong",
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

// «Тихая вода» from mockup v2 with every paragraph type and the author's colour marks.
const SCRIPT_SAMPLE: ScreenplayDoc = {
  type: "doc",
  content: [
    ...plainDoc([
      ["act", "Акт первый"],
      ["sequence", "Утро у озера"],
      ["sceneHeading", "НАТ. ОЗЕРО, МОСТКИ — РАССВЕТ"],
      ["sceneCharacters", "Миша"],
      ["beat", "Миша уходит на озеро один"],
    ]).content,
    {
      type: "action",
      content: [
        { type: "text", text: "1998 год. " },
        {
          type: "text",
          text: "Туман над водой.",
          marks: [{ type: "highlight", attrs: { color: "2" } }],
        },
        { type: "text", text: " МИША (17) идёт по мосткам босиком, в руке " },
        {
          type: "text",
          text: "удочка",
          marks: [{ type: "textColor", attrs: { color: "4" } }],
        },
        { type: "text", text: "." },
      ],
    },
    ...plainDoc([
      ["shot", "Крупно: поплавок"],
      ["transition", "Склейка:"],
      ["sceneHeading", "ИНТ. ДОМ ВЕРЫ, КУХНЯ — УТРО"],
      ["character", "Вера"],
      ["dialogue", "Да, Анечка."],
      ["character", "Аня (З.К.)"],
      ["parenthetical", "тихо"],
      ["dialogue", "Мам, я приеду в пятницу. Надолго."],
      ["lyrics", "Ой, то не вечер, то не вечер"],
      ["unformatted", "Простой текст без оформления."],
      ["inlineNote", "Проверить: в 1998 году мостки ещё были деревянные?"],
    ]).content,
  ],
};

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

export function Showcase() {
  const [grayscale, setGrayscale] = useState(false);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">
            Дизайн-система Соавтора
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
              className="desk flex flex-col gap-3 overflow-hidden rounded-panel p-4 text-foreground"
            >
              <p className="text-heading-3 font-semibold">
                {THEME_LABELS[theme]}
              </p>
              <Paper className="rounded-md p-4 text-body-prose shadow-paper">
                {PANGRAM}
              </Paper>
              <div className="flex gap-2">
                <Button>Утвердить</Button>
                <Button variant="outline">Отложить</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Поверхности «Кабинета»">
        <div className="desk flex flex-col gap-6 overflow-hidden rounded-panel p-6 md:flex-row md:items-start">
          <div className="flex w-full flex-col gap-3 rounded-panel bg-panel p-5 shadow-panel md:w-72">
            <p className="text-heading-3 font-semibold">Панель на столе</p>
            <p className="text-body text-muted-foreground">
              --panel, --shadow-panel, --radius-panel
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button>Утвердить</Button>
              <Button variant="outline">Отложить</Button>
              <AiLabel
                action="Предложил название сцены"
                sources={[{ code: "Д20", title: "Черновик сцены" }]}
              />
            </div>
          </div>
          <Paper className="flex-1 rounded-md p-8 shadow-paper">
            <p className="text-heading-1">Лист бумаги</p>
            <p>
              Стол — фон страницы с мягким светом лампы сверху и лёгким зерном.
              На нём лежат панели, а сверху — лист документа с более глубокой
              тенью: --desk, --desk-glow, --grain-image, --paper,
              --shadow-paper.
            </p>
          </Paper>
        </div>
      </Section>

      <Section title="Обложки">
        <p className="text-body text-muted-foreground">
          Обложка истории, пока своей нет: --cover-&lt;цвет&gt;-from, -to,
          -foreground.
        </p>
        <div className="desk grid grid-cols-2 gap-4 rounded-panel p-6 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(COVER_COLORS).map(([color, label]) => (
            <span key={color} className="book" data-cover={color}>
              {label}
            </span>
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
        <p className="text-heading-1">
          Literata — заголовки (--font-heading). {PANGRAM}
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

      <Section title="Ожидание">
        <div className="flex flex-wrap items-center gap-8">
          <div className="grid justify-items-center gap-3 text-muted-foreground">
            <InkLoader />
            Входим…
          </div>
          <p className="max-w-md text-body text-muted-foreground">
            Линия пишется чернилами и стирается. При «уменьшить движение» в
            системе она стоит написанной.
          </p>
        </div>
      </Section>

      <Section title="Прокрутка, выделение, фокус">
        <p className="max-w-2xl text-body text-muted-foreground">
          Полосы прокрутки, выделение текста, курсор, кольцо фокуса и
          автозаполнение полей рисует дизайн-система, а не браузер. Выделите
          текст, пройдите по кнопкам клавишей Tab, прокрутите список.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {THEMES.map((theme) => (
            <div
              key={theme}
              data-theme={theme}
              className="desk grid gap-3 rounded-panel p-4 text-foreground"
            >
              <div className="h-32 overflow-y-auto rounded-xl bg-paper p-3 text-paper-foreground shadow-panel">
                {Array.from({ length: 12 }, (_, i) => (
                  <p key={i}>
                    Строка {i + 1}: {PANGRAM}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-panel px-3 py-1 shadow-panel"
                >
                  Своя кнопка
                </button>
                <Button size="sm">Кнопка shadcn</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Редактор сценария">
        <p className="max-w-2xl text-body text-muted-foreground">
          Четырнадцать типов абзацев STARC: Tab и Enter ведут к следующему типу,
          Ctrl+цифра задаёт тип. Выделите слово, чтобы дать ему цвет или
          заливку. В колонке уже 840 пикселей лист идёт сплошным, без разрывов
          страниц.
        </p>
        <div className="desk overflow-hidden rounded-panel p-4 sm:p-6">
          <ScreenplayEditor mode="text" doc={SCRIPT_SAMPLE} />
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
        <div className="flex items-center gap-2 text-body">
          <Checkbox
            id="showcase-grayscale"
            checked={grayscale}
            onCheckedChange={(checked) => setGrayscale(checked === true)}
          />
          <label htmlFor="showcase-grayscale">
            Оттенки серого: пометка различима без цвета
          </label>
        </div>
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

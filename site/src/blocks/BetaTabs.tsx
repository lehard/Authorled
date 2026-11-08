import { useRef, useState, type KeyboardEvent } from "react";

import { Shot } from "../components/ui";
import { BETA } from "../content/copy";
import { useInView } from "../motion/hooks";

// What works in the beta, as tabs (openspec/specs/web/site, «Бета вкладками»; design D6): the ARIA tabs
// pattern; every panel is in the prerendered HTML, the inactive ones with `hidden`.

const TABS = [
  {
    id: "script",
    label: "Сценарий",
    title: "Сценарий в отраслевом формате",
    text: "Сцены, ремарки, персонажи и реплики без настройки. Навигатор по сценам, поиск и замена.",
    shot: "workspace",
    alt: "Рабочее место Соавтора: слева навигатор истории, в центре текст сценария, справа чат соавтора.",
  },
  {
    id: "cards",
    label: "Карточки",
    title: "Персонажи, локации и миры",
    text: "Карточки истории: роль, возраст, прошлое, цели. Соавтор читает их, когда отвечает, — и говорит о ваших героях, а не о выдуманных.",
    shot: "character",
    alt: "Карточка персонажа Веры: роль в истории, возраст, описание и разделы «Внешность», «Личность», «Прошлое», «Цели и перемены».",
  },
  {
    id: "drafts",
    label: "Драфты",
    title: "Драфты и сохранения",
    text: "Попробуйте другой ход в отдельном драфте: свой сценарий и свои карточки. Именованные точки и откат к любой из них.",
    shot: "drafts",
    alt: "Переключатель драфтов: «Драфт 1» и «Драфт 2: Вера говорит первой».",
  },
  {
    id: "review",
    label: "Рецензирование",
    title: "Рецензирование, импорт и экспорт",
    text: "Комментарии и предложения правок прямо в тексте, с обсуждением в ветке. Импорт Fountain, FDX, проектов STARC, DOCX и TXT; экспорт в Fountain и FDX.",
    shot: "comments",
    alt: "Комментарии редактора к репликам сценария в списке открытых комментариев.",
  },
  {
    id: "coauthor",
    label: "Соавтор",
    title: "Соавтор, который предлагает правки",
    text: "Видит открытый документ и выделенный фрагмент, находит противоречия между сценами и присылает правки. Принимаете их вы.",
    shot: "coauthor-answer",
    alt: "Ответ соавтора на просьбу проверить противоречия: несостыковки между сценами и вопрос автору, как задумано.",
  },
] as const;

export function BetaTabs() {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref);
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const next = (index + TABS.length) % TABS.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusTab(target);
  }

  return (
    <section
      aria-labelledby="beta-tabs-title"
      className="px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        ref={ref}
        data-reveal
        className="mx-auto flex w-full max-w-6xl flex-col gap-8"
      >
        <div className="flex max-w-[680px] flex-col gap-4">
          <h2 id="beta-tabs-title" className="heading-2 text-foreground">
            {BETA.title}
          </h2>
          <p className="body-lg text-muted-foreground">{BETA.lead}</p>
        </div>
        <div
          role="tablist"
          aria-label={BETA.title}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-1 sm:px-1"
        >
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`beta-tab-${tab.id}`}
              aria-selected={index === active}
              aria-controls={`beta-panel-${tab.id}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKey(event, index)}
              className="shrink-0 rounded-full px-4 py-2 button-sm text-foreground ring-1 ring-border-strong transition-colors duration-300 ease-base hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:ring-primary"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {TABS.map((tab, index) => (
          <div
            key={tab.id}
            id={`beta-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`beta-tab-${tab.id}`}
            hidden={index !== active}
            className="site-fade-in grid items-start gap-8 lg:grid-cols-[1fr_2.2fr]"
          >
            <div className="flex flex-col gap-3 lg:pt-6">
              <h3 className="heading-5 text-foreground">{tab.title}</h3>
              <p className="body-3 text-muted-foreground">{tab.text}</p>
            </div>
            <Shot name={tab.shot} alt={tab.alt} caption={BETA.caption} />
          </div>
        ))}
      </div>
    </section>
  );
}

# Design

## Context

См. proposal.md — Why. Правило автозаполнения сейчас в `@layer base` файла `web/src/design-system/typography.css` (подключается из `tokens.css` вместе с Tailwind) и задаёт `-webkit-text-fill-color`, `caret-color`, `box-shadow: 0 0 0 1000px var(--paper) inset` и `transition: background-color 9999s`. Утилиты Tailwind лежат в `@layer utilities`, который по каскаду слоёв сильнее `base`; у `Input` есть `transition-colors`, `focus-visible:ring-3` и `aria-invalid:ring-3` (кольцо — это `box-shadow`).

## Goals / Non-Goals

**Goals:**
- Одно правило, которое не проигрывает утилитам ни одного поля, без правки компонентов shadcn.

**Non-Goals:**
- Стили отдельных полей и компонентов.

## Decisions

1. **Правило вне слоёв.** Блок переносится из `@layer base` в конец `typography.css` без `@layer`: в каскаде слоёв нормальные объявления вне слоёв сильнее любых слоёв, включая `utilities`, поэтому `!important` не нужен.
   - Альтернатива: `!important` внутри `base`. Отклонена: `!important` в слое переворачивает порядок слоёв и мешает будущим правкам.
   - Альтернатива: класс в `input.tsx`. Отклонена: файл генерирует CLI shadcn, а поля бывают и без него.
2. **Задержка вместо тени.** `transition: background-color 0s 600000s, color 0s 600000s` — браузер начинает менять фон и цвет через ~7 суток, поэтому поле сохраняет свой фон (`bg-transparent` / `dark:bg-input/30`). `box-shadow` больше не задаётся, поэтому кольца фокуса и ошибки рисуются как без автозаполнения.
3. **Цвета.** `-webkit-text-fill-color: var(--foreground)` (Chrome красит текст через своё значение `color` с `!important`, а `-webkit-text-fill-color` побеждает его), `caret-color: var(--primary)`.
4. **Проверка в `check-native-ui.ts`.** Скрипт читает CSS файлов `web/src/design-system/`, находит блок с селектором `input:-webkit-autofill`, проверяет, что он не внутри `@layer`, и что в нём есть `-webkit-text-fill-color: var(--foreground)` и `transition` с задержкой; иначе — ошибка с названием правила. Название и описание скрипта дополняются пунктом «Без системного вида».

## Risks / Trade-offs

- [Автозаполнение нельзя вызвать программно во встроенном браузере] → проверка в браузере имитирует состояние: в тесте страницы временно подключается такой же блок для класса, повторяющего `:-webkit-autofill`, плюс жёлтый фон с `!important`, как у Chrome; сверяется фон и цвет текста в фокусе и с ошибкой. Итог и ограничение — в `tmp/VERIFY.md`; живая проверка в Chrome с сохранённой почтой — за владельцем при следующем входе.
- [Предпросмотр подсказки] → значение под курсором Chrome рисует сам; это в Non-goals.

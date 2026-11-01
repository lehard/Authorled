# Tasks

## 1. Проверки под новые требования

- [x] 1.1 `web/scripts/check-contrast.ts`: новые пары (решение 8 в design): `foreground`/`desk`, `muted-foreground`/`desk`, `foreground`/`panel`, `muted-foreground`/`panel`, `ai`/`panel` с порогом 4,5:1; `border-strong`/`desk` и `border-strong`/`panel` с порогом 3:1. Проверка: на текущих токенах скрипт падает с понятным сообщением о неразрешённых `--desk`, `--panel` и `--border-strong`, то есть пары подхвачены.
- [x] 1.2 Там же — проверки оттенка и равенства: `desk`, `panel`, `paper` в тёмной теме в диапазоне 40–100°; `ai` во всех темах в диапазоне 310–340° и не ближе 40° к `primary` и к каждому `status-*`; `background = desk`, `card = sidebar = panel`, `popover = paper`. Ошибка называет тему, токен и значение. Проверка: на текущих токенах скрипт сообщает фиолетовый `ai` (около 298°) и неравенство поверхностей.

## 2. Палитра и поверхности в токенах

- [x] 2.1 `tokens.css`, слой 1 (решение 1): перестроить нейтральные шкалы `light`, `sepia` и `dark` под тёплые тона «Кабинета» (ступени 1–3 — стол, панель, бумага; 11–12 — текст), подстроить `blue` под чернильный акцент, добавить шкалу `plum` (около 318°) во всех темах. Проверка: `npm run build --prefix web` проходит.
- [x] 2.2 `tokens.css`, слои 2–3 (решения 2–4, 6): `--desk`, `--desk-glow`, `--panel`, `--border-strong`, `--shadow-panel`, `--shadow-paper`, `--grain-opacity`, `--grain-image` (варианты для светлых тем и тёмной), `--radius: 0.75rem`, `--radius-panel: 1.25rem`; переназначить `--background`, `--card`, `--sidebar`, `--popover`, `--secondary`, `--muted`, `--accent`; `--ai*` и `--deco-ai` — на `plum`; вывод в Tailwind: `shadow-panel`, `shadow-paper`, `rounded-panel`, цвета `desk` и `panel`. Удалить `violet`, если `grep -rn "violet" web/src` после переназначения пуст. Проверка: `npm run check:contrast --prefix web` проходит во всех темах вместе с проверками из группы 1; `./web/scripts/check_web_tokens.sh` проходит.
- [x] 2.3 `typography.css` (решения 5 и 7): класс `.desk` (зерно, свет, цвет стола) и фон стола на `body` в `@layer base`; токен `--font-heading` (Literata) и `font-family: var(--font-heading)` с межбуквенным интервалом около −0,015em для `display`, `heading-1`, `heading-2`. Проверка: в браузере у `body` вычисленный `background-image` содержит `radial-gradient`, у `body::before` — SVG зерна с `opacity`, равной `--grain-opacity`; у образца `heading-1` `font-family` совпадает с `--font-heading`.
- [x] 2.4 Компоненты `web/src/design-system/components/` и `web/src/components/ui/`: заменить ссылки на токены, у которых сменилась роль, если такие есть (например, `--ai-border` на новый `plum`); без рефакторинга. Проверка: `npm run typecheck --prefix web` и `npm run lint --prefix web` проходят.

## 3. Витрина

- [x] 3.1 `web/src/showcase/Showcase.tsx`: раздел «Поверхности» — стол со светом и зерном, панель с `shadow-panel` и `rounded-panel`, лист бумаги с `shadow-paper`, образцы кнопки, поповера и тултипа на столе и на панели; в разделе «Шрифты» — роль `--font-heading`; шкала `plum` в разделе примитивов. Проверка: `npm run dev --prefix web`, витрина показывает новые разделы в `light`, `sepia` и `dark`; снимки трёх тем сравнить с `openspec/context/_raw/design/kabinet/screens/shelf-light.png` и `scene-dark.png` по характеру (тёплый стол, бумага светлее стола, тёплая тёмная тема).

## 4. Итоговая проверка

- [x] 4.1 `./scripts/validate.sh` и `git diff --check` проходят на чистом дереве; `openspec validate kabinet-palette-tokens --strict` проходит. Результаты и ограничения (браузеры, где смотрели витрину; непроверенные Firefox и Safari) — в `tmp/VERIFY.md`.

# Tasks

Результаты проверок записываются в `tmp/VERIFY.md` раздельно: static (линт, типы, формат), deterministic (сборка, проверки токенов и контраста), browser (витрина в браузере: сеть, темы, клавиатура, переносы). Hosted не проверяется: деплоя фронтенда в этом change нет.

## 1. Каркас `web/`

- [x] 1.1 Создать `web/` как Vite-приложение React + TypeScript (D1, D3): `index.html` с `lang="ru"` и заголовком «Authorled», `src/main.tsx`, `src/App.tsx`; `web/.nvmrc` и `engines` с Node.js 24; точные версии без `^` в `package.json`, `package-lock.json` в репозитории. Проверить совместимость TypeScript 7 с typescript-eslint и Vite; при несовместимости закрепить последнюю совместимую версию и записать причину (Risks). Проверка: `npm ci --prefix web && npm run build --prefix web` проходят, `web/dist/index.html` содержит `lang="ru"`.
- [x] 1.2 `vite.config.ts`: сервер разработки и предпросмотра на `127.0.0.1`, `strictPort`. В `package.json` команды `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `typecheck`, `check:contrast` (последняя пока падает с сообщением «tokens.css не найден» до группы 3). Проверка: `npm run dev --prefix web` слушает только `127.0.0.1` (`lsof -iTCP -sTCP:LISTEN`).
- [x] 1.3 ESLint (flat config: typescript-eslint, react-hooks, react-refresh) и Prettier с `prettier-plugin-tailwindcss`. Дописать в `.gitignore` `web/node_modules/` и `web/dist/`. Проверка: `npm run lint --prefix web` и `npm run format:check --prefix web` проходят; `git status` не показывает `node_modules` и `dist`.

## 2. Проверки фронтенда в общем гейте

- [x] 2.1 `scripts/validate.sh`: если нет `web/node_modules`, ошибка с подсказкой `npm ci --prefix web` и код `1`; иначе `format:check`, `lint`, `typecheck`, `build` (D11). `scripts/format.sh`: добавить `npm run format --prefix web`. Проверка: с переименованным `web/node_modules` скрипт выдаёт подсказку и `1`; с неотформатированным файлом в `web/src` подсказывает `./scripts/format.sh` и возвращает `1`; на чистом дереве — `0`.
- [ ] 2.2 `.github/workflows/validate.yml`: `actions/setup-node` с `node-version-file: web/.nvmrc` и кэшем npm по `web/package-lock.json`, затем `npm ci --prefix web` перед `validate.sh`. Проверка: `actionlint` или прогон workflow на ветке; результат в `tmp/VERIFY.md`.
- [x] 2.3 `AGENTS.md`: в «Where changes belong» добавить `web/` и `web/src/design-system/`; в «Local development» и «Verification» — `npm ci --prefix web`, `npm run dev --prefix web`, требование установленных зависимостей для `validate.sh`. `README.md`: короткий раздел «Фронтенд». Проверка: `git diff --check`; команды из документов выполняются как написано.

## 3. Токены, темы и их проверки

- [x] 3.1 Инициализировать shadcn/ui (`components.json`: компоненты в `src/components/ui`, глобальный CSS — `src/design-system/tokens.css`, иконки lucide) и Tailwind v4 через `@tailwindcss/vite`. Добавить компоненты `button`, `badge`, `popover`, `tooltip`, `toggle-group`, `separator`. Проверка: `npm run build --prefix web` проходит; компоненты лежат в `src/components/ui/`.
- [x] 3.2 `tokens.css` в три слоя (D4, D5): примитивы OKLCH по 12 ступеней (нейтральный тёплый, акцент, ИИ, зелёно-бирюзовый, янтарный, малиново-красный); все переменные shadcn; продуктовые токены `--paper*`, `--status-*` для семи статусов, `--deco-*`, `--ai*`, `--font-*`; темы `light`, `sepia` и `dark` под `[data-theme]`; вывод в Tailwind через `@theme inline` без утилит слоя 1. Проверка: сборка проходит; в DevTools у каждой темы переопределены все токены слоёв 2–3 (сравнить списки переменных трёх тем скриптом в `tmp/`).
- [x] 3.3 Начальная тема (D6): встроенный скрипт в `index.html` до бандла (сохранённый выбор `authorled.theme`, иначе `prefers-color-scheme` с подпиской на изменение; значение вне `light | sepia | dark` — исключение) и `ThemeSwitcher` на `toggle-group` с тремя темами. Проверка в браузере: выбор тёмной темы и сепии переживает перезагрузку без мигания светлой; без сохранённого выбора тема следует системной; подложенное значение `blue` даёт ошибку в консоли.
- [x] 3.4 `scripts/check_web_tokens.sh` (D11, по образцу `check_auth_boundary.sh`) и вызов из `validate.sh`. Проверка: временно добавленные в `src/App.tsx` `#ff0000`, `oklch(0.5 0.1 20)` и `bg-red-500` дают по ошибке с файлом и строкой; без них проверка проходит.
- [x] 3.5 `web/scripts/check-contrast.ts` (postcss + culori, раскрытие `var()` по темам; пары: основной текст/фон, `--paper-foreground`/`--paper`, текст и фон каждого статуса, `--ai-foreground`/`--ai-subtle`, маркеры `--deco-*` к `--paper` с порогом 3:1, `--border` и `--ring` к `--background` с порогом 3:1) и вызов из `validate.sh`. Проверка: на итоговых токенах проходит; временно ослабленный `--paper-foreground` в тёмной теме даёт ошибку с темой, парой и значением.
- [x] 3.6 Запрет примитивов слоя 1 вне `tokens.css` и `src/showcase/` в `scripts/check_web_tokens.sh` (имена шкал читаются из `tokens.css`); исключение для витрины — в спеке. Проверка: временный `var(--blue-9)` в `src/App.tsx` даёт ошибку с файлом и строкой; витрина и чистое дерево проходят.

## 4. Шрифты, шкала текста и бумага

- [x] 4.1 `fonts.css` (D7): `@fontsource-variable/golos-text`, `@fontsource-variable/literata`, `@fontsource/cousine` (400 и 700 с курсивами), только подмножества `cyrillic`, `cyrillic-ext`, `latin`; токены `--font-ui`, `--font-prose`, `--font-script`; лицензии OFL перечислить в `web/README.md` или `NOTICE`. Проверка: `web/dist/assets` содержит woff2 этих гарнитур; при открытой витрине в DevTools все запросы — к своему хосту.
- [x] 4.2 `typography.css` (D8): именованная шкала `--text-*` для Tailwind, класс `.paper` (ширина `--paper-measure` = 65ch, межстрочный 1,65, выключка влево, `hyphens: auto`, `--font-prose`) и компонент `Paper`. Проверка: в окне шире 1200 px строка образца не шире `--paper-measure`; записать в `tmp/VERIFY.md`, переносит ли русский текст Chrome, Firefox и Safari.

## 5. Базовые компоненты

- [x] 5.1 `statuses.ts` и `StatusBadge` (D5): семь статусов с иконкой lucide, подписью и токенами; неизвестное значение — исключение с этим значением. Проверка: `npm run typecheck --prefix web`; временный рендер со значением `"archived"` в витрине показывает ошибку с текстом `archived`.
- [x] 5.2 `AiLabel` (D10) на `popover`: пропсы `action`, `sources`, `acceptedAt`, `acceptedBy`; цвет из `--ai*`. Проверка в браузере: Tab до метки, Enter открывает поповер, Escape закрывает и возвращает фокус; цвет метки не совпадает ни с одним статусом (сравнить токены).
- [x] 5.3 Классы пометок `.deco-insert`, `.deco-delete`, `.deco-comment`, `.deco-ai`, `.deco-conflict`, `.deco-mention`, `.deco-stale` (D9): форма плюс цвет из `--deco-*`. Проверка: контраст маркеров проходит `check:contrast`; в оттенках серого (фильтр `grayscale(1)` в DevTools) все семь различимы по форме.

## 6. Витрина и итоговая проверка

- [x] 6.1 `src/showcase/` и `App.tsx` (D12): разделы цветов по слоям, тем, шрифтов с образцом «Съешь же ещё этих мягких французских булок», шкалы текста, бумаги, статусов (с переключателем оттенков серого), метки ИИ, пометок. Тексты на русском. Проверка: `npm run dev --prefix web`, корневой адрес показывает все разделы во всех трёх темах.
- [x] 6.2 Мастер-спека `openspec/specs/overview/spec.md`: заменить строку «Frontend в репозитории отсутствует…» на описание `web/` (Purpose не переносится дельтой). Проверка: `openspec validate web-design-system-foundation --strict` проходит.
- [x] 6.3 Итог: `./scripts/validate.sh` и `git diff --check` проходят на чистом дереве; `npm run preview --prefix web` — в DevTools нет запросов к сторонним хостам. Все результаты и ограничения (переносы по браузерам, версия TypeScript, непроверенный CI) — в `tmp/VERIFY.md`.

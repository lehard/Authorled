# Tasks

## 1. Источник знака

- [x] 1.1 Добавить `docs/brand/export/site.webmanifest` (как манифест приложения, но `display: browser`) и проверить, что `export/manifest.webmanifest` содержит `start_url: "/"`.
- [x] 1.2 Дописать в `docs/brand/README.md`, куда копируются файлы (таблица из D4) и как пересобрать растры (headless Chrome из `site/node_modules/playwright-core`, ICO через Pillow).

## 2. Проверка совпадения

- [x] 2.1 Написать `scripts/check_brand.sh`: таблица «копия → источник» для `web/public/` и `site/public/` (`favicon.svg`, `brand-mark.svg` → `mark.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `manifest.webmanifest`). Сравнение через `cmp`, ошибка с путём копии, без подмен.
- [x] 2.2 Вызвать `check_brand.sh` из `scripts/validate.sh` рядом с `check_web_tokens`.

## 3. Приложение `web/`

- [x] 3.1 Создать `web/public/` с копиями файлов из таблицы D4.
- [x] 3.2 Добавить в `<head>` `web/index.html` ссылки из D2 (без `theme-color`).
- [x] 3.3 Заставка: заменить квадрат `.boot-brand::before` на `<img src="/brand-mark.svg" alt="" width="28" height="28">` и убрать стиль `::before`.
- [x] 3.4 `LoginScreen.tsx` и `shelf/TopBar.tsx`: заменить пустой `span` знака на `<img src="/brand-mark.svg" alt="">` того же размера (28 px).

## 4. Сайт `site/`

- [x] 4.1 Положить в `site/public/` копии файлов из таблицы D4 (`favicon.svg` уже заменён), манифест сайта — под именем `manifest.webmanifest`.
- [x] 4.2 Добавить в `<head>` `site/index.html` ссылки из D2.
- [x] 4.3 `Layout.tsx`: `BrandMark` показывает `<img src="/brand-mark.svg" alt="">` вместо круга с буквой.
- [x] 4.4 `check-build.mjs`: добавить файлы из D5 в список обязательных и проверить четыре ссылки на каждой собранной HTML-странице.

## 5. Проверка

- [x] 5.1 `./scripts/validate.sh` (через `env -u BASH_ENV`) и `git diff --check` проходят. Временная порча копии и удаление копии дают ошибку `check_brand.sh` с путём файла.
- [x] 5.2 В собранных `web/dist/` и `site/dist/` есть значки и ссылки на них. Удаление `site/public/favicon.ico` роняет `check-build.mjs` с именем файла.
- [x] 5.3 Посмотреть глазами в браузере: вкладку приложения и сайта, заставку, экран входа и шапку полки в темах `light` и `dark`, шапку сайта. Записать результат в `tmp/VERIFY.md`.

## Workflow follow-up

- Verify, archive (синхронизация спек `web/brand`, `web/design-system`, `web/site`), merge `origin/main`, проверки, PR в `main` и merge — по шагу 4 правил проекта.
- После релиза проверить значки на `app.soavtor.app` и `soavtor.app` отдельным маленьким PR с записью проверки.

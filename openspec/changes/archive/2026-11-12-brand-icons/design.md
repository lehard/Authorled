# Design

## Context

Причины — в `proposal.md` (Why). Что есть сейчас:

- В `docs/brand/` лежат мастер-файлы знака (`mark.svg`, `mark-16.svg`, `mark-square.svg`, `mark-maskable.svg`), логотипы `logo-light.svg` и `logo-dark.svg`, а в `export/` — растры и `manifest.webmanifest`. Растры собраны headless Chrome и Pillow вне репозитория.
- У `web/` нет каталога `public/`. В `web/index.html` нет ссылок на значки. Заставка рисует знак псевдоэлементом `.boot-brand::before` — квадратом цвета `--primary`.
- `LoginScreen.tsx` и `shelf/TopBar.tsx` рисуют знак пустым `span` (`size-7 rounded-lg bg-primary`).
- `site/src/components/Layout.tsx` рисует `BrandMark` — круг `bg-primary` с буквой «С». `site/index.html` — общий шаблон всех страниц пререндера, в нём одна ссылка на `/favicon.svg`. `site/scripts/check-build.mjs` проверяет только наличие `favicon.svg`.
- `web/scripts/check_web_tokens.sh` ищет сырые цвета в `web/src`, `site/src` и `web/index.html`. Файлы в `public/` он не смотрит.
- Caddy отдаёт статические файлы приложения и сайта через `file_server`, адрес `/` приложения откатывается на `index.html` (`try_files`). Существующие файлы из корня `dist/` отдаются как есть.

## Goals / Non-Goals

**Goals:**

- Одни и те же файлы знака во всех местах, с одним источником и проверкой совпадения.
- Знак в фиксированных цветах при любой теме, без сырых цветов в коде экранов.

**Non-Goals:**

- Генерация растров в сборке или в CI.
- Своя отрисовка знака под тёмную вкладку браузера (`prefers-color-scheme` внутри SVG): плашка знака непрозрачная и видна на любом фоне.

## Decisions

**D1. Знак в интерфейсе — `<img src="/brand-mark.svg" alt="">`, а не встроенный SVG.**
Встроенный SVG потребовал бы либо сырых цветов в разметке (их запрещает проверка токенов), либо токенов, которые меняются вместе с темой, — а знак должен быть одинаковым. Файл `brand-mark.svg` — побайтная копия `docs/brand/mark.svg`, у `<img>` заданы `width` и `height`, поэтому раскладка не прыгает. Отдельное имя вместо `/favicon.svg` выбрано потому, что значок вкладки и знак в интерфейсе могут разойтись: например, если значку понадобится своя отрисовка, знак в интерфейсе не изменится. `alt=""` скрывает знак от экранных чтецов, рядом стоит текст «Соавтор».
Альтернативы: CSS `background-image` у `::before` (работает на заставке, но в React-экранах `<img>` прямее) и data URI (сырые цвета в коде, нарушение проверки).

**D2. Набор ссылок в `<head>`.**
```
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="…">
```
Современные браузеры берут SVG, старые и сервисы закладок — ICO. В ICO 16 px отрисован отдельно (`mark-16.svg`). Значение `theme-color` — цвет плашки. Это атрибут разметки, и проверка токенов поймала бы его как сырой цвет в `web/index.html`. Поэтому `theme-color` задаётся только в манифесте, а в `<head>` его нет. Chrome на Android берёт цвет из манифеста.

**D3. Манифесты.** Манифест приложения `docs/brand/export/manifest.webmanifest` (`display: standalone`, `start_url: "/"`) копируется в `web/public/manifest.webmanifest`. Манифест сайта `docs/brand/export/site.webmanifest` (`display: browser`, тот же набор значков) копируется в `site/public/manifest.webmanifest`. Оба лежат в `docs/brand/`, поэтому копии проверяются одним способом.

**D4. Проверка совпадения — `scripts/check_brand.sh`.**
В скрипте явная таблица «копия → источник»: `web/public/*` и `site/public/*` против `docs/brand/…`. Каждая пара сравнивается `cmp`. Нет файла или разница — ошибка с путём копии, скрипт выходит с ненулевым кодом. Подмен нет. `validate.sh` запускает скрипт рядом с `check_web_tokens`. Таблица в коде, а не поиск по каталогам: так отсутствие копии тоже ловится.

**D5. Проверка сборки сайта.** `check-build.mjs` добавляет в список обязательных файлов `favicon.ico`, `apple-touch-icon.png`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` и `brand-mark.svg`. Для каждой собранной HTML-страницы скрипт проверяет четыре ссылки из D2.

**D6. Проверка приложения.** Отдельного скрипта для `web/dist` нет. Vite копирует `public/` как есть, а совпадение исходников проверяет D4. Ссылки в `web/index.html` проверяются глазами при сборке и в задаче проверки (tasks).

**D7. Растры не пересобираются в репозитории.** README в `docs/brand/` описывает, как их пересобрать (headless Chrome из `site/node_modules/playwright-core`, ICO через Pillow). Скрипт с Pillow потянул бы зависимость Python ради редкой операции.

## Risks / Trade-offs

- [Браузеры долго держат старый значок сайта в кэше] → новые файлы с теми же именами, кроме ICO. Принимаем: значок обновится сам в течение нескольких дней.
- [Знак на заставке — лишний запрос до скрипта] → файл около 300 байт с `width` и `height`. Бюджет первого экрана (`check-bundle.mjs`) считает скрипты и стили, а не изображения.
- [Цвет плашки разойдётся с токеном `--blue-9`, если токен поменяют] → цвета знака зафиксированы в `docs/brand/README.md` как отдельное решение. Знак не обязан следовать токенам.

## Migration Plan

Выкладка обычным релизом из `main`: файлы приходят вместе с `web/dist` и `site/dist`, правок Caddy и сервера нет. Откат — revert пулл-реквеста и следующий релиз.

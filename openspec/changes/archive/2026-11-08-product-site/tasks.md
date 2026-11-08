# Tasks

## 1. Заявки в ядре

- [x] 1.1 Таблица `beta_requests` в `agno/core/tables.py` и миграция `agno/migrations/versions/0011_beta_requests` (колонки, `UNIQUE (email)`, `CHECK` роли и нижнего регистра почты, индекс по `created_at`); проверка: `./scripts/dev.sh test` — тест колонок, отказ дубля и неизвестной роли на уровне базы; `./scripts/validate.sh` — одна голова миграций
- [x] 1.2 `agno/core/beta_requests.py`: `submit` (advisory-блокировка, окно 60 с / 20 заявок → исключение с `retry_after`, `INSERT … ON CONFLICT DO NOTHING`) и `list_requests` (новые первыми, отметка «уже пользователь»); проверка: тесты ядра на дубль без изменения полей, 21-ю заявку в окне, порядок списка и отметку пользователя

## 2. Маршрут без токена

- [x] 2.1 `body.read_small_object(request, limit)` с отказом `413` по `Content-Length` и по прочитанным байтам; проверка: тест маршрута с телом больше 4 КБ → `413`
- [x] 2.2 `agno/app/api/beta.py`: `POST /api/v1/beta-requests` — проверка полей (`422` с полем в `detail`, лишние поля), ловушка `website`, `202 {"status": "accepted"}`, `429` с `Retry-After`, логи без почты и имени; подключение в `attach_api`; проверка: тесты всех сценариев спеки `api/beta-requests`
- [x] 2.3 `build_authorization`: `excluded_route_paths` = явный список Agno по умолчанию + `/api/v1/beta-requests`; тест, что список совпадает с `JWTMiddleware._get_default_excluded_routes()` пина; проверка: тесты — заявка без токена доходит до обработчика, `GET /api/v1/me` без токена → `401`; `./scripts/check_auth_boundary.sh` проходит

## 3. Команда администратора

- [x] 3.1 Подкоманда `beta-requests` в `agno/admin/__main__.py` (таблица: время UTC, почта, имя, кто, уже пользователь; «Заявок нет.» и код 0 на пустом списке) и `beta-requests` в `scripts/usage.sh` (без аргументов, строка `usage`); проверка: тест команды на двух заявках и на пустой таблице; `./scripts/usage.sh local beta-requests` на локальном стеке

## 4. Модуль `site/`: каркас и сборка

- [x] 4.1 `site/package.json` с теми же точными версиями, что `web/` (React, Vite, Tailwind, TS, ESLint, Prettier, `@vitejs/plugin-react`, `@tailwindcss/vite`), скрипты `dev`, `build`, `preview`, `lint`, `typecheck`, `format`, `format:check`; `package-lock.json`; `.nvmrc` как у `web/`; проверка: `npm ci --prefix site` проходит
- [x] 4.2 `site/vite.config.ts`: `.env` корня, обязательные `SITE_ORIGIN`, `SITE_APP_URL` (абсолютный `http(s)`), для `dev` — `AGENTOS_URL` и прокси `/os/`; ошибка при отсутствии `web/node_modules`; `127.0.0.1:5174`, `strictPort`; проверка: сборка без `SITE_APP_URL` падает с его именем, `grep` по собранным файлам не находит `LITELLM_MASTER_KEY`
- [x] 4.3 Стили: `site/src/styles.css` импортирует `web/src/design-system/tokens.css`, `@source` на `site/src`, `<html lang="ru" data-theme="light">`; свои кнопка и поле на семантических токенах; проверка: `npm run build --prefix site`, страница в теме «Утро» со шрифтами Golos и Literata
- [x] 4.4 Пререндер: `src/site.ts` (таблица страниц: путь, файл, title, description, индексировать ли), `src/App.tsx` (компонент страницы), `src/entry-server.tsx`, `src/entry-client.tsx` (`hydrateRoot`), `scripts/prerender.mjs` — `index.html`, `privacy/index.html`, `404.html` (`noindex`), `sitemap.xml`, `robots.txt`, canonical и Open Graph из `SITE_ORIGIN`; проверка: сценарии «Сборка в статические файлы», «Текст виден без JavaScript», «Метаданные страницы» спеки `web/site` — проверочный скрипт по собранному каталогу

## 5. Содержание сайта

- [x] 5.1 Скопировать скиллы `landing-page-design`, `copywriting`, `unslop` из `/Users/lehard/glavai/.claude/skills/` в `.agents/skills/`; проверка: файлы на месте, `SKILL.md` читаются
- [x] 5.2 Скриншоты из `tmp/glavai-case/shots/` в WebP 720 и 1440 в `site/public/shots/` и `og:image` 1200×630 из кадра рабочего места; проверка: файлы есть, `og:image` открывается в собранном `index.html`
- [x] 5.3 Главная по спеке (семь блоков по порядку, методология с «скоро», без цифр и отзывов), тексты по скиллам и фактам `tmp/glavai-case/README.md`; «Войти» → `SITE_APP_URL`; проверка: локальный просмотр на 1440 и 390 px без горизонтальной прокрутки, кнопки на первом экране, скриншоты подписаны как бета
- [x] 5.4 Форма заявки (поля, согласие со ссылкой, ошибки до отправки, `202` → «Заявка принята», `detail` отказа, сетевая ошибка с кодом, блокировка кнопки); проверка: на локальном стеке заявка появляется в `./scripts/usage.sh local beta-requests`, без согласия запроса нет, `429` показывает `detail`
- [x] 5.5 Страница `/privacy/` (данные, цель, место хранения, срок, отзыв согласия; оператор и почта для связи — от владельца), ссылки у согласия и в подвале; проверка: в собранной странице нет заглушек, обе ссылки ведут на `/privacy/`

## 6. Проверки, документы, правило процесса

- [x] 6.1 `scripts/validate.sh`: блок `site/` (нет `site/node_modules` → ошибка с `npm ci --prefix site`; `format:check`, `lint`, `typecheck`, `build`; совпадение пина Tailwind в `web/` и `site/`); `web/scripts/check_web_tokens.sh` проверяет и `site/src`; `scripts/format.sh` форматирует `site/`; проверка: `./scripts/validate.sh` проходит, сырой цвет в `site/src` её роняет (проверить временной правкой и откатить)
- [x] 6.2 `.github/workflows/validate.yml`: `npm ci --prefix site` и `SITE_ORIGIN=https://site.invalid`, `SITE_APP_URL=https://app.invalid`; `example.env`: `SITE_ORIGIN`, `SITE_APP_URL` с локальными адресами и комментарием; проверка: локальный запуск шага сборки с этими значениями проходит
- [x] 6.3 `AGENTS.md`: `site/` в «Where changes belong», «Local development» (`npm ci --prefix site`, `npm run dev --prefix site`), исключение OpenSpec для текстов и картинок `site/`; `README.md` — как запустить сайт локально; `openspec/context/03-architecture.md` — четвёртый модуль; проверка: `git diff --check`, описания совпадают с командами
- [x] 6.4 Записать проверки и ограничения в `tmp/VERIFY.md` (static, deterministic, локальный стек; hosted — не было, сайт не выкладывался); `./scripts/validate.sh`, `./scripts/dev.sh test`, `git diff --check` проходят

## Workflow follow-up

- Перед выкладкой сайта (интент переезда на свой домен): Caddy сайта с `handle_path /os/api/v1/beta-requests` → API, Метрика, расширение принятого риска ПДн в `05-security-and-compliance.md`.
- Перед выкладкой сайта: уведомление Роскомнадзора об обработке ПДн от ИП Соловьева А. Л.; заявки хранятся в РФ (сейчас сервер в Финляндии, требование локализации 152-ФЗ) — решение владельца.
- Название продукта «Соавтор» в сервисе, письмах и документации — отдельный интент; на сайте уже «Соавтор».
- `/opsx:verify`, затем `/opsx:archive`.

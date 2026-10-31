# Tasks

## 1. Почта и бренд

- [x] 1.1 `auth/compose.yaml`: сервис `mailpit` (закреплённый тег, веб на `127.0.0.1:8025`), `AUTHENTIK_EMAIL__*` в `&authentik-env` с `${…:?…}`; `compose.prod.yaml`: `mailpit` с `profiles: ["never"]`, `AUTHENTIK_COOKIE_DOMAIN` обязательный; `example.env` — переменные с пояснениями, `AUTH_BRAND_DOMAIN=localhost:9000`, `AUTH_DEV_USER_PASSWORD`. Проверка: `docker compose config --services` содержит `mailpit`, с `-f compose.prod.yaml` — нет; без `AUTHENTIK_EMAIL__HOST` `docker compose config` падает с её именем.
- [x] 1.2 Проверка бренда: после `docker compose up -d` `/api/v3/core/brands/current/` на `localhost:9000` отдаёт `authorled-authentication`.

## 2. Поток входа

- [x] 2.1 `30-authentication-flow.yaml` по решению 3; шаблон `auth/templates/email/authorled-code.html` и его монтирование. Проверка: `./scripts/validate.sh` (граница `auth`); через API шагов (curl с cookie): почта → пароль → письмо с кодом в Mailpit → код → `xak-flow-redirect`; пользователь без пароля — сразу код; неверный код — ошибка.
- [x] 2.2 `auth/blueprints-dev/dev-users.yaml`, монтирование в `/blueprints-dev`, `./scripts/dev.sh auth-users` (решение 8). Проверка: оба пользователя в своих группах; при `RUNTIME_ENV=prd` и без `AUTH_DEV_USER_PASSWORD` — ошибка с причиной.

## 3. Фронтенд

- [x] 3.1 Прокси Vite (`/api/v3/flows/executor/` → origin `AUTH_ISSUER`, `/mailpit/` → `http://localhost:8025`); `web/src/auth/flow/flowClient.ts` (решение 6).
- [x] 3.2 Экран `/login` по v1: почта, пароль с «Показать», код в 6 ячейках, «Отправить ещё раз» через 60 секунд, «Другая почта», ошибки; `RequireAuth` ведёт на `/login?returnTo=…`; после потока — `signinRedirect` (решения 1, 7).
- [x] 3.3 «Выйти» → `/login` через выход в Authentik (решение 10).
- [x] 3.4 Быстрый вход для разработки (решение 9). Проверка: «Войти как Редактор» открывает полку, меню показывает «Редактор»; в `web/dist/assets/*.js` нет «Войти как» и `mailpit`.
- [x] 3.5 Анимация ожидания (просьба владельца 2026-10-31): компонент `InkLoader` в дизайн-системе — линия, которая пишется чернилами и стирается, цвет из токенов, при `prefers-reduced-motion` без движения; на «Проверяем вход…», «Входим…» и других экранах ожидания (`MessageScreen`), на витрине. Проверка: в браузере анимация видна в светлой и тёмной теме; с `prefers-reduced-motion: reduce` линия неподвижна.

## 4. Документы и итоговая проверка

- [x] 4.1 README (модуль `auth`: почта, Mailpit, пользователи для разработки, прокси для прода; фронтенд: вход), `openspec/TODO.md` (снять «интерактивная проверка второго фактора»).
- [x] 4.2 Ручная проверка в Chrome на 1440 и 375 px, светлая и тёмная темы, по сценариям дельты `web/workspace`; страниц Authentik при входе нет; ошибок в консоли нет.
- [x] 4.3 `./scripts/validate.sh`, `./scripts/auth_check.sh`, `git diff --check`, `openspec validate sign-in-screens --strict` проходят. Результаты и ограничения (реальный SMTP не проверялся, Firefox, Safari) — в `tmp/VERIFY.md`.

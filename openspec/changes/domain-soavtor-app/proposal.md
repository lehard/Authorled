# Proposal

## Why

Владелец купил домен `soavtor.app` (2026-11-08), а сервис живёт на поддомене чужого для продукта сайта, `coauthor.glavai.ru`. Схема адресов уже согласована в `product-site`: сайт в корне, сервис на `app.`, вход на `auth.`. Переезжать нужно сейчас: пользователей пока нет, а потом каждый переезд выбивает всех из аккаунтов и ломает ссылки (`business-intents/domain-soavtor-app.md`).

## What Changes

- **Адреса сервера.** Обратный прокси отдаёт сервис на `app.soavtor.app`, а Authentik на `auth.soavtor.app`. Вместе с адресами меняются издатель токенов, адреса возврата после входа и выхода, домен cookie Authentik и бренд входа.
- **Переадресации:**
  - `coauthor.glavai.ru` → `https://app.soavtor.app` с тем же путём и параметрами (301);
  - `www.soavtor.app` → `https://soavtor.app` (301);
  - корень `soavtor.app` → `https://app.soavtor.app` (302), пока там не выложен сайт продукта.
- **BREAKING.** Блок `auth.coauthor.glavai.ru` удаляется. Токены старого издателя API отклоняет: все один раз входят заново, MCP-клиенты подключаются заново по новому адресу.
- **Blueprints при каждом деплое.** Сейчас Authentik применяет blueprints заново только при изменении их файлов. Поэтому смена адресов в env на сервере не попадает ни в адреса возврата OIDC, ни в бренд. На сервере это видно: blueprints применены 2026-11-06, а Authentik с тех пор перезапускался. После запуска контейнеров деплой применяет все blueprints из `auth/blueprints/`.
- **Письма** уходят с `noreply@soavtor.app`. Домен уже проверен в Resend.
- **Вне репозитория, при выпуске, с подтверждением владельца:**
  - 7 настроек в `/etc/authorled/authorled.env`;
  - 4 переменные окружения `production` в GitHub;
  - удаление старого бренда Authentik и старого домена в Resend после проверки.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `runtime`: в требовании «Обратный прокси» появляются переадресации со старого домена сервиса, с `www` и временная переадресация с корня домена продукта.
- `auth`: в требовании «Конфигурация из blueprints» blueprints применяются не только при запуске Authentik, но и при каждом деплое. Так изменение одних настроек env, без правки файлов, доходит до OIDC-провайдера и бренда.

## Scope

- `deploy/Caddyfile`: блоки `app.soavtor.app`, `auth.soavtor.app`, `soavtor.app`, `www.soavtor.app`, переадресация с `coauthor.glavai.ru`; блок `auth.coauthor.glavai.ru` удалить.
- `deploy/deploy.sh`: применить blueprints после `up -d --build`.
- Дельты спек `runtime` и `auth`.
- Выпуск: переменные GitHub и env сервера, релиз, проверка на сервере, запись в `tmp/VERIFY.md`.

## Non-goals

- Сайт в корне домена, его блок Caddy с маршрутом заявок `/os/api/v1/beta-requests` и Яндекс Метрика — при выкладке сайта (`product-site`). Здесь корень только переадресует на сервис.
- Перенос сервера и почты в РФ — отдельно, до открытого запуска.
- Удаление DNS-записей `coauthor` в зоне `glavai.ru`: они нужны переадресации.
- Перенос данных: база, файлы и аккаунты остаются как есть.
- Код ядра, агентов и фронтенда: адреса приходят из настроек сборки и env.

## Impact

- Файлы: `deploy/Caddyfile`, `deploy/deploy.sh`, спеки `openspec/specs/runtime`, `openspec/specs/auth`.
- Сервер: env Authentik и API, сертификаты Caddy для новых адресов, бренд Authentik для `auth.soavtor.app`, адреса возврата OIDC-провайдера `authorled-web`.
- GitHub: `PUBLIC_URL`, `AUTH_ISSUER`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI` в окружении `production`; от них зависят сборка фронтенда и проверка после деплоя.
- Пользователи и клиенты: повторный вход один раз; MCP-коннекторы подключаются заново.
- DNS уже готов: `@`, `www`, `app`, `auth` и записи Resend внесены 2026-11-08.

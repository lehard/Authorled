# Proposal

## Why

С релиза `v0.3.21` у приложения и сайта есть `manifest.webmanifest` (спека `web/brand`). Caddy не знает расширение `.webmanifest`. Сейчас `https://app.soavtor.app/manifest.webmanifest` отвечает `content-type: text/plain; charset=utf-8`, а `https://soavtor.app/manifest.webmanifest` приходит вообще без `content-type`. Спецификация Web App Manifest ожидает `application/manifest+json`. Chrome такой файл читает, но другие браузеры и проверки (Lighthouse, валидаторы PWA) могут его отвергнуть, а без типа браузер угадывает формат по содержимому (`business-intents/caddy-manifest-type.md`).

## What Changes

- `deploy/Caddyfile`: для путей `*.webmanifest` ставит заголовок `Content-Type: application/manifest+json` в статических блоках `app.soavtor.app` и `soavtor.app`, в том числе для ответа, сжатого `gzip`. Другие файлы и маршруты не меняются.
- Новый `deploy/check_manifest.sh <origin>...` проверяет, что `/manifest.webmanifest` каждого адреса отвечает `200` с типом `application/manifest+json`, без сжатия и со сжатием `gzip`. Если тип другой, нет заголовка или пришёл другой код, скрипт завершается ошибкой с адресом и полученным значением.
- `.github/workflows/deploy.yml`: новый шаг после проверки сайта запускает `check_manifest.sh` для `PUBLIC_URL` и `SITE_ORIGIN`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `runtime`: новое требование «Тип манифеста страниц». Обратный прокси отдаёт манифест приложения и сайта с типом `application/manifest+json`, а деплой это проверяет. Существующие требования «Обратный прокси» и «Проверка после деплоя» не переписываются: новое требование добавляется рядом.

## Scope

- `deploy/Caddyfile`: заголовок типа для `.webmanifest` в двух статических блоках `handle`.
- `deploy/check_manifest.sh`: новый скрипт проверки.
- `.github/workflows/deploy.yml`: шаг «Check the manifest type».
- README («Deploy by release»): перечень проверок после выкладки дополняется типом манифеста.
- Мастер-спека `runtime`.

## Non-goals

- Другие типы файлов, заголовки кэширования значков и заголовки безопасности.
- Изменение `/etc/caddy/Caddyfile` или любые ручные правки на сервере.
- Автоматический откат при неверном типе: как и у других проверок, выкладка только краснеет.

## Impact

- Сервер: новая конфигурация Caddy приходит релизом. `deploy/deploy.sh` уже выполняет `caddy validate` и `systemctl reload caddy`.
- CI выкладки: шаг на пару запросов `curl`.
- Приложение, сайт, API и данные не меняются.

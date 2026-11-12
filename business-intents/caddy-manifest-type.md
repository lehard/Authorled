# Бизнес-интент: обратный прокси отдаёт манифест с типом application/manifest+json

Статус: владелец попросил интент 2026-11-12 после проверки релиза `v0.3.21` (change `brand-icons`, `openspec/changes/archive/2026-11-12-brand-icons/verification.md`); по нему владелец запустил `/opsx:propose` 2026-11-12: change `caddy-manifest-type` реализован, проверен и архивирован 2026-11-12 (`openspec/changes/archive/2026-11-12-caddy-manifest-type/`); причина — `/usr/share/mime/globs2` сервера без `.webmanifest`, проверка — отдельный `deploy/check_manifest.sh` для обоих доменов (design D2). Владелец: lehard. Обновлено: 2026-11-12.
Рамки: мастер-спеки `runtime` («Обратный прокси») и `web/brand` («Значки страницы приложения», «Значки страницы сайта»); `deploy/Caddyfile`, `deploy/check_site.sh`.

## Why

С релиза `v0.3.21` у приложения и сайта есть `manifest.webmanifest`. Caddy не знает расширение `.webmanifest`: на `app.soavtor.app` файл приходит с `Content-Type: text/plain; charset=utf-8`, на `soavtor.app` — вообще без типа. Спецификация манифеста ожидает `application/manifest+json`. Chrome на Android читает манифест и так, поэтому значок на домашнем экране сейчас работает, но это держится на снисходительности браузера. Другие браузеры и проверки (Lighthouse, валидаторы PWA) могут отвергнуть манифест или пожаловаться на него. Без типа браузер ещё и угадывает его по содержимому.

## What Changes

1. **Тип в Caddy.** Для путей, оканчивающихся на `.webmanifest`, `deploy/Caddyfile` ставит заголовок `Content-Type: application/manifest+json` на обоих статических сайтах: `app.soavtor.app` (фронтенд) и `soavtor.app` (сайт продукта). Это `header` для матчера по пути внутри блоков `handle` со статикой. Остальные файлы и маршруты не меняются.
2. **Проверка после выкладки.** `deploy/check_site.sh` проверяет, что `https://soavtor.app/manifest.webmanifest` отвечает `200` с типом `application/manifest+json`. Та же проверка добавляется для `https://app.soavtor.app/manifest.webmanifest` в общий шаг проверки выкладки: в `check_site.sh` или рядом с проверкой `/os/health` в `.github/workflows/deploy.yml`, где удобнее. Неверный тип валит выкладку с именем адреса.
3. **Спека.** В `runtime`, «Обратный прокси»: манифест на обоих доменах отдаётся с типом `application/manifest+json`, со сценарием проверки после релиза.

## Scope

- `deploy/Caddyfile`: заголовок типа для `.webmanifest` на двух доменах.
- `deploy/check_site.sh` (и при необходимости шаг проверки в `.github/workflows/deploy.yml`): проверка типа.
- Мастер-спека `runtime`: требование и сценарий.
- Проверка: `caddy validate` на конфигурации (`caddy adapt` локально в Docker-образе Caddy или на сервере только на чтение) и следующий релиз.

## Non-goals

- Другие типы файлов и заголовки кэширования значков.
- Заголовки безопасности, сжатие и прочая настройка Caddy.
- Правка `/etc/caddy/Caddyfile` на сервере: он только импортирует файл из репозитория.

## Constraints

- Caddy на сервере правится только через `deploy/Caddyfile` и релиз; вручную на сервере ничего не меняется.
- Проверка без подмен: неверный или отсутствующий тип — ошибка с адресом, а не предупреждение.

## Acceptance criteria

- После релиза `curl -sI https://app.soavtor.app/manifest.webmanifest` и `curl -sI https://soavtor.app/manifest.webmanifest` показывают `content-type: application/manifest+json`.
- Выкладка падает, если тип манифеста на каком-то из доменов другой.
- Остальные проверки выкладки (`/os/health`, сайт, админка) проходят как раньше.

## Risks

- `encode gzip` и `header` в одном блоке: тип должен остаться и у сжатого ответа. Это проверяется `curl` с `Accept-Encoding: gzip`.

## Open Questions

- Нет.

## References

- `openspec/changes/archive/2026-11-12-brand-icons/verification.md` (замечание о типе); `deploy/Caddyfile`; спека `web/brand`; спецификация Web App Manifest (тип `application/manifest+json`).

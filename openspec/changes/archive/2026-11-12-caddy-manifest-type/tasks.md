# Tasks

## 1. Проверка

- [x] 1.1 Написать `deploy/check_manifest.sh <origin>...` по D2: два запроса на адрес (без сжатия и с `Accept-Encoding: gzip`), код `200` и тип ровно `application/manifest+json` (без параметров, без учёта регистра), `::error::` с адресом, кодом и полученным типом, выход 1 при любой неудаче; без аргументов — подсказка и выход 2.
- [x] 1.2 Добавить в `.github/workflows/deploy.yml` шаг «Check the manifest type» после «Check the site»: `deploy/check_manifest.sh "$PUBLIC_URL" "$SITE_ORIGIN"`.

## 2. Caddy

- [x] 2.1 Добавить в статические `handle` блоков `app.soavtor.app` и `soavtor.app` матчер `@manifest path *.webmanifest` и `header @manifest >Content-Type application/manifest+json` с комментарием-ссылкой на спеку `runtime` («Тип манифеста страниц»).
- [x] 2.2 `caddy validate` боевого `deploy/Caddyfile` в `caddy:2.11.9` с временным пустым PEM по пути УЦ админки (D3.1).
- [x] 2.3 Тестовая конфигурация на `127.0.0.1:8080` в `caddy:2.11.9` с тем же блоком и манифестами из `web/public/` и `site/public/` (D3.2): `check_manifest.sh` проходит; без строк из 2.1 тот же скрипт падает с адресом и типом.

## 3. Документы

- [x] 3.1 README, «Deploy by release»: добавить в перечень проверок после выкладки тип манифеста на обоих доменах.

## 4. Проверка

- [x] 4.1 `./scripts/validate.sh` (через `env -u BASH_ENV`) и `git diff --check` проходят; результаты 2.2–2.3 записаны в `tmp/VERIFY.md`.

## Workflow follow-up

- Verify, archive (синхронизация спеки `runtime`), merge `origin/main`, проверки, PR в `main` и merge — по шагу 4 правил проекта.
- После релиза: запуск выкладки с зелёным шагом «Check the manifest type» и запись проверки сервера отдельным маленьким PR.

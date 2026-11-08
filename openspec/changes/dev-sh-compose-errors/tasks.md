# Tasks

Все проверки — на копии `scripts/dev.sh`, `compose.yaml`, `agno/compose.yaml` и `auth/compose.yaml` во временном каталоге (scratchpad сессии), с собственным `.env` без секретов в выводе. Работающий стенд `authorled` не перезапускается и не пересоздаётся, `auth-users` и `seed` на нём не запускаются.

## 1. Проверка запущенного сервиса

- [ ] 1.1 Добавить в `scripts/dev.sh` функцию `require_running <сервис> <команда>` (design, решение 1) и заменить ею проверку `mailpit` в `auth-users` и цикл по `agentos-db` и `authentik-worker` в `seed`; проверить на копии: `.env` без `CLOUDRU_API_KEY` — `auth-users` и `seed` выходят с кодом `1`, после ошибки compose печатают сообщение о сбое `docker compose` и не печатают «is not running»; полный `.env` в каталоге без запущенного стенда — сообщение «mailpit is not running in Compose project <имя каталога> (<путь>)», код `1`

## 2. Пользователи разработки в seed

- [ ] 2.1 Переписать чтение пользователей в `seed` без `|| true` (design, решение 2): `filter` по `writer` и `editor`, строки `DEMO_MISSING` и `DEMO_USERS`, сохранение вывода `exec` в переменную с `|| fail`, явная ошибка при отсутствии строк результата; формат входа `python -m demo` не меняется; проверить на копии с заглушкой `docker` в `PATH` (отвечает на `compose ps` и `compose config`, на `compose exec` печатает заданный вывод или падает): сбой `exec` — код `1` с сообщением про чтение пользователей Authentik и без `auth-users`; `DEMO_MISSING editor` — сообщение про `./scripts/dev.sh auth-users` с именем `editor`; оба пользователя есть — до `uv run` доходит прежний JSON-список (заглушкой `uv` в `PATH`, печатающей stdin)

## 3. Документы и проверки

- [ ] 3.1 Перенести дельту в мастер-спеку `runtime`; проверить `openspec validate dev-sh-compose-errors --strict`
- [ ] 3.2 Пройти `bash -n scripts/dev.sh`, `./scripts/validate.sh` в `agno/.venv` (запуск с `env -u BASH_ENV`) и `git diff --check`; записать в `tmp/VERIFY.md` прогоны 1.1 и 2.1 как детерминированные на копии файлов, а `auth-users` и `seed` на работающем стенде — как не проверенные (их запускает владелец)

## Workflow follow-up

- Владелец запускает `./scripts/dev.sh auth-users` и `./scripts/dev.sh seed` из основной рабочей копии на работающем стенде и убеждается, что поведение прежнее.
- `/opsx:verify` и `/opsx:archive` запускает владелец.

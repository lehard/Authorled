# Проверки worktree-dev-sh (2026-11-10)

## Статические

- `bash -n scripts/dev.sh`: без ошибок.
- `./scripts/validate.sh` в `agno/.venv` (`env -u BASH_ENV`): прошёл (ruff, mypy, границы модулей, одна голова миграций, сборка `web/` и `site/`, токены).
- `git diff --check`: без замечаний.
- `openspec validate worktree-dev-sh --strict`: valid.

## Детерминированные, на копии

Временный git-репозиторий в scratchpad: основная папка и worktree `Focused-Pare.a6fd10` и `xxx…` (60 символов); заглушки `docker`, `uv`, `lsof` в `PATH` пишут вызовы в журнал; запуск через `env -u BASH_ENV` и `DOCKER_HOST=unix:///nonexistent/docker.sock`.

- `.env` в worktree — обычный файл, ссылка на другой файл: код 1 с `ln -sf <основная папка>/.env .env`, журнал `docker` пуст; ссылка на отсутствующий основной `.env`: код 1 с его путём; без `.env` в основной папке: прежнее сообщение. Каталог вне git: код 1 «git rev-parse failed».
- `up`, `db`, `stop`, `reset-db --yes` в worktree: код 1 с путём основной папки, журнал пуст. В основной папке: `docker compose -p authorled up -d --wait agentos-db litellm clamav authentik-server authentik-worker mailpit` (без `agentos-api`), `up -d --wait agentos-db`, `stop …`, `config` для `reset-db`.
- Стенд не запущен / `clamav` не `healthy` / сбой `compose ps`: код 1, сообщения «… is not running in Compose project authorled … ./scripts/dev.sh up», «… is not healthy (starting)», «docker compose failed …»; ни `up`, ни `stop`, ни `run` без `--no-deps`.
- Имена баз: `Focused-Pare.a6fd10` → `ai_test_focused_pare_a6fd10`, `ai_dev_focused_pare_a6fd10`; длинное имя: код 1 с именем базы до вызова `docker` (`test`, `migrate`).
- `test`: `DROP … WITH (FORCE)` и `CREATE DATABASE` через `%I`, `run --rm --no-deps -e PGDATABASE=… agentos-db-init`, `alembic` ядра и биллинга, `pytest` с `DB_DATABASE` базы рабочей копии; основная папка — `ai_test`. `migrate` и `api`: только `CREATE DATABASE … WHERE NOT EXISTS`, без `DROP`; вызовов `agentos-migrate` нет.
- `api`: запущен `agentos-api` — код 1 с `docker compose stop agentos-api` в основной папке; `lsof` с PID 1 — код 1 «1 (/sbin/launchd)»; порт свободен — подготовка базы, `run --rm --no-deps authentik-jwks-export`, `uvicorn` с базой рабочей копии.
- `seed`: базы нет — код 1 «run ./scripts/dev.sh migrate first», без `uv`; база есть — `python -m demo` с `DB_DATABASE=ai_dev_…`. `psql` в worktree — `-d ai_dev_…`. `auth-users`: `mailpit` не запущен — код 1 с проектом и `up`.
- `pytest` с `DB_DATABASE=ai`: `RuntimeError: Core tests run only on ai_test or ai_test_<worktree>, DB_DATABASE is 'ai': use ./scripts/dev.sh test`.

## На контейнерах стенда, из worktree

Снимок до и после каждого шага: время создания и запуска, состояние и `com.docker.compose.project.working_dir` контейнеров стенда, ревизии Alembic в `ai` (`0014_story_cover_colors`, `b0001_from_core` — чужая ревизия другой ветки, у этой ветки голова `0013`).

- `api` при работающем `agentos-api`: код 1 до миграций; `agentos-api` работает с прежним временем запуска; базы `ai_dev_…` не появилось.
- `test`: 754 passed в `ai_test_focused_pare_a6fd10`; снимок стенда без изменений.
- `migrate` дважды: `ai_dev_focused_pare_a6fd10` создана и мигрирована до `0013_writing_goals`; строка-метка между запусками сохранилась; ревизии `ai` прежние; снимок без изменений.
- Параллельно `test` из этого worktree и временного `wdsh-par`: оба 754 passed (`ai_test_focused_pare_a6fd10`, `ai_test_wdsh_par`); временный worktree и его база удалены; снимок без изменений.
- `up`, `db`, `stop`, `reset-db --yes` из worktree: код 1 с путём основной папки.

## Инцидент

Первый прогон на копии шёл без `env -u BASH_ENV`: `~/.bashrc` пересобрал `PATH`, и `dev.sh stop` из временной «основной папки» вызвал настоящий `docker compose -p authorled stop` — общий стенд остановился примерно на минуту. С согласия владельца те же контейнеры подняты `docker start` (без пересоздания); данные не тронуты. Дальше все прогоны на копии — с `env -u BASH_ENV` и недоступным `DOCKER_HOST`.

## Не проверено

- Команды из основной папки на настоящем стенде (`up`, `api` с остановленным `agentos-api`, `test` в `ai_test`, `seed`, `auth-users`): их запускает владелец после слияния.
- `auth-users` и `seed` на стенде из worktree не запускались (меняют Authentik и данные).
- Ошибка «tuple concurrently updated» при одновременном `agentos-db-init` не воспроизвелась в параллельном прогоне; риск остаётся, как в design.md.

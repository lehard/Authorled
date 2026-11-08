# Proposal: `validate.sh` проверяет окружение Python до запуска проверок

Бизнес-интент: `business-intents/validate-environment.md` (согласован владельцем 2026-11-08).

## Why

Без активированного `agno/.venv` `./scripts/validate.sh` только предупреждает и идёт дальше. Python-инструменты он берёт из `PATH`, что найдётся. На Mac владельца `ruff` и `alembic` молча берутся из глобального Python 3.13, то есть не тех версий, что закреплены в проекте. `mypy` и `python` не находятся, и шаги падают посреди прогона. Получается смесь настоящих и случайных результатов, а это скрытая подмена, которую запрещают правила проекта. Кроме того, `check_auth_boundary.sh` находит blueprint'ы Authentik в локальных рабочих копиях других сессий (`.claude/worktrees/`) и роняет прогон даже с активированным venv.

## What Changes

- `scripts/validate.sh` до первой проверки убеждается в трёх вещах:
  - `python` находится;
  - `ruff`, `mypy` и `alembic` лежат в том же каталоге, что и он;
  - `python` импортирует зависимости проекта.

  Иначе скрипт сразу завершается кодом `1` и называет, что не так: какой команды нет или из какого каталога она взята. Он подсказывает `source agno/.venv/bin/activate`, а если venv ещё нет — `./agno/scripts/venv_setup.sh`. Предупреждение про `VIRTUAL_ENV` убирается.
- `scripts/check_auth_boundary.sh` не ищет конфигурацию и сервисы Authentik в `.claude/`. Это локальные файлы агентов разработки: в git из них лежат только команды, настройки и ссылка на навыки.

## Capabilities

### New Capabilities
- нет.

### Modified Capabilities
- `runtime`: «Проверки кода» — проверка окружения Python до проверок и исключение `.claude/` из проверки границы модуля `auth`.

## Scope

- `scripts/validate.sh`: проверка окружения в начале, без предупреждения про `VIRTUAL_ENV`.
- `scripts/check_auth_boundary.sh`: `--exclude-dir='.claude'` в поиске blueprint'ов и сервисов Authentik.
- Мастер-спека `runtime`, `tmp/VERIFY.md`.

## Non-goals

- Подставлять `agno/.venv` автоматически, если он есть («если есть venv, то он, иначе системный» — запрещённый путь).
- Запускать проверки через `uv run` с отдельным окружением.
- Менять CI (`.github/workflows/validate.yml`), `format.sh`, `dev.sh`, `venv_setup.sh`.
- Чистить `.claude/worktrees/`.
- Менять правило границы модуля `auth` для файлов репозитория (спека `auth`).

## Impact

- Локально: без окружения проекта `validate.sh` падает сразу и понятно, а не посреди прогона. С `.claude/worktrees` на диске проверка границы `auth` проходит.
- CI: зависимости стоят в системном Python `actions/setup-python`, где `python`, `ruff`, `mypy` и `alembic` лежат в одном `bin`, поэтому поведение не меняется.
- Зависимостей не добавляется.

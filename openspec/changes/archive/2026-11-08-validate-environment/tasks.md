# Tasks

## 1. Проверка окружения

- [x] 1.1 Добавить в начало `scripts/validate.sh` проверку окружения (`python` находится; `ruff`, `mypy`, `alembic` в том же каталоге по `realpath` каталога; `python -c 'import agno, alembic, mypy'`), с сообщением о причине и подсказкой `source agno/.venv/bin/activate` / `./agno/scripts/venv_setup.sh` и `exit 1`; убрать предупреждение про `VIRTUAL_ENV`; проверить: без venv на Mac — код `1` до первой проверки с названием недостающей команды; с `agno/.venv` — проверка проходит; `PATH` с `ruff` из другого каталога раньше venv — код `1` с этим каталогом

## 2. Граница модуля auth

- [x] 2.1 Добавить `--exclude-dir='.claude'` в оба поиска `scripts/check_auth_boundary.sh` (blueprint'ы и сервисы Authentik); проверить: с `.claude/worktrees/*/auth/` на диске проверка проходит, а временный blueprint в `scripts/` вне `auth/` её роняет (затем удалить)

## 3. Документы и проверки

- [x] 3.1 Перенести дельту в мастер-спеку `runtime`; если в README или AGENTS.md описан запуск `validate.sh`, указать, что без окружения проекта он сразу отказывает
- [x] 3.2 Пройти `./scripts/validate.sh` в `agno/.venv` целиком и `git diff --check`; записать в `tmp/VERIFY.md` прогоны без venv, с venv и с чужим `ruff`, а CI — как не проверенный до прогона на ветке

## Workflow follow-up

- Прогнать `validate.yml` на ветке до слияния в `main`.
- `/opsx:verify` и `/opsx:archive` запускает владелец.

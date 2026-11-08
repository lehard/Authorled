## MODIFIED Requirements

### Requirement: Проверки кода
`scripts/validate.sh` MUST выполнять:
- для бэкенда: `ruff format --check`, `ruff check` и `mypy` по `agno/` с настройками `agno/pyproject.toml`;
- проверку границ модуля `auth` (`scripts/check_auth_boundary.sh`);
- проверку, что у миграций схемы `authorled` ровно одна голова (без подключения к базе);
- для фронтенда: `prettier --check`, ESLint, проверку типов, сборку, проверку контраста токенов и `web/scripts/check_web_tokens.sh` (сырые цвета вне файла токенов).

Скрипт MUST завершаться ненулевым кодом при любой ошибке. Если зависимости фронтенда не установлены (`web/node_modules` отсутствует), скрипт MUST завершиться ошибкой с подсказкой `npm ci --prefix web` и MUST NOT пропускать проверки фронтенда.

До первой проверки скрипт MUST убедиться, что Python-инструменты взяты из одного окружения проекта: команда `python` находится, `ruff`, `mypy` и `alembic` лежат в том же каталоге, что и она, и `python` импортирует зависимости проекта. Иначе скрипт MUST завершиться кодом `1`, MUST NOT запускать ни одной проверки и MUST назвать недостающую команду или каталог, из которого она взята, с подсказкой `source agno/.venv/bin/activate` (или `./agno/scripts/venv_setup.sh`, если venv нет). Требовать активный venv (`VIRTUAL_ENV`) скрипт MUST NOT: CI ставит зависимости в системный Python.

`scripts/check_auth_boundary.sh` MUST проверять файлы репозитория и MUST NOT искать конфигурацию и сервисы Authentik в `.claude/` (локальные файлы агентов разработки, в том числе их рабочие копии в `.claude/worktrees/`).

CI (`.github/workflows/validate.yml`, Python 3.14, Node.js из `web/.nvmrc`) MUST ставить зависимости бэкенда по `agno/requirements.txt` и `agno/pyproject.toml`, ставить зависимости фронтенда через `npm ci` и выполнять тот же скрипт.

`scripts/format.sh` MUST выполнять `ruff check --select I --fix` и `ruff format` по `agno/` и `prettier --write` для `web/`.

#### Scenario: Ошибка форматирования
- GIVEN файл в `agno/` не отформатирован
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST подсказать `./scripts/format.sh` и вернуть `1`

#### Scenario: Зависимости фронтенда не установлены
- GIVEN каталога `web/node_modules` нет
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST вывести подсказку `npm ci --prefix web` и вернуть `1`

#### Scenario: Две головы миграций
- GIVEN в истории миграций схемы `authorled` две головы
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST вернуть ненулевой код с сообщением, называющим головы

#### Scenario: Нет окружения проекта
- GIVEN venv не активирован, и команды `python` или `mypy` нет в `PATH`
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST вернуть `1` до первой проверки, назвать недостающую команду и подсказать `source agno/.venv/bin/activate`

#### Scenario: Инструмент из другого окружения
- GIVEN `python` из `agno/.venv`, а `ruff` находится в глобальном Python в другом каталоге
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST вернуть `1` до первой проверки и назвать каталог, из которого взят `ruff`

#### Scenario: Рабочие копии агентов
- GIVEN в `.claude/worktrees/<имя>/auth/blueprints/` лежат blueprints Authentik, а в файлах репозитория вне `auth/` их нет
- WHEN выполняется `./scripts/check_auth_boundary.sh`
- THEN проверка границы модуля `auth` MUST пройти

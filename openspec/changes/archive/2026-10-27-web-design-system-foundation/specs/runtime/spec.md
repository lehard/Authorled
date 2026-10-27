# Spec Delta

## MODIFIED Requirements

### Requirement: Проверки кода
`scripts/validate.sh` MUST выполнять `ruff format --check`, `ruff check` и `mypy` по корню репозитория, а для фронтенда — `prettier --check`, ESLint, проверку типов, сборку, проверку контраста токенов и `scripts/check_web_tokens.sh` (сырые цвета вне файла токенов). Скрипт MUST завершаться ненулевым кодом при любой ошибке. Если зависимости фронтенда не установлены (`web/node_modules` отсутствует), скрипт MUST завершиться ошибкой с подсказкой `npm ci --prefix web` и MUST NOT пропускать проверки фронтенда. CI (`.github/workflows/validate.yml`, Python 3.14, Node.js из `web/.nvmrc`) MUST устанавливать зависимости фронтенда через `npm ci` и выполнять тот же скрипт. `scripts/format.sh` MUST выполнять `ruff check --select I --fix`, `ruff format` и `prettier --write` для `web/`.

#### Scenario: Ошибка форматирования
- GIVEN файл не отформатирован
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST подсказать `./scripts/format.sh` и вернуть `1`

#### Scenario: Зависимости фронтенда не установлены
- GIVEN каталога `web/node_modules` нет
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST вывести подсказку `npm ci --prefix web` и вернуть `1`

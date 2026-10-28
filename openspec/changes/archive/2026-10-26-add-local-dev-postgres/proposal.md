# Proposal: локальный Postgres и скрипт запуска для разработки

## Why

Для разработки API запускают на хосте (`uvicorn --reload` без пересборки образа; так же требует Docker-sandbox, `docs/sandboxes.md`). Сейчас это длинная ручная команда из нескольких шагов: поднять `agentos-db` и `litellm`, остановить контейнер `agentos-api`, задать `DB_*` и `LITELLM_URL`, запустить `uv run`. У `agentos-db` нет healthcheck, поэтому «контейнер стартовал» не значит «база принимает соединения». Нужен один воспроизводимый вход в локальную разработку.

## What Changes

- Контейнер PostgreSQL остаётся сервисом `agentos-db` из `compose.yaml` (`agnohq/pgvector:18`, том `pgdata`): второго определения БД не появляется. В него добавляется healthcheck `pg_isready`, чтобы `docker compose up --wait` ждал готовности базы.
- Новый `scripts/dev.sh` с командами:
  - `db` — поднять только `agentos-db` и дождаться готовности;
  - `api` — поднять `agentos-db` и `litellm`, остановить контейнер `agentos-api` и запустить API на хосте с `--reload` (то же, что команда из `docs/sandboxes.md`);
  - `stop` — остановить сервисы разработки, данные сохранить;
  - `reset-db` — удалить контейнер и том БД (только с `--yes`);
  - `psql` — открыть `psql` внутри контейнера.
- Скрипт при отсутствии `.env`, `docker` или `uv` завершается с явной ошибкой, без значений по умолчанию.
- Документация: `README.md` (раздел «Run locally») и `docs/sandboxes.md` ссылаются на `./scripts/dev.sh api` вместо ручной команды.

## Scope

- `compose.yaml` — только healthcheck `agentos-db`.
- Новый `scripts/dev.sh`.
- `README.md`, `docs/sandboxes.md`, `AGENTS.md` (раздел Local development) — описание скрипта.
- Дельта мастер-спеки `runtime`.
- Проверка на реальном Docker; запись в `tmp/VERIFY.md` (container).

## Non-goals

- Отдельный compose-файл или второй экземпляр Postgres; изменение образа, версии, порта, логина и пароля БД.
- Миграции (Alembic ещё не подключён), сид-данные, бэкапы и восстановление.
- Изменение `compose.prod.yaml`, production-деплоя, Dockerfile.
- Запуск без `.env`: compose интерполирует весь файл, поэтому обязательные ключи LiteLLM нужны и для одной БД (см. design).
- Смена пина Agno и зависимостей.

## Capabilities

### New Capabilities
<!-- нет -->

### Modified Capabilities
- `runtime`: у `agentos-db` появляется healthcheck; добавляется требование к скрипту локальной разработки.

## Impact

- `compose.yaml` (файл уже изменён в рабочем дереве незавершённым change `switch-models-to-deepseek-litellm`; правка здесь — один блок `healthcheck` у `agentos-db`, пересечения по строкам нет).
- Новый исполняемый `scripts/dev.sh`.
- Документация README, AGENTS.md, docs/sandboxes.md.
- Зависимостей, API и данных не меняет.

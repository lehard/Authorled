# Proposal

## Why

Сессии работают параллельно, каждая в своём worktree, и делят один локальный стенд из основной папки (проект Compose `authorled`). Сейчас `dev.sh` из worktree пересоздаёт общие контейнеры с путями ветки, `dev.sh test` у всех пересоздаёт одну `ai_test` и ломает чужие прогоны, `migrate` накатывает миграции ветки в общую `ai`, а скопированный `.env` отстаёт от основного. Порядок работы сессии согласуют вручную. Бизнес-интент: `business-intents/worktree-dev-sh.md`.

## What Changes

- **Стенд принадлежит основной папке.** Новая команда `./scripts/dev.sh up` запускает сервисы стенда для API на хосте (`agentos-db`, `litellm`, `clamav`, `authentik-server`, `authentik-worker`, `mailpit`; без `agentos-api`). `up`, `db`, `stop` и `reset-db` работают только из основной папки; из worktree они завершаются кодом 1 с путём основной папки.
- **BREAKING (для владельца на стенде):** `test`, `migrate`, `api`, `seed`, `psql`, `auth-users` больше не поднимают и не останавливают сервисы стенда, откуда бы их ни запустили. Они обращаются к проекту Compose `authorled` явно, требуют, чтобы нужные сервисы были `healthy`, и иначе завершаются кодом 1 с подсказкой `./scripts/dev.sh up` в основной папке. Разовые шаги (`agentos-db-init`, `authentik-jwks-export`) идут без подъёма зависимостей.
- **BREAKING:** `dev.sh api` больше не останавливает контейнер `agentos-api`: если порт 8000 занят, команда завершается кодом 1 и называет, кто его держит.
- **Базы worktree.** В worktree `test` работает в `ai_test_<worktree>` (пересоздаётся перед прогоном), а `migrate`, `api`, `seed` и `psql` — в `ai_dev_<worktree>`. `migrate` и `api` создают её, если её нет, готовят `agentos-db-init` и накатывают миграции ветки. Основная папка — как сейчас: `ai_test` и `ai`.
- `migrate` применяет миграции ядра и биллинга на хосте (`uv`, как `test`), а не контейнером `agentos-migrate`; сервис `agentos-migrate` остаётся для `docker compose up` и production.
- `agno/tests/conftest.py` пускает тесты только в `ai_test` или `ai_test_<…>`.
- **`.env` в worktree — ссылка на `.env` основной папки.** Иначе любая команда, кроме справки, завершается кодом 1 и печатает команду `ln -sf`.
- `name:` в `compose.yaml` не добавляется.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `runtime`: требование «Скрипт локальной разработки» — стенд основной папки, команда `up`, явный проект `authorled`, проверка `healthy` вместо подъёма, базы worktree, порт 8000, `.env` worktree, миграции на хосте; требование «Демо-контент» — база `ai` основной папки или `ai_dev_<worktree>`.
- `core/database`: требование «Тесты хранения на чистой базе» — тестовая база `ai_test` в основной папке и `ai_test_<worktree>` в worktree; параллельные прогоны из разных папок не мешают друг другу.

## Scope

- `scripts/dev.sh`, `agno/tests/conftest.py`.
- Спеки `runtime` и `core/database` (дельты этого change).
- Документы, где описаны эти команды: `AGENTS.md` / `CLAUDE.md` («Parallel sessions», «Local development»), `README.md`, `agno/docs/sandboxes.md`, `agno/evals/coauthor/README.md`, `openspec/context/04-engineering-standards.md`, строки-подсказки в `agno/demo/load.py`, `agno/tests/test_clamav.py`, `agno/tests/test_file_routes.py`, если они перестают быть верными.

## Non-goals

- Несколько API на хосте одновременно, другие порты и отдельный фронтенд для worktree.
- `name:` в `compose.yaml`, свой стенд или свой Postgres на worktree.
- Автоматическая уборка баз `ai_test_<…>` и `ai_dev_<…>`.
- Сверка `.env` с `example.env`.
- Уборка оставшихся контейнера `story-materials-test-db` и томов `*_pgdata` других стендов.
- Изменения `compose.yaml`, `compose.prod.yaml`, `agno/db/init.sql`, `python -m evals`.

## Impact

- `scripts/dev.sh`: определение основной папки и worktree через `git`, общий вызов compose с проектом `authorled`, новая команда `up`, проверки стенда, имя баз, проверка порта 8000 и `.env`.
- `agno/tests/conftest.py`: проверка имени тестовой базы.
- Владелец на стенде: перед `dev.sh api` запускает `./scripts/dev.sh up` и, если работает контейнер `agentos-api`, останавливает его сам.
- Новые зависимости не появляются; `migrate` теперь требует `uv`, как `test` и `api`; `api` требует `lsof`, чтобы назвать держателя порта.

# Design

## Context

- В `compose.yaml` уже есть `agentos-db` (`agnohq/pgvector:18`, `127.0.0.1:5432`, том `pgdata`, `ai/ai/ai`). Healthcheck нет; `agentos-api` ждёт её через `dockerize` (`WAIT_FOR_DB`), а не через `depends_on: service_healthy`.
- API на хосте запускается длинной командой из `docs/sandboxes.md`: `uv run --no-project --env-file .env --with-requirements requirements.txt uvicorn app.main:app …` с `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `LITELLM_URL=http://127.0.0.1:4000`. `db/url.py` требует все `DB_*` и падает без них, значений по умолчанию нет.
- `compose.yaml` содержит `${VAR:?…}` для ключей LiteLLM: Compose интерполирует весь файл, поэтому даже `docker compose up agentos-db` без заполненного `.env` падает.
- Инварианты: без fallback (`04-engineering-standards.md`, анти-паттерн 26); одна БД через `get_postgres_db()` (анти-паттерн 25); миграции не при старте (15).
- Стиль соседних скриптов (`scripts/mcp_check.sh`, `venv_setup.sh`): `set -euo pipefail`, `cd "$(dirname "$0")/.."`, `usage()`, коды 1/2.

См. proposal.md — мотивация.

## Goals / Non-Goals

**Goals:**
- Один скрипт заменяет ручную последовательность; повторный запуск идемпотентен.
- «Готово» означает, что БД принимает соединения, а не что контейнер создан.

**Non-Goals:**
- Дублировать определение Postgres, управлять жизненным циклом `agentos-api` в контейнере, миграциями и сидами.

## Decisions

1. **Postgres — сервис `agentos-db` из `compose.yaml`, второго файла нет.** Один том и одно имя контейнера исключают двойную БД и конфликт портов. Альтернатива — `compose.db.yaml` или `docker run`: дублирует образ, креды и том, расходится с основным стеком; отвергнуто.
2. **Healthcheck `pg_isready -U ai -d ai`** с интервалом 5 с, 12 повторов и `start_period` 10 с, и ожидание через `docker compose up -d --wait`. `--wait` падает по таймауту с ненулевым кодом — это и есть явный отказ. Альтернатива — цикл `sleep` в скрипте: изобретает ожидание, которое Compose даёт сам. Контракт `depends_on` у `agentos-api` не меняется (`service_started`), чтобы не менять поведение полного стека.
3. **`.env` обязателен для всех команд.** Из-за интерполяции Compose (см. Context) подставлять фиктивные значения, чтобы поднять одну БД, — это маскировка недостающего ввода; скрипт вместо этого проверяет наличие `.env` и оставляет остальное сообщению Compose (`LITELLM_MASTER_KEY must be set in .env`). Для разработки API ключи всё равно нужны.
4. **`api` запускает приложение на хосте теми же средствами, что `docs/sandboxes.md`:** `uv run --no-project --env-file .env --with-requirements requirements.txt uvicorn …`. Переменные хоста (`RUNTIME_ENV=dev`, `DB_DRIVER=postgresql+psycopg`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_USER/DB_PASS/DB_DATABASE=ai`, `AGENTOS_URL`, `LITELLM_URL`) скрипт экспортирует константами, продублированными из `compose.yaml` и помеченными комментарием; это не default для отсутствующего ввода, а описание локального стенда. Экспортированные значения имеют приоритет над `.env` (проверено на `uv run --env-file`): так `DB_HOST`, `DB_PORT` и `LITELLM_URL` получают хостовые адреса вместо адресов контейнерной сети. Дополнительно задаются `AGNO_DEBUG=True` и `AGNO_TELEMETRY=false`, как у контейнера `agentos-api`. Альтернатива — читать значения из `docker compose config`: хрупко и сложнее для чтения.
5. **`api` останавливает контейнер `agentos-api`** (`docker compose stop agentos-api`), иначе порт 8000 занят; контейнер не удаляется. Ctrl-C останавливает только API; БД и LiteLLM остаются (`stop` гасит их).
6. **`reset-db` — `docker compose rm -sf agentos-db` и удаление тома `pgdata`** проекта Compose; без `--yes` — отказ. Имя тома берётся из `docker compose config` (поле `name` тома `pgdata` с учётом имени проекта Compose), а не из жёстко заданной строки; контейнер удаляется только после того, как имя получено. Если имя не удалось определить или том уже удалён, команда завершается ошибкой. Альтернатива — поиск по меткам Compose через `docker volume ls --filter`: требует знать имя проекта, которое всё равно приходится брать из `docker compose config`.
7. **`stop` — `docker compose stop agentos-api litellm agentos-db`**, не `down`: контейнеры и том сохраняются.
8. **Права:** `chmod +x`, shebang `#!/usr/bin/env bash`, как у соседних скриптов; секреты не печатаются, `.env` не логируется.

## Risks / Trade-offs

- [Правка `compose.yaml` пересекается по файлу с незавершённым `switch-models-to-deepseek-litellm`] → меняется один блок `healthcheck` в `agentos-db`; при применении проверить `git diff`, не затрагивать чужие строки.
- [Константы `DB_*` в скрипте расходятся с `compose.yaml`] → комментарий-связка в обоих местах и проверка в `tmp/VERIFY.md`: запуск `api` подключается к базе.
- [Порт 5432 занят локальным Postgres хоста] → `compose up` падает, скрипт показывает ошибку Compose; порт не меняем (он задан контрактом runtime).
- [`.env` обязателен даже для одной БД] → принято сознательно (решение 3); облегчение требовало бы отдельного compose-файла, а это дублирование.
- [`docs/sandboxes.md` и скрипт описывают одну и ту же команду] → в docs остаётся ссылка на скрипт и пояснение, что делает `api`, чтобы не разойтись.

## Open Questions

- Нужна ли команда `logs` / `status`? Для первой версии нет: `docker compose logs -f agentos-db` и `docker compose ps` достаточно; добавить, если попросят.

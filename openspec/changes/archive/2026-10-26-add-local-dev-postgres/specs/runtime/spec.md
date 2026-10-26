# Spec Delta

## MODIFIED Requirements

### Requirement: Контейнеры разработки
`compose.yaml` MUST поднимать `agentos-db` (`agnohq/pgvector:18`, порт `127.0.0.1:5432`, том `pgdata`) и `agentos-api` (цель `agentos`, порт `127.0.0.1:8000`, bind-mount `.:/app`, `uvicorn --reload` по каталогам `agents`, `app`, `db`, `evals`). Для `agentos-db` MUST быть задан healthcheck `pg_isready` для пользователя и базы `ai`; он MUST считать контейнер здоровым только когда база принимает соединения. Для `agentos-api` MUST задаваться `RUNTIME_ENV=dev`, `AGNO_DEBUG=True`, `WAIT_FOR_DB=True`, `AGENTOS_URL=http://127.0.0.1:8000`, `DB_HOST=agentos-db`; `.env` MUST подключаться необязательно (`required: false`).

#### Scenario: Ожидание БД
- GIVEN `WAIT_FOR_DB` равен `true` или `True`
- WHEN стартует `scripts/entrypoint.sh`
- THEN он MUST ждать `tcp://DB_HOST:DB_PORT` через `dockerize` до 300 с, затем выполнить команду через `exec "$@"`

#### Scenario: Режим chill
- GIVEN контейнеру передан аргумент `chill`
- WHEN стартует entrypoint
- THEN контейнер MUST оставаться запущенным без приложения

#### Scenario: Готовность БД
- GIVEN `agentos-db` только что запущен
- WHEN PostgreSQL ещё инициализируется и не принимает соединения
- THEN статус контейнера MUST быть `starting` или `unhealthy`, а `healthy` — только после успешного `pg_isready`

## ADDED Requirements

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `stop`, `reset-db`, `psql`. Он MUST использовать сервисы `compose.yaml` (`agentos-db`, `litellm`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` до продолжения. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять.

#### Scenario: Только база
- GIVEN `.env` заполнен обязательным блоком
- WHEN выполняется `./scripts/dev.sh db`
- THEN MUST быть запущен только `agentos-db` и скрипт MUST вернуть 0 после статуса `healthy`
- AND порт `127.0.0.1:5432` MUST принимать соединения пользователя `ai` к базе `ai`

#### Scenario: API на хосте
- GIVEN `.env` заполнен и `uv` установлен
- WHEN выполняется `./scripts/dev.sh api`
- THEN MUST быть запущены `agentos-db` и `litellm` и дождаться `healthy`
- AND контейнер `agentos-api` MUST быть остановлен, чтобы освободить порт 8000
- AND API MUST запускаться на `127.0.0.1:8000` с `--reload` по каталогам `agents`, `app`, `db`, `evals`, с `RUNTIME_ENV=dev`, `DB_HOST=127.0.0.1`, `DB_PORT=5432` и `LITELLM_URL=http://127.0.0.1:4000`

#### Scenario: Нет .env
- GIVEN файла `.env` нет
- WHEN выполняется любая команда, кроме справки
- THEN скрипт MUST завершиться кодом 1 с сообщением о `.env` и MUST NOT запускать контейнеры

#### Scenario: Остановка сохраняет данные
- GIVEN в базе есть данные
- WHEN выполняется `./scripts/dev.sh stop`, затем `./scripts/dev.sh db`
- THEN те же данные MUST быть доступны (том `pgdata` не удалён)

#### Scenario: Сброс базы требует подтверждения
- WHEN выполняется `./scripts/dev.sh reset-db` без `--yes`
- THEN скрипт MUST завершиться ненулевым кодом, не удалив контейнер и том
- AND `./scripts/dev.sh reset-db --yes` MUST удалить контейнер `agentos-db` и том `pgdata`, а следующий `db` MUST создать пустую базу

#### Scenario: Неизвестная команда
- WHEN выполняется `./scripts/dev.sh` без аргумента или с неизвестной командой
- THEN скрипт MUST напечатать справку и завершиться кодом 2

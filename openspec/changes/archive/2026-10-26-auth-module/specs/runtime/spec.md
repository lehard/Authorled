# Spec Delta

## MODIFIED Requirements

### Requirement: Контейнеры разработки
`compose.yaml` MUST поднимать `agentos-db` (`agnohq/pgvector:18`, порт `127.0.0.1:5432`, том `pgdata`), `agentos-api` (цель `agentos`, порт `127.0.0.1:8000`, bind-mount `.:/app`, `uvicorn --reload` по каталогам `agents`, `app`, `db`, `evals`) и сервисы модуля `auth`: `authentik-db-init`, `authentik-server`, `authentik-worker` и `authentik-jwks-export`. `authentik-db-init` MUST однократно и идемпотентно создавать роль Authentik и схему `authentik` в `agentos-db` до старта `authentik-server` и `authentik-worker`. `authentik-server` и `authentik-worker` MUST использовать образ Authentik с закреплённой версией, подключаться к `agentos-db` ролью Authentik с `AUTHENTIK_POSTGRESQL__DEFAULT_SCHEMA=authentik` и публиковать порты только на `127.0.0.1`. `authentik-jwks-export` MUST после статуса `healthy` сервера Authentik дождаться появления ключей подписи (ограниченное время) и записать их в `JWT_JWKS_FILE`, а `agentos-api` MUST стартовать только после его успешного завершения. `authentik-worker` MUST стартовать только после статуса `healthy` у `authentik-server`, который применяет миграции базы. Для `agentos-db` MUST быть задан healthcheck `pg_isready` для пользователя и базы `ai` по TCP (`127.0.0.1`); он MUST считать контейнер здоровым только когда база принимает сетевые соединения (на первом запуске PostgreSQL сначала отвечает только через сокет). Для `agentos-api` MUST задаваться `RUNTIME_ENV=dev`, `AGNO_DEBUG=True`, `WAIT_FOR_DB=True`, `AGENTOS_URL=http://127.0.0.1:8000`, `DB_HOST=agentos-db`, `JWT_JWKS_FILE`; `.env` MUST подключаться необязательно (`required: false`), но обязательные переменные Authentik (`AUTHENTIK_SECRET_KEY` и пароль роли БД Authentik) MUST быть заданы, иначе `docker compose up` MUST завершаться ошибкой, называющей переменную.

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

#### Scenario: Порядок запуска модуля auth
- GIVEN `.env` заполнен, `agentos-db` здорова
- WHEN выполняется `docker compose up -d --build`
- THEN `authentik-db-init` MUST завершиться успешно до старта `authentik-server` и `authentik-worker`
- AND `authentik-jwks-export` MUST завершиться успешно до старта `agentos-api`
- AND файл `JWT_JWKS_FILE` MUST содержать открытый ключ подписи Authentik

#### Scenario: Нет секретного ключа Authentik
- GIVEN `AUTHENTIK_SECRET_KEY` не задан
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей `AUTHENTIK_SECRET_KEY`

### Requirement: Production-override
`compose.prod.yaml` MUST переключать `RUNTIME_ENV=prd`, `AGNO_DEBUG=False`, убирать bind-mount и reload, брать `AGENTOS_URL` и `MCP_CONNECT_SECRET` из `.env` и привязывать PostgreSQL к `127.0.0.1:5432`. Для сервисов Authentik `compose.prod.yaml` MUST требовать секреты из `.env` (без значений по умолчанию), привязывать порты к `127.0.0.1` и MUST NOT публиковать их на внешних интерфейсах. Том `/data` для AgentCore MUST оставаться закомментированным, пока AgentCore не включён.

#### Scenario: Запуск production
- GIVEN `.env` содержит секреты Authentik, а `authentik-jwks-export` выгрузил ключ проверки JWT
- WHEN выполняется `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`
- THEN `agentos-api` MUST работать с включённой авторизацией

#### Scenario: Порты Authentik в production
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `authentik-server`
- THEN они MUST быть привязаны к `127.0.0.1`

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `stop`, `reset-db`, `psql`. Он MUST использовать сервисы `compose.yaml` (`agentos-db`, `litellm` и сервисы модуля `auth`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` (для разовых сервисов — успешного завершения) до продолжения. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE`. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять.

#### Scenario: Только база
- GIVEN `.env` заполнен обязательным блоком
- WHEN выполняется `./scripts/dev.sh db`
- THEN MUST быть запущен только `agentos-db` и скрипт MUST вернуть 0 после статуса `healthy`
- AND порт `127.0.0.1:5432` MUST принимать соединения пользователя `ai` к базе `ai`

#### Scenario: API на хосте
- GIVEN `.env` заполнен и `uv` установлен
- WHEN выполняется `./scripts/dev.sh api`
- THEN MUST быть запущены `agentos-db`, `litellm`, `authentik-db-init`, `authentik-server` и `authentik-worker` и дождаться `healthy` или успешного завершения
- AND `authentik-jwks-export` MUST завершиться успешно до запуска API
- AND контейнер `agentos-api` MUST быть остановлен, чтобы освободить порт 8000
- AND API MUST запускаться на `127.0.0.1:8000` с `--reload` по каталогам `agents`, `app`, `db`, `evals`, с `RUNTIME_ENV=dev`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `LITELLM_URL=http://127.0.0.1:4000` и `JWT_JWKS_FILE`, указывающим на выгруженный файл

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
- AND `./scripts/dev.sh reset-db --yes` MUST удалить контейнер `agentos-db` и том `pgdata` (вместе с данными Authentik в схеме `authentik`), а следующий `db` MUST создать пустую базу

#### Scenario: Неизвестная команда
- WHEN выполняется `./scripts/dev.sh` без аргумента или с неизвестной командой
- THEN скрипт MUST напечатать справку и завершиться кодом 2

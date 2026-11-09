# Spec Delta

## MODIFIED Requirements

### Requirement: Контейнеры разработки
Корневой `compose.yaml` MUST объявлять `agentos-db` (`agnohq/pgvector:18`, порт `127.0.0.1:5432`, том `pgdata`) и подключать через `include` фрагменты модулей:
- `agno/compose.yaml` — `agentos-db-init`, `agentos-migrate`, `litellm`, `phoenix-db-init`, `phoenix`, `agentos-api`;
- `auth/compose.yaml` — `authentik-db-init`, `authentik-server`, `authentik-worker`, `authentik-jwks-export`.

`agentos-api`:
- цель образа `agentos`, порт `127.0.0.1:8000`;
- bind-mount корня репозитория в `/app`;
- `uvicorn --reload` по каталогам `agno/agents`, `agno/app`, `agno/db`, `agno/evals`.

Порядок и поведение сервисов модуля `auth`:
- `authentik-db-init` MUST однократно и идемпотентно создавать роль Authentik и схему `authentik` в `agentos-db` до старта `authentik-server` и `authentik-worker`;
- `authentik-server` и `authentik-worker` MUST использовать образ Authentik с закреплённой версией, подключаться к `agentos-db` ролью Authentik с `AUTHENTIK_POSTGRESQL__DEFAULT_SCHEMA=authentik` и публиковать порты только на `127.0.0.1`;
- `authentik-jwks-export` MUST после статуса `healthy` сервера Authentik дождаться появления ключей подписи (ограниченное время) и записать их в `JWT_JWKS_FILE`; `agentos-api` MUST стартовать только после его успешного завершения;
- `authentik-worker` MUST стартовать только после статуса `healthy` у `authentik-server`, который применяет миграции базы.

Порядок и поведение сервисов модуля бэкенда:
- `agentos-db-init` MUST идемпотентно готовить роль `agentos` и схемы `ai` и `authorled` до `agentos-migrate`;
- `agentos-migrate` MUST быть одноразовым сервисом на образе цели `agentos`: после успешного `agentos-db-init` он MUST применять миграции схемы `authorled` под ролью `agentos` и завершаться; `agentos-api` MUST стартовать только после его успешного завершения. В `compose.prod.yaml` порядок и поведение `agentos-migrate` MUST быть теми же.

Порядок и поведение журнала агентов (спека `agent-tracing`):
- `phoenix-db-init` MUST однократно и идемпотентно создавать роль Phoenix и схему `phoenix` в `agentos-db` до старта `phoenix`; пароль роли MUST браться из `.env` без значения по умолчанию;
- `phoenix` MUST использовать образ Phoenix с закреплённой версией, хранить данные в схеме `phoenix`, иметь healthcheck, лимит памяти, выключенную телеметрию и срок хранения трасс 30 дней, и публиковать порт только на `127.0.0.1`;
- `agentos-api` MUST стартовать только после статуса `healthy` у `phoenix` и MUST получать адрес Phoenix внутри сети контейнеров.

Для `agentos-db` MUST быть задан healthcheck `pg_isready` для пользователя и базы `ai` по TCP (`127.0.0.1`). Он MUST считать контейнер здоровым только когда база принимает сетевые соединения (на первом запуске PostgreSQL сначала отвечает только через сокет).

Для `agentos-api` MUST задаваться `RUNTIME_ENV=dev`, `AGNO_DEBUG=True`, `WAIT_FOR_DB=True`, `AGENTOS_URL=http://127.0.0.1:8000`, `DB_HOST=agentos-db`, `JWT_JWKS_FILE`. `.env` из корня репозитория MUST подключаться необязательно (`required: false`), но обязательные переменные Authentik (`AUTHENTIK_SECRET_KEY` и пароль роли БД Authentik) MUST быть заданы, иначе `docker compose up` MUST завершаться ошибкой, называющей переменную.

Имя compose-проекта (`authorled`), имена сервисов, контейнеров, сетей и томов MUST NOT зависеть от того, в каком фрагменте объявлен сервис.

#### Scenario: Ожидание БД
- GIVEN `WAIT_FOR_DB` равен `true` или `True`
- WHEN стартует `agno/scripts/entrypoint.sh`
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

#### Scenario: Конфигурация не изменилась после переноса
- GIVEN один и тот же `.env`
- WHEN сравниваются результаты `docker compose config` и `docker compose -f compose.yaml -f compose.prod.yaml config` до и после переноса в `agno/` и `auth/`
- THEN имя проекта, сервисы, образы, команды, порты, переменные окружения, тома, сети и зависимости MUST совпадать, кроме путей к файлам на хосте, контекста и файла сборки, каталогов reload и путей внутри `/app`

#### Scenario: Порядок запуска модуля бэкенда
- GIVEN `.env` заполнен, `agentos-db` здорова
- WHEN выполняется `docker compose up -d --build`
- THEN `agentos-db-init` MUST завершиться успешно до старта `agentos-migrate`
- AND `agentos-migrate` MUST завершиться успешно до старта `agentos-api`

#### Scenario: Миграция упала
- GIVEN миграция схемы `authorled` завершается ошибкой
- WHEN выполняется `docker compose up -d`
- THEN `agentos-migrate` MUST завершиться ненулевым кодом
- AND `agentos-api` MUST NOT стартовать

#### Scenario: Порядок запуска журнала
- GIVEN `.env` заполнен, `agentos-db` здорова
- WHEN выполняется `docker compose up -d --build`
- THEN `phoenix-db-init` MUST завершиться успешно до старта `phoenix`
- AND `agentos-api` MUST стартовать только после статуса `healthy` у `phoenix`

#### Scenario: Нет пароля роли Phoenix
- GIVEN в `.env` нет пароля роли Phoenix
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей переменную

### Requirement: Production-override
`compose.prod.yaml` MUST переключать `RUNTIME_ENV=prd`, `AGNO_DEBUG=False`, убирать bind-mount и reload, брать `AGENTOS_URL` и `MCP_CONNECT_SECRET` из `.env` и привязывать PostgreSQL к `127.0.0.1:5432`. Для сервисов Authentik `compose.prod.yaml` MUST требовать секреты из `.env` (без значений по умолчанию), включая `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`, передавать эту настройку в контейнеры, привязывать порты к `127.0.0.1` и MUST NOT публиковать их на внешних интерфейсах. Для `phoenix` `compose.prod.yaml` MUST привязывать порт к `127.0.0.1` и MUST NOT публиковать его на внешних интерфейсах; обратный прокси MUST NOT проксировать Phoenix. Том `/data` для AgentCore MUST оставаться закомментированным, пока AgentCore не включён.

#### Scenario: Запуск production
- GIVEN `.env` содержит секреты Authentik, а `authentik-jwks-export` выгрузил ключ проверки JWT
- WHEN выполняется `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`
- THEN `agentos-api` MUST работать с включённой авторизацией

#### Scenario: Порты Authentik в production
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `authentik-server`
- THEN они MUST быть привязаны к `127.0.0.1`

#### Scenario: Нет настройки доверенного прокси
- GIVEN в `.env` нет `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`
- WHEN выполняется `docker compose -f compose.yaml -f compose.prod.yaml config`
- THEN команда MUST завершиться ошибкой с именем этой настройки

#### Scenario: Порт Phoenix в production
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `phoenix`
- THEN они MUST быть привязаны к `127.0.0.1`

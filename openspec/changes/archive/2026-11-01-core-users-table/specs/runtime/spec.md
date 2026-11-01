## MODIFIED Requirements

### Requirement: Контейнеры разработки
Корневой `compose.yaml` MUST объявлять `agentos-db` (`agnohq/pgvector:18`, порт `127.0.0.1:5432`, том `pgdata`) и подключать через `include` фрагменты модулей:
- `agno/compose.yaml` — `agentos-db-init`, `agentos-migrate`, `litellm`, `agentos-api`;
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

### Requirement: Проверки кода
`scripts/validate.sh` MUST выполнять:
- для бэкенда: `ruff format --check`, `ruff check` и `mypy` по `agno/` с настройками `agno/pyproject.toml`;
- проверку границ модуля `auth` (`scripts/check_auth_boundary.sh`);
- проверку, что у миграций схемы `authorled` ровно одна голова (без подключения к базе);
- для фронтенда: `prettier --check`, ESLint, проверку типов, сборку, проверку контраста токенов и `web/scripts/check_web_tokens.sh` (сырые цвета вне файла токенов).

Скрипт MUST завершаться ненулевым кодом при любой ошибке. Если зависимости фронтенда не установлены (`web/node_modules` отсутствует), скрипт MUST завершиться ошибкой с подсказкой `npm ci --prefix web` и MUST NOT пропускать проверки фронтенда.

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

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql` и `auth-users` (спека `auth`, «Пользователи для разработки»). Команда `migrate` MUST запускать `agentos-db` и `agentos-db-init` и применять миграции сервисом `agentos-migrate`. Команда `test` MUST выполнять тесты хранения данных продукта на чистой базе `ai_test` (спека `core/database`, «Тесты хранения на чистой базе»). Он MUST использовать сервисы compose-файлов репозитория (`agentos-db`, `agentos-db-init`, `litellm` и сервисы модуля `auth`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` (для разовых сервисов — успешного завершения) до продолжения. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE`. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять.

#### Scenario: Только база
- GIVEN `.env` заполнен обязательным блоком
- WHEN выполняется `./scripts/dev.sh db`
- THEN MUST быть запущен только `agentos-db` и скрипт MUST вернуть 0 после статуса `healthy`
- AND порт `127.0.0.1:5432` MUST принимать соединения пользователя `ai` к базе `ai`

#### Scenario: API на хосте
- GIVEN `.env` заполнен и `uv` установлен
- WHEN выполняется `./scripts/dev.sh api`
- THEN MUST быть запущены `agentos-db`, `litellm`, `authentik-db-init`, `authentik-server` и `authentik-worker` и дождаться `healthy` или успешного завершения
- AND `agentos-db-init`, `agentos-migrate` и `authentik-jwks-export` MUST завершиться успешно до запуска API
- AND контейнер `agentos-api` MUST быть остановлен, чтобы освободить порт 8000
- AND API MUST запускаться из `agno/` на `127.0.0.1:8000` с `--reload` по каталогам `agents`, `app`, `db`, `evals` модуля бэкенда, с `RUNTIME_ENV=dev`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_USER=agentos`, `LITELLM_URL=http://127.0.0.1:4000`, зависимостями из `agno/requirements.txt`, `.env` из корня репозитория и `JWT_JWKS_FILE`, указывающим на `auth/jwks/jwks.json`

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

#### Scenario: Миграции из скрипта
- GIVEN `.env` заполнен
- WHEN выполняется `./scripts/dev.sh migrate`
- THEN `agentos-db` MUST быть `healthy`, `agentos-db-init` MUST завершиться успешно
- AND миграции схемы `authorled` MUST быть применены, а скрипт MUST вернуть код `agentos-migrate`

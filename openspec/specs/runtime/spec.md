# Runtime Specification

## Purpose
Окружение, контейнеры, скрипты разработки и evals текущего кода.

## Requirements

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

### Requirement: Production-override
`compose.prod.yaml` MUST переключать `RUNTIME_ENV=prd`, `AGNO_DEBUG=False`, убирать bind-mount и reload, брать `AGENTOS_URL` и `MCP_CONNECT_SECRET` из `.env` и привязывать PostgreSQL к `127.0.0.1:5432`. Для сервисов Authentik `compose.prod.yaml` MUST требовать секреты из `.env` (без значений по умолчанию), включая `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`, передавать эту настройку в контейнеры, привязывать порты к `127.0.0.1` и MUST NOT публиковать их на внешних интерфейсах. Том `/data` для AgentCore MUST оставаться закомментированным, пока AgentCore не включён.

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

### Requirement: Адреса привязки
`python -m app.main` MUST запускать `agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)`: локальный loopback — намеренно. Контейнер `agentos` MUST слушать `0.0.0.0:8000` (CMD образа); доступность снаружи ограничивает compose-публикация порта только на `127.0.0.1:8000`. Различие `127.0.0.1` / `0.0.0.0` задумано и MUST NOT считаться дефектом.

#### Scenario: Запуск через python -m app.main
- GIVEN API запущен командой `python -m app.main`
- WHEN клиент обращается с другой машины
- THEN соединение MUST быть невозможно, так как сервер слушает только `127.0.0.1`

### Requirement: Образы
`agno/Dockerfile` MUST собираться с контекстом — корнем репозитория. Он MUST собирать общую базу `agnohq/python:3.14` с `uv pip sync` по `agno/requirements.txt` и две цели:
- `agentos` (по умолчанию): весь контекст сборки в `/app`, рабочий каталог и `PYTHONPATH` — `/app/agno`, entrypoint `/app/agno/scripts/entrypoint.sh`, CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000`;
- `sandbox`: пользователь UID 1000, порт 8080, `python -I -m agno.sandbox.agentcore.server serve`.

`.dockerignore` в корне репозитория MUST исключать `.env*`, `.claude/`, `.codex/`, `tmp/`, `web/` и выгруженные ключи `auth/jwks/jwks.json*` и MUST оставлять `.agents/skills/`, `agno/skills/`, `AGENTS.md` и `openspec/`.

#### Scenario: Сборка sandbox
- WHEN выполняется `docker build --target sandbox --load -t agno-sandbox:local -f agno/Dockerfile .` из корня репозитория
- THEN MUST собираться образ, используемый `docker_sandbox()`

#### Scenario: Состав образа API
- GIVEN образ цели `agentos` собран
- WHEN перечисляется содержимое `/app`
- THEN MUST присутствовать `/app/AGENTS.md`, `/app/.agents/skills/`, `/app/openspec/`, `/app/agno/app/main.py` и `/app/agno/skills/coauthor/SKILL.md`
- AND `/app/web` и `/app/.env` MUST отсутствовать

### Requirement: Публикация образа
`agno/scripts/build_image.sh` MUST требовать `IMAGE_NAME` с namespace реестра и MUST собирать и пушить `linux/amd64,linux/arm64` цели `agentos` по `agno/Dockerfile` с контекстом — корнем репозитория.

#### Scenario: IMAGE_NAME без namespace
- GIVEN `IMAGE_NAME=agentos`
- WHEN запускается скрипт
- THEN он MUST завершиться кодом `1` до сборки

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

### Requirement: Окружение Python
`agno/scripts/venv_setup.sh` MUST создавать `agno/.venv` на Python 3.14 через `uv` и ставить `agno/requirements.txt` и проект `-e agno[dev]` с ограничениями `agno/requirements.txt`; при активном venv или без `uv` MUST завершаться кодом `1`. `agno/scripts/generate_requirements.sh` MUST компилировать `agno/requirements.txt` из `agno/pyproject.toml` через `uv pip compile` в режимах standard, `upgrade` и обновления отдельных пакетов.

#### Scenario: Активный venv
- GIVEN `VIRTUAL_ENV` задан
- WHEN выполняется `./agno/scripts/venv_setup.sh`
- THEN скрипт MUST завершиться с сообщением «Deactivate your current venv first.»

### Requirement: Evals
`python -m evals` MUST загружать `.env`, требовать `RUNTIME_ENV` со значением `dev` или `prd` (как API) без значения по умолчанию, собирать MCP-инструменты OS Manager и запускать `agno.eval.cli` с судьёй `default_model()` и таймаутом 180 с. Кейсы `evals/cases.py` с тегом `smoke`: `manager_explains_application` (`read_file`), `manager_checks_health` (`run_diagnostics`), `manager_explains_configured_learning` (`read_file`).

#### Scenario: Smoke-набор
- GIVEN PostgreSQL доступен и ключи моделей заданы
- WHEN выполняется `python -m evals --tag smoke`
- THEN MUST запуститься три кейса, а результаты MUST сохраниться в БД

#### Scenario: Нет RUNTIME_ENV
- GIVEN `RUNTIME_ENV` не задан ни в окружении, ни в `.env`
- WHEN выполняется `python -m evals --tag smoke`
- THEN команда MUST завершиться ошибкой, называющей `RUNTIME_ENV`, до запуска кейсов

### Requirement: Eval соавтора от имени пользователя разработки
Кейс `coauthor_uses_context` (тег `coauthor`) MUST запускать соавтора от имени `writer@authorled.test` с проверенным токеном локального Authentik, проверенным как в API (спека `auth`, «Полномочия запуска для доверенного кода»). Если аккаунта `writer` в ядре нет, кейс MUST создавать его как при первом входе. Лимит и журнал расхода MUST работать как в чате. Кейсы `smoke` MUST идти без пользователя и MUST NOT зависеть от Authentik и `AUTH_DEV_WRITER_TOKEN`.

#### Scenario: Соавтор доходит до модели
- GIVEN локальный стенд с Authentik, выполнен `./scripts/dev.sh auth-users`, `AUTH_DEV_WRITER_TOKEN` задан в `.env`, `RUNTIME_ENV=dev`
- WHEN на хосте выполняется `python -m evals --tag coauthor`
- THEN кейс `coauthor_uses_context` MUST получить ответ модели и оценку судьи
- AND в журнале расхода MUST появиться запись этого запуска у аккаунта `writer@authorled.test`

#### Scenario: Аккаунта в ядре нет
- GIVEN в Authentik есть `writer`, а в ядре его аккаунта нет
- WHEN выполняется `python -m evals --tag coauthor`
- THEN аккаунт MUST быть создан с почтой и именем из токена и подпиской тарифа новых аккаунтов, а кейс MUST выполниться

#### Scenario: Нет секрета
- GIVEN `AUTH_DEV_WRITER_TOKEN` не задан
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой, называющей `AUTH_DEV_WRITER_TOKEN`, без вызова модели, а команда MUST вернуть ненулевой код

#### Scenario: Authentik не выдал токен
- GIVEN Authentik недоступен по адресу из `AUTH_ISSUER` или отказал в токене (неверный пароль приложения)
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой, называющей адрес Authentik или его отказ, без вызова модели
- AND секрет и токен MUST NOT попадать в вывод

#### Scenario: Не локальный стенд
- GIVEN `RUNTIME_ENV` не равен `dev`
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться ошибкой без запроса токена и без вызова модели

#### Scenario: Лимит исчерпан
- GIVEN расход `writer` в текущем периоде достиг лимита тарифа
- WHEN выполняется `python -m evals --tag coauthor`
- THEN кейс MUST завершиться отказом с сообщением о лимите и датой обновления, а не «Не удалось проверить лимит соавтора»

#### Scenario: Smoke без Authentik
- GIVEN Authentik остановлен и `AUTH_DEV_WRITER_TOKEN` не задан
- WHEN выполняется `python -m evals --tag smoke`
- THEN три кейса MUST выполниться как раньше, без пользователя

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql`, `auth-users` (спека `auth`, «Пользователи для разработки») и `seed` («Демо-контент»). Команда `migrate` MUST запускать `agentos-db` и `agentos-db-init` и применять миграции сервисом `agentos-migrate`. Команда `test` MUST выполнять тесты хранения данных продукта на чистой базе `ai_test` (спека `core/database`, «Тесты хранения на чистой базе»). Он MUST использовать сервисы compose-файлов репозитория (`agentos-db`, `agentos-db-init`, `litellm` и сервисы модуля `auth`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` (для разовых сервисов — успешного завершения) до продолжения. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE`. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api` и `seed`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять. Если команда `docker compose`, которой `auth-users` и `seed` проверяют запущенные сервисы, сама завершается ошибкой (например, в `.env` нет переменной, которую требует compose-файл), скрипт MUST завершаться кодом 1 с сообщением о сбое `docker compose` и MUST NOT сообщать, что сервис не запущен. Сообщение о незапущенном сервисе MUST называть проект Compose и каталог, в которых искали сервис; выбирать другой проект Compose скрипт MUST NOT.

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

#### Scenario: Compose не может прочитать конфигурацию
- GIVEN в `.env` нет переменной, которую требует compose-файл (например, `CLOUDRU_API_KEY`)
- WHEN выполняется `./scripts/dev.sh auth-users` или `./scripts/dev.sh seed`
- THEN после ошибки `docker compose` скрипт MUST завершиться кодом 1 с сообщением о сбое `docker compose` и подсказкой исправить `.env`
- AND вывод MUST NOT содержать сообщения, что `mailpit`, `agentos-db` или `authentik-worker` не запущен
- AND скрипт MUST NOT менять пользователей Authentik и базу

#### Scenario: Сервис не запущен в проекте этого каталога
- GIVEN `.env` заполнен, а в проекте Compose каталога, из которого запущен скрипт, нет запущенного `mailpit` (например, стенд работает из другой рабочей копии)
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN скрипт MUST завершиться кодом 1 с сообщением, что `mailpit` не запущен, с названием проекта Compose и каталога
- AND скрипт MUST NOT обращаться к контейнерам другого проекта Compose

### Requirement: Демо-контент
Команда `./scripts/dev.sh seed` MUST загружать в локальную базу `ai` демо-истории «Тихая вода», «Последний паром» и «Без названия» пользователям `writer@authorled.test` и `editor@authorled.test`, каждому свою копию. Команда MUST создавать этих пользователей в ядре, если их там нет, с тем же идентификатором, что они получат при входе. Контент MUST проходить проверки ядра, как правки автора, а данные других пользователей MUST NOT меняться.

#### Scenario: Загрузка на пустую базу
- GIVEN база после миграций без историй, а пользователи разработки созданы командой `auth-users`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN у `writer@authorled.test` и `editor@authorled.test` MUST быть «Тихая вода» с двумя драфтами, «Последний паром» с шестью сценами, паспортом, персонажами, локациями и миром, а «Без названия» MUST лежать в корзине
- AND скрипт MUST вернуть 0

#### Scenario: Редактор до первого входа
- GIVEN редактор ещё ни разу не входил и команда `seed` выполнена
- WHEN он входит в приложение
- THEN полка MUST показывать его истории, а новая учётная запись MUST NOT создаваться

#### Scenario: Содержимое драфтов
- GIVEN команда `seed` выполнена
- WHEN автор открывает «Тихую воду»
- THEN полка MUST показывать у истории подпись «2 драфта»
- AND в «Драфт 1» MUST быть текст, паспорт, персонажи, локации, мир, два комментария редактора, ответ сценариста, два открытых предложения соавтора, точка драфта и персонаж в корзине
- AND во втором драфте MUST быть подпись «от Драфта 1», новая концовка, изменённая карточка Веры и своя точка и MUST NOT быть комментариев и предложений

#### Scenario: Чужие истории
- GIVEN у третьего пользователя есть история «Маяк», а у `writer@authorled.test` есть история «Белая дача»
- WHEN выполняется `./scripts/dev.sh seed`
- THEN обе истории MUST остаться без изменений

#### Scenario: Заметки демо-истории
- GIVEN команда `seed` выполнена
- WHEN автор открывает «Тихую воду» в любом драфте
- THEN в разделе «Заметки» MUST быть две заметки, а в «Корзине» MUST лежать ещё одна

### Requirement: Отказы загрузки демо-контента
Загрузка демо-контента MUST быть одной транзакцией: при отказе или сбое база MUST остаться без изменений. Команда `seed` MUST NOT удалять или заменять истории. Если стенд не готов к загрузке или демо-название занято, команда MUST завершаться ненулевым кодом с названием причины. Сбой обращения к Authentik при чтении пользователей разработки MUST сообщаться как сбой этого шага и MUST NOT сообщаться как отсутствие пользователей.

#### Scenario: Повторный запуск
- GIVEN у `writer@authorled.test` есть «Последний паром», в том числе в корзине
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием пользователя и истории
- AND истории обоих пользователей MUST остаться без изменений

#### Scenario: Стенд не запущен
- GIVEN не запущен `agentos-db` или Authentik
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием незапущенного сервиса, проекта Compose и каталога

#### Scenario: Нет пользователей разработки
- GIVEN Authentik запущен, а команда `auth-users` не выполнялась
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением про `./scripts/dev.sh auth-users` и MUST NOT менять базу

#### Scenario: Сбой чтения пользователей Authentik
- GIVEN `authentik-worker` числится запущенным, но команда в его контейнере завершается ошибкой
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением о сбое чтения пользователей Authentik
- AND сообщение MUST NOT предлагать `./scripts/dev.sh auth-users`, а база MUST остаться без изменений

#### Scenario: Схема отстала
- GIVEN в базе применены не все миграции схемы `authorled`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением про `./scripts/dev.sh migrate` и MUST NOT менять базу

#### Scenario: Не локальный стенд
- GIVEN `RUNTIME_ENV=prd`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом и MUST NOT обращаться к базе

### Requirement: Запуск демо-контента только по команде
Загрузка демо-контента MUST NOT запускаться сама при `migrate`, `api` или старте контейнеров. Вывод команды `seed` MUST NOT содержать секретов и текста историй.

#### Scenario: Старт стенда
- GIVEN база после миграций без историй
- WHEN выполняются `./scripts/dev.sh migrate` и `./scripts/dev.sh api`
- THEN демо-истории MUST NOT появиться

### Requirement: Общий контент с режимом примеров
Демо-контент MUST храниться в репозитории в одном файле. Источник `fixtures` (спека `web/workspace`, «Источник данных») MUST показывать то же содержимое демо-историй, что загружает команда `seed`, кроме точек драфта.

#### Scenario: Тот же контент в режиме примеров
- GIVEN `VITE_DATA_SOURCE=fixtures` и пользователь вошёл
- WHEN он открывает «Тихую воду» и «Последний паром»
- THEN у «Тихой воды» MUST быть два драфта, а текст «Последнего парома» MUST совпадать с загруженным командой `seed`

### Requirement: Антивирус ClamAV
Compose-файлы MUST объявлять сервис `clamav` (образ ClamAV с закреплённой версией, демон `clamd` по TCP; в разработке порт публикуется только на `127.0.0.1` для API на хосте, в production не публикуется; том для антивирусных баз, healthcheck готовности). `agentos-api` MUST стартовать после статуса `healthy` у `clamav` и MUST получать его адрес из обязательных `CLAMAV_HOST` и `CLAMAV_PORT`; без них старт API MUST завершаться ошибкой, называющей переменную. В production действует то же.

#### Scenario: Порядок запуска
- GIVEN `.env` заполнен
- WHEN выполняется `docker compose up -d --build`
- THEN `agentos-api` MUST стартовать только после статуса `healthy` у `clamav`

#### Scenario: Нет адреса антивируса
- GIVEN `CLAMAV_HOST` не задан
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей `CLAMAV_HOST`

#### Scenario: Порт не опубликован
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `clamav`
- THEN порт `clamd` MUST NOT быть опубликован на хосте

#### Scenario: API на хосте
- GIVEN `./scripts/dev.sh api` запускает API на хосте
- WHEN API принимает загрузку файла
- THEN `clamav` MUST быть запущен скриптом и доступен по `CLAMAV_HOST` и `CLAMAV_PORT`

### Requirement: Ответы API через обратный прокси
На сервере обратный прокси MUST передавать ответы API на `/os/` клиенту без сжатия и MUST NOT менять заголовок `ETag`, потому что в нём передаётся ревизия; это касается и маршрута заявки на домене продукта. Файлы фронтенда и сайта MUST оставаться сжатыми, если клиент это поддерживает.

#### Scenario: Большой ответ с ревизией
- GIVEN API отвечает на запрос через `/os/` телом больше 512 байт и заголовком `ETag` со значением `"2"`
- WHEN клиент присылает `Accept-Encoding: gzip`
- THEN ответ MUST прийти без `Content-Encoding`
- AND `ETag` MUST остаться `"2"`

#### Scenario: Создание истории на сервере
- GIVEN пользователь вошёл на сервере
- WHEN он создаёт историю
- THEN окно создания MUST закрыться без ошибки о ревизии
- AND MUST открыться экран новой истории

#### Scenario: Файлы фронтенда
- GIVEN деплой завершён
- WHEN клиент с `Accept-Encoding: gzip` запрашивает файл сборки фронтенда
- THEN ответ MUST прийти с `Content-Encoding: gzip`

#### Scenario: Файлы сайта
- GIVEN деплой завершён
- WHEN клиент с `Accept-Encoding: gzip` запрашивает `https://soavtor.app/`
- THEN ответ MUST прийти с `Content-Encoding: gzip`

### Requirement: Деплой по релизу
Публикация релиза GitHub MUST запускать деплой этого тега на сервер. Пуш в ветку без релиза MUST NOT менять сервер. Тег, коммит которого не входит в `main`, MUST останавливать деплой с ошибкой до любых изменений на сервере. Деплой MUST выкладывать фронтенд сервиса и сайт продукта, собранные из кода этого тега; сборка сайта MUST проходить его проверку сборки. Если файлов сайта этого тега на сервере нет, деплой MUST остановиться до смены кода и контейнеров.

#### Scenario: Публикация релиза
- GIVEN тег `v0.1.0` стоит на коммите из `main`
- WHEN владелец публикует релиз с этим тегом
- THEN на сервере MUST заработать код этого тега
- AND `soavtor.app` MUST отдавать сайт, собранный из этого тега

#### Scenario: Пуш без релиза
- GIVEN в `main` появился новый коммит
- WHEN релиз не опубликован
- THEN сервер MUST остаться на прежней версии

#### Scenario: Тег не из main
- GIVEN тег стоит на коммите, которого нет в `main`
- WHEN запускается деплой этого тега
- THEN запуск MUST завершиться ошибкой, и сервер MUST остаться без изменений

#### Scenario: Сайт не собрался
- GIVEN сборка или проверка сборки сайта тега завершилась ошибкой
- WHEN идёт запуск деплоя
- THEN шаги на сервере MUST NOT выполняться

#### Scenario: Нет файлов сайта на сервере
- GIVEN на сервере нет собранного сайта для выкладываемого тега
- WHEN выполняется шаг деплоя на сервере
- THEN деплой MUST завершиться ошибкой, называющей отсутствующие файлы, до копии базы и смены кода

### Requirement: Проверка перед деплоем
Деплой MUST начинаться только после успешной проверки кода тега той же командой, что в CI. Одновременно MUST идти только один деплой; следующий запуск MUST ждать окончания текущего.

#### Scenario: Проверка не прошла
- GIVEN `./scripts/validate.sh` на коде тега завершился ошибкой
- WHEN идёт запуск деплоя
- THEN шаги на сервере MUST NOT выполняться

### Requirement: Настройки деплоя
Настройки сервера MUST лежать на сервере вне репозитория, а ключ доступа MUST лежать в секретах GitHub. Адреса сайта для его сборки (`SITE_ORIGIN`, `SITE_APP_URL`) MUST задаваться переменными GitHub Environment `production`; фронтенд сервиса MUST получать при сборке тот же `SITE_ORIGIN`. Если обязательной настройки или секрета нет, деплой MUST останавливаться с ошибкой, называющей её. Логи запуска MUST NOT содержать секреты. Адрес сервера и почты пользователей MUST NOT коммититься в репозиторий.

#### Scenario: Нет секрета
- GIVEN в GitHub не задан ключ доступа к серверу
- WHEN запускается деплой
- THEN запуск MUST завершиться ошибкой с именем секрета до подключения к серверу

#### Scenario: Нет адреса сайта
- GIVEN в GitHub Environment `production` не задан `SITE_ORIGIN`
- WHEN запускается деплой
- THEN запуск MUST завершиться ошибкой с именем `SITE_ORIGIN` до сборки и подключения к серверу

### Requirement: Резервная копия базы перед деплоем
Перед запуском новой версии деплой MUST сохранять копию базы, включая схемы `ai`, `authorled` и `authentik`. Если копия не получилась, деплой MUST остановиться, не меняя код и контейнеры. На сервере MUST храниться последние 10 копий. Копия не делается только при первом деплое, когда тома базы ещё нет.

#### Scenario: Копия перед обновлением
- GIVEN на сервере работает прошлая версия
- WHEN запускается деплой нового релиза
- THEN до смены кода MUST появиться новая непустая копия базы

#### Scenario: Сбой копии
- GIVEN база недоступна для копирования, а её том существует
- WHEN запускается деплой
- THEN деплой MUST завершиться ошибкой, и код на сервере MUST остаться прежним

#### Scenario: Первый деплой
- GIVEN тома базы на сервере нет
- WHEN запускается первый деплой
- THEN деплой MUST продолжиться без копии и MUST записать это в лог

### Requirement: Обратный прокси
Настройка обратного прокси MUST храниться в репозитории и обновляться при деплое. На домене сервиса (`app.soavtor.app`) он MUST отдавать собранный фронтенд, вести `/os/` на API без этого префикса и вести `/api/v3/flows/executor/`, `/flows/-/cancel/`, `/application/o/revoke/` на Authentik. Домен Authentik (`auth.soavtor.app`) MUST вести на Authentik. Старый домен сервиса `coauthor.glavai.ru` MUST постоянно (301) переадресовывать на домен сервиса с тем же путём и параметрами. `www.soavtor.app` MUST постоянно (301) переадресовывать на `soavtor.app` с тем же путём. Домен продукта `soavtor.app` MUST отдавать собранный сайт текущего релиза как статические файлы, на неизвестный адрес MUST отвечать страницей 404 сайта с кодом `404`, а из API MUST вести только `/os/api/v1/beta-requests` на маршрут заявки без префикса `/os`; другие пути `/os/` на домене продукта MUST NOT доходить до API. Все домены MUST работать по HTTPS.

#### Scenario: Адрес приложения
- GIVEN деплой завершён
- WHEN браузер открывает адрес экрана на домене сервиса, например `/login`
- THEN MUST открыться фронтенд

#### Scenario: Запрос к API
- GIVEN деплой завершён
- WHEN клиент запрашивает `/os/health` на домене сервиса
- THEN запрос MUST дойти до `/health` API

#### Scenario: Вход через домен продукта
- GIVEN деплой завершён
- WHEN фронтенд обращается к `/api/v3/flows/executor/` на своём домене
- THEN запрос MUST дойти до Authentik

#### Scenario: Старая ссылка
- GIVEN деплой завершён
- WHEN браузер открывает `https://coauthor.glavai.ru/stories/42?tab=notes`
- THEN ответ MUST быть `301` с `Location: https://app.soavtor.app/stories/42?tab=notes`

#### Scenario: Адрес с www
- GIVEN деплой завершён
- WHEN браузер открывает `https://www.soavtor.app/pricing`
- THEN ответ MUST быть `301` с `Location: https://soavtor.app/pricing`

#### Scenario: Корень домена до сайта
- GIVEN выложен релиз с сайтом, а прежде `soavtor.app` временно переадресовывал на сервис
- WHEN браузер открывает `https://soavtor.app/`
- THEN ответ MUST NOT быть переадресацией на `https://app.soavtor.app/`

#### Scenario: Главная сайта
- GIVEN деплой завершён
- WHEN браузер открывает `https://soavtor.app/`
- THEN ответ MUST быть `200` с `index.html` собранного сайта

#### Scenario: Неизвестный адрес сайта
- GIVEN деплой завершён
- WHEN браузер открывает `https://soavtor.app/no-such-page`
- THEN ответ MUST быть `404` со страницей 404 сайта

#### Scenario: Заявка с сайта
- GIVEN деплой завершён
- WHEN форма сайта отправляет `POST https://soavtor.app/os/api/v1/beta-requests`
- THEN запрос MUST дойти до `POST /api/v1/beta-requests` API

#### Scenario: Другой путь API на домене продукта
- GIVEN деплой завершён
- WHEN клиент запрашивает `https://soavtor.app/os/agents` или `https://soavtor.app/os/health`
- THEN запрос MUST NOT дойти до API

#### Scenario: Старый домен Authentik
- GIVEN деплой завершён
- WHEN клиент обращается к `auth.coauthor.glavai.ru`
- THEN обратный прокси MUST NOT вести запрос на Authentik

### Requirement: Проверка после деплоя
После запуска деплой MUST проверять по публичному адресу, что `/health` отвечает успехом, а `/agents` без токена отказывает. Деплой MUST также проверять сайт на домене продукта: главная и страница политики отвечают `200`, неизвестный адрес — `404`, а `POST /os/api/v1/beta-requests` с пустым телом получает отказ маршрута заявки `422`; настоящую заявку проверка MUST NOT создавать. Если проверка не прошла, запуск MUST завершиться ошибкой. Автоматический откат MUST NOT выполняться.

#### Scenario: API не поднялся
- GIVEN после запуска `/health` не отвечает успехом
- WHEN проходит проверка
- THEN запуск MUST стать красным, и прошлая версия MUST NOT возвращаться сама

#### Scenario: Доступ без токена
- GIVEN `/agents` без токена отвечает успехом
- WHEN проходит проверка
- THEN запуск MUST завершиться ошибкой

#### Scenario: Сайт не отдаётся
- GIVEN `https://soavtor.app/` отвечает не `200` или маршрут заявки на домене продукта отвечает не `422` на пустое тело
- WHEN проходит проверка
- THEN запуск MUST завершиться ошибкой с адресом и полученным кодом

### Requirement: Откат на прошлый релиз
Запуск деплоя вручную с тегом прошлого релиза MUST возвращать на сервер этот тег по тем же шагам, включая проверку и копию базы. Откат MUST NOT восстанавливать базу сам: при новых миграциях база восстанавливается из копии отдельным действием владельца.

#### Scenario: Ручной откат
- GIVEN на сервере работает `v0.2.0`, а `v0.1.0` есть в `main`
- WHEN владелец вручную запускает деплой с тегом `v0.1.0`
- THEN на сервере MUST заработать код `v0.1.0`

### Requirement: Чистые данные сервера
Деплой MUST NOT загружать демо-контент и MUST NOT создавать пользователей разработки. Сборка фронтенда для сервера MUST использовать источник данных `api` и MUST NOT содержать быстрых кнопок входа и пароля пользователей разработки.

#### Scenario: Новый пользователь на сервере
- GIVEN первый деплой завершён
- WHEN новый пользователь регистрируется и входит
- THEN его список историй MUST быть пустым
- AND пользователей `writer@authorled.test` и `editor@authorled.test` MUST NOT быть

#### Scenario: Сборка фронтенда
- GIVEN фронтенд собран для сервера
- WHEN проверяются файлы сборки
- THEN в них MUST NOT быть текстов «Войти как Сценарист» и «Войти как Редактор»

### Requirement: Телеметрия Agno выключена
Приложение MUST NOT отправлять телеметрию Agno ни в одном запуске. Агенты и команды Agno приложения (`Agent`, `Team`), включая компоненты экзамена маршрутизации, MUST создаваться с `telemetry=False`; инженер `claude-engineer` — внешний агент `ClaudeAgent`, у которого телеметрии Agno нет. Внутренние менеджеры Agno слушаются только `AGNO_TELEMETRY`, поэтому API MUST отказываться стартовать, если `AGNO_TELEMETRY` не равен `false`; значение MUST NOT подставляться по умолчанию. Compose (dev и prod), `./scripts/dev.sh api` и `example.env` MUST задавать `AGNO_TELEMETRY=false`.

#### Scenario: Нет AGNO_TELEMETRY
- GIVEN `AGNO_TELEMETRY` не задан или не равен `false`
- WHEN импортируется `app.main` (старт API, `python -m evals`)
- THEN импорт MUST завершиться ошибкой, называющей `AGNO_TELEMETRY` и требуемое значение `false`

#### Scenario: Агент приложения без телеметрии
- GIVEN `AGNO_TELEMETRY` не задан
- WHEN создаётся агент `coauthor` или компонент экзамена
- THEN у него MUST быть `telemetry=False`, и его запуск MUST NOT отправлять событие телеметрии

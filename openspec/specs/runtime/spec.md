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
`compose.prod.yaml` MUST переключать `RUNTIME_ENV=prd`, `AGNO_DEBUG=False`, убирать bind-mount и reload, брать `AGENTOS_URL` и `MCP_CONNECT_SECRET` из `.env` и привязывать PostgreSQL к `127.0.0.1:5432`. Для сервисов Authentik `compose.prod.yaml` MUST требовать секреты из `.env` (без значений по умолчанию), привязывать порты к `127.0.0.1` и MUST NOT публиковать их на внешних интерфейсах. Том `/data` для AgentCore MUST оставаться закомментированным, пока AgentCore не включён.

#### Scenario: Запуск production
- GIVEN `.env` содержит секреты Authentik, а `authentik-jwks-export` выгрузил ключ проверки JWT
- WHEN выполняется `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`
- THEN `agentos-api` MUST работать с включённой авторизацией

#### Scenario: Порты Authentik в production
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты `authentik-server`
- THEN они MUST быть привязаны к `127.0.0.1`

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

### Requirement: Окружение Python
`agno/scripts/venv_setup.sh` MUST создавать `agno/.venv` на Python 3.14 через `uv` и ставить `agno/requirements.txt` и проект `-e agno[dev]` с ограничениями `agno/requirements.txt`; при активном venv или без `uv` MUST завершаться кодом `1`. `agno/scripts/generate_requirements.sh` MUST компилировать `agno/requirements.txt` из `agno/pyproject.toml` через `uv pip compile` в режимах standard, `upgrade` и обновления отдельных пакетов.

#### Scenario: Активный venv
- GIVEN `VIRTUAL_ENV` задан
- WHEN выполняется `./agno/scripts/venv_setup.sh`
- THEN скрипт MUST завершиться с сообщением «Deactivate your current venv first.»

### Requirement: Evals
`python -m evals` MUST загружать `.env`, по умолчанию устанавливать `RUNTIME_ENV=dev`, собирать MCP-инструменты OS Manager и запускать `agno.eval.cli` с судьёй `default_model()` и таймаутом 180 с. Кейсы `evals/cases.py` с тегом `smoke`: `manager_explains_application` (`read_file`), `manager_checks_health` (`run_diagnostics`), `manager_explains_configured_learning` (`read_file`).

#### Scenario: Smoke-набор
- GIVEN PostgreSQL доступен и ключи моделей заданы
- WHEN выполняется `python -m evals --tag smoke`
- THEN MUST запуститься три кейса, а результаты MUST сохраниться в БД

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql`, `auth-users` (спека `auth`, «Пользователи для разработки») и `seed` («Демо-контент»). Команда `migrate` MUST запускать `agentos-db` и `agentos-db-init` и применять миграции сервисом `agentos-migrate`. Команда `test` MUST выполнять тесты хранения данных продукта на чистой базе `ai_test` (спека `core/database`, «Тесты хранения на чистой базе»). Он MUST использовать сервисы compose-файлов репозитория (`agentos-db`, `agentos-db-init`, `litellm` и сервисы модуля `auth`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` (для разовых сервисов — успешного завершения) до продолжения. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE`. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api` и `seed`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять.

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
Загрузка демо-контента MUST быть одной транзакцией: при отказе или сбое база MUST остаться без изменений. Команда `seed` MUST NOT удалять или заменять истории. Если стенд не готов к загрузке или демо-название занято, команда MUST завершаться ненулевым кодом с названием причины.

#### Scenario: Повторный запуск
- GIVEN у `writer@authorled.test` есть «Последний паром», в том числе в корзине
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием пользователя и истории
- AND истории обоих пользователей MUST остаться без изменений

#### Scenario: Стенд не запущен
- GIVEN не запущен `agentos-db` или Authentik
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием незапущенного сервиса

#### Scenario: Нет пользователей разработки
- GIVEN Authentik запущен, а команда `auth-users` не выполнялась
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением про `./scripts/dev.sh auth-users` и MUST NOT менять базу

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

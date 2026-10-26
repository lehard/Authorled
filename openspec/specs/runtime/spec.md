# Runtime Specification

## Purpose
Окружение, контейнеры, скрипты разработки и evals текущего кода.

## Requirements

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

### Requirement: Production-override
`compose.prod.yaml` MUST переключать `RUNTIME_ENV=prd`, `AGNO_DEBUG=False`, убирать bind-mount и reload, брать `AGENTOS_URL` и `MCP_CONNECT_SECRET` из `.env` и привязывать PostgreSQL к `127.0.0.1:5432`. Том `/data` для AgentCore MUST оставаться закомментированным, пока AgentCore не включён.

#### Scenario: Запуск production
- GIVEN `.env` содержит ключ проверки JWT
- WHEN выполняется `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`
- THEN `agentos-api` MUST работать с включённой авторизацией

### Requirement: Адреса привязки
`python -m app.main` MUST запускать `agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)`: локальный loopback — намеренно. Контейнер `agentos` MUST слушать `0.0.0.0:8000` (CMD образа); доступность снаружи ограничивает compose-публикация порта только на `127.0.0.1:8000`. Различие `127.0.0.1` / `0.0.0.0` задумано и MUST NOT считаться дефектом.

#### Scenario: Запуск через python -m app.main
- GIVEN API запущен командой `python -m app.main`
- WHEN клиент обращается с другой машины
- THEN соединение MUST быть невозможно, так как сервер слушает только `127.0.0.1`

### Requirement: Образы
`Dockerfile` MUST собирать общую базу `agnohq/python:3.14` с `uv pip sync requirements.txt` и цели `agentos` (по умолчанию; entrypoint `scripts/entrypoint.sh`, CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000`) и `sandbox` (пользователь UID 1000, порт 8080, `python -I -m agno.sandbox.agentcore.server serve`). `.dockerignore` MUST исключать `.env*`, `.claude/`, `.codex/`, `tmp/` и MUST оставлять `.agents/skills/`.

#### Scenario: Сборка sandbox
- WHEN выполняется `docker build --target sandbox --load -t agno-sandbox:local .`
- THEN MUST собираться образ, используемый `docker_sandbox()`

### Requirement: Публикация образа
`scripts/build_image.sh` MUST требовать `IMAGE_NAME` с namespace реестра и MUST собирать и пушить `linux/amd64,linux/arm64` цели `agentos`.

#### Scenario: IMAGE_NAME без namespace
- GIVEN `IMAGE_NAME=agentos`
- WHEN запускается скрипт
- THEN он MUST завершиться кодом `1` до сборки

### Requirement: Проверки кода
`scripts/validate.sh` MUST выполнять `ruff format --check`, `ruff check` и `mypy` по корню репозитория и MUST завершаться ненулевым кодом при любой ошибке. CI (`.github/workflows/validate.yml`, Python 3.14) MUST выполнять тот же скрипт. `scripts/format.sh` MUST выполнять `ruff check --select I --fix` и `ruff format`.

#### Scenario: Ошибка форматирования
- GIVEN файл не отформатирован
- WHEN выполняется `./scripts/validate.sh`
- THEN скрипт MUST подсказать `./scripts/format.sh` и вернуть `1`

### Requirement: Окружение Python
`scripts/venv_setup.sh` MUST создавать `.venv` на Python 3.14 через `uv` и ставить `requirements.txt` и проект `-e .[dev]` с ограничениями `requirements.txt`; при активном venv или без `uv` MUST завершаться кодом `1`. `scripts/generate_requirements.sh` MUST компилировать `requirements.txt` из `pyproject.toml` через `uv pip compile` в режимах standard, `upgrade` и обновления отдельных пакетов.

#### Scenario: Активный venv
- GIVEN `VIRTUAL_ENV` задан
- WHEN выполняется `./scripts/venv_setup.sh`
- THEN скрипт MUST завершиться с сообщением «Deactivate your current venv first.»

### Requirement: Evals
`python -m evals` MUST загружать `.env`, по умолчанию устанавливать `RUNTIME_ENV=dev`, собирать MCP-инструменты OS Manager и запускать `agno.eval.cli` с судьёй `default_model()` и таймаутом 180 с. Кейсы `evals/cases.py` с тегом `smoke`: `manager_explains_application` (`read_file`), `manager_checks_health` (`run_diagnostics`), `manager_explains_configured_learning` (`read_file`).

#### Scenario: Smoke-набор
- GIVEN PostgreSQL доступен и ключи моделей заданы
- WHEN выполняется `python -m evals --tag smoke`
- THEN MUST запуститься три кейса, а результаты MUST сохраниться в БД

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

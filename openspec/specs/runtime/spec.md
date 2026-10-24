# Runtime Configuration Specification

## Purpose
Поведение, заданное кодом репозитория: переменные окружения, выбор моделей, инструменты реестра, агенты-инженеры, sandbox, рутины CompanyOS и смоук-проверки.

## Requirements

### Requirement: Переменные окружения базы данных
`db/url.py` MUST собирать URL БД из переменных `DB_DRIVER` (по умолчанию `postgresql+psycopg`), `DB_USER` (`ai`), `DB_PASS` (`ai`), `DB_HOST` (`localhost`), `DB_PORT` (`5432`), `DB_DATABASE` (`ai`). Значение `DB_PORT` MUST быть целым числом.

#### Scenario: Запуск в Compose
- GIVEN `compose.yaml` задаёт `DB_HOST=agentos-db`
- WHEN `agentos-api` подключается к БД
- THEN URL MUST указывать на хост `agentos-db`, порт `5432`

#### Scenario: Некорректный порт
- GIVEN `DB_PORT=abc`
- WHEN импортируется `db.url`
- THEN система MUST завершиться с `ValueError` при приведении к `int`

### Requirement: Режим среды и авторизация
Переменная `RUNTIME_ENV` (по умолчанию `prd`) MUST определять авторизацию: `authorization=(RUNTIME_ENV != "dev")`. `AGENTOS_URL` (по умолчанию `http://127.0.0.1:8000`) MUST передаваться планировщику как `scheduler_base_url` и MCP-аутентификации.

#### Scenario: Dev-режим
- GIVEN `RUNTIME_ENV=dev`
- WHEN клиент вызывает `GET /info`
- THEN `auth_mode` MUST быть `"none"`

#### Scenario: Production без ключа JWT
- GIVEN `RUNTIME_ENV=prd` и не заданы ни `JWT_VERIFICATION_KEY`, ни `JWT_JWKS_FILE`
- WHEN приложение запускается
- THEN приложение SHOULD отказаться обслуживать запросы (поведение заявлено в `example.env` и `compose.prod.yaml`, реализуется библиотекой Agno; в коде репозитория не проверяется — см. `openspec/TODO.md`)

### Requirement: Модели по умолчанию
`app/settings.py` MUST предоставлять `default_model()` → `Claude(id="claude-sonnet-5-5")` и `manager_model()` → `Claude(id="claude-opus-5-5")`; каждая функция MUST возвращать новый экземпляр при каждом вызове. `default_model()` MUST использоваться в реестре (`registry.models`) и как judge-модель в `evals/__main__.py`; `manager_model()` — для OS Manager и Company Manager.

#### Scenario: Список моделей реестра
- GIVEN платформа запущена
- WHEN клиент вызывает `GET /registry?resource_type=model`
- THEN ответ MUST содержать модели `claude-opus-5-5` и `claude-sonnet-5-5` провайдера Anthropic

#### Scenario: Отсутствует ключ Anthropic
- GIVEN `ANTHROPIC_API_KEY` не задан
- WHEN агент с моделью Claude выполняет запуск
- THEN запуск MUST завершиться ошибкой аутентификации провайдера (поведение библиотеки)

### Requirement: Агенты-инженеры
`agents/engineers.py` MUST создавать `ClaudeAgent` (`id="claude-engineer"`, `model="claude-opus-5-5"`, `permission_mode="acceptEdits"`, системный промпт-пресет `claude_code`) и `CodexAgent` (`id="codex-engineer"`, `model="gpt-6.1-sol"`, `sandbox_mode="workspace-write"`). Без sandbox агенты MUST работать в каталоге репозитория (`cwd` = корень проекта); при включённом sandbox `cwd` MUST быть `None`, а `repository` MUST быть задан.

#### Scenario: Sandbox включён без репозитория
- GIVEN `sandbox_provider()` возвращает не `None`, а `REPOSITORY is None`
- WHEN импортируется `agents.engineers`
- THEN система MUST выбросить `ValueError("Set REPOSITORY in app/sandbox.py before enabling a sandbox.")`

#### Scenario: Режим по умолчанию
- GIVEN `sandbox_provider()` возвращает `None`
- WHEN запрашивается `GET /agents`
- THEN у `claude-engineer` и `codex-engineer` поле `sandboxed` MUST быть `false`

### Requirement: Sandbox-провайдеры
`app/sandbox.py` MUST предоставлять `docker_sandbox()` (образ `agno-sandbox:local`, сеть `isolated`, `workspace_mb=2048`, чекпоинты в `tmp/checkpoints`) и `agentcore_sandbox(runtime_arn)`. `agentcore_sandbox` MUST выбросить `ValueError`, если `/data` не является точкой монтирования.

#### Scenario: AgentCore без тома
- GIVEN `/data` не смонтирован
- WHEN вызывается `agentcore_sandbox("arn")`
- THEN система MUST выбросить `ValueError("Mount a persistent volume at /data before enabling AgentCore")`

### Requirement: Инструменты реестра
`Registry` MUST содержать: веб-инструменты (`ParallelTools`, если задан `PARALLEL_API_KEY`; иначе `MCPTools` к `https://search.parallel.ai/mcp`, transport `streamable-http`, `timeout_seconds=30`), файловые инструменты `shared-notes` (`FileSystem`, namespace `shared-notes`), `FileGenerationTools` (PDF и DOCX MUST быть отключены), `CalculatorTools`, функции `extract_json`, `extract_urls`, `json_to_csv`, `csv_to_markdown_table`, `content_to_file`.

#### Scenario: Ключ Parallel не задан
- GIVEN `PARALLEL_API_KEY` пуст
- WHEN приложение формирует реестр
- THEN веб-поиск MUST использовать keyless MCP-сервер Parallel

### Requirement: Знания и обучение
`shared_knowledge` MUST использовать `PgVector` с `SearchType.hybrid` и `OpenAIEmbedder(id="text-embedding-3-small")`; `shared_learning` MUST быть `LearningMachine` с профилем и памятью пользователя в режиме `LearningMode.AGENTIC`. Эти компоненты не дообучают модель.

#### Scenario: Загрузка контента без ключа OpenAI
- GIVEN `OPENAI_API_KEY` не задан
- WHEN в базу знаний загружается контент через `POST /knowledge/content`
- THEN обработка контента MUST завершиться ошибкой при создании эмбеддингов (поведение провайдера)

### Requirement: Рутина обслуживания CompanyOS
`app/company.py` MUST объявлять Product `this-agentos` с источниками `website` (`https://github.com/agno-agi/agno/releases`) и `git` (корень репозитория; плюс `REPOSITORY.url`, если задан) и Routine `agentos-maintenance` (`executor_type="agent"`, `executor_id="company-manager-internal"`, `cron_expr="0 9 * * *"`, `auto_accept=False`). Рутина MUST NOT автоматически принимать и выполнять предложенную работу и MUST предлагать не более трёх улучшений в статусе Backlog.

#### Scenario: Рутина без изменений
- GIVEN нет полезных улучшений
- WHEN выполняется рутина
- THEN система MUST NOT создавать задач

### Requirement: Смоук-проверки evals
`python -m evals` MUST загружать `.env`, устанавливать `RUNTIME_ENV=dev` (если не задан) и запускать кейсы `manager_explains_application`, `manager_checks_health`, `manager_explains_configured_learning` с тегом `smoke`; judge-модель — `default_model()`.

#### Scenario: Запуск одного кейса
- GIVEN доступна БД и ключ Anthropic
- WHEN выполняется `python -m evals --name manager_checks_health`
- THEN проверка MUST требовать вызова инструмента `run_diagnostics`

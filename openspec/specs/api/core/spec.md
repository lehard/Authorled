# Core API Specification

## Purpose
Служебные маршруты AgentOS: проверка здоровья, сведения об инстансе, конфигурация для AgentOS UI,
реестр компонентов Studio, миграции таблиц Agno и выдача медиа сессий.

Домен содержит 7 операций HTTP (теги OpenAPI: Core, Health, Registry, Database, Media). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Аутентификация защищённых маршрутов
При `RUNTIME_ENV`, отличном от `dev`, система MUST включать авторизацию (`authorization=runtime_env != "dev"` в `app/main.py`) и MUST отклонять запросы к защищённым маршрутам без валидного Bearer-токена кодом `401`. Маршруты `GET /health` и `GET /info` MUST оставаться доступными без токена.

#### Scenario: Запрос без токена в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd` и заданным `JWT_VERIFICATION_KEY`
- WHEN клиент выполняет `GET /agents` без заголовка `Authorization`
- THEN система MUST вернуть `401` с телом `{"detail":"Authorization header missing"}`

#### Scenario: Невалидный токен в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd`
- WHEN клиент передаёт заголовок `Authorization: Bearer` с токеном, не подписанным ключом проверки
- THEN система MUST вернуть `401`

#### Scenario: Публичные маршруты в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd`
- WHEN клиент выполняет `GET /health` или `GET /info` без токена
- THEN система MUST вернуть `200`
- AND `GET /info` MUST вернуть `auth_mode: "jwt"`

#### Scenario: Режим разработки
- GIVEN приложение запущено с `RUNTIME_ENV=dev` (так задаёт `compose.yaml`)
- WHEN клиент выполняет любой маршрут без токена
- THEN система MUST обработать запрос без проверки токена
- AND `GET /info` MUST вернуть `auth_mode: "none"` и `user_isolation: true`

### Requirement: Отказ старта без ключа проверки JWT
При включённой авторизации система MUST NOT стартовать без `JWT_VERIFICATION_KEY` или `JWT_JWKS_FILE`.

#### Scenario: prd без ключа
- GIVEN `RUNTIME_ENV=prd`, а `JWT_VERIFICATION_KEY` и `JWT_JWKS_FILE` пусты
- WHEN запускается `uvicorn app.main:app`
- THEN старт MUST завершиться ошибкой `ValueError: AgentOS(authorization=True) requires a JWT verification key`

### Requirement: Сведения об инстансе
`GET /info` MUST возвращать `agno_version` `3.1.10`, `agent_count` `2`, `team_count` `1`, `workflow_count` `0` и блок `mcp` с `enabled: true` и `path: "/mcp"`. `GET /config` MUST возвращать `os_database: "agentos-db"`, единственную БД `agentos-db` в `databases`, `queue` с `durable: true` и `queue_per_session: true`, пустой `interfaces` и `manifest` с описаниями и quick prompts из `app/config.yaml` для `os-manager-internal`, `company-manager-internal`, `claude-engineer`.

#### Scenario: Конфигурация для UI
- GIVEN платформа запущена из репозитория
- WHEN клиент выполняет `GET /config`
- THEN `manifest` MUST содержать 3 компонента из `app/config.yaml`
- AND `interfaces` MUST быть пустым списком
- AND `available_models` MUST содержать `deepseek-thinking` и MUST NOT содержать моделей Anthropic или OpenAI

### Requirement: Состав реестра
`GET /registry` MUST возвращать 15 элементов, объявленных в `app/registry.py` и `app/main.py`: агент `Claude Engineer`, БД `agentos-db`, функции `content_to_file`, `csv_to_markdown_table`, `extract_json`, `extract_urls`, `json_to_csv`, знание `shared-knowledge`, learning `shared-learning`, модели `deepseek-fast` и `deepseek-thinking`, инструменты `calculator`, `file_generation`, `filesystem`, `parallel_tools`.

#### Scenario: Веб-инструменты без ключа Parallel
- GIVEN `PARALLEL_API_KEY` не задан, а `PARALLEL_MODE` в `app/registry.py` равен `keyless_mcp` (значение в коде)
- WHEN строится реестр
- THEN инструмент `parallel_tools` MUST быть `MCPTools` на `https://search.parallel.ai/mcp` (streamable-http, таймаут 30 с)

#### Scenario: Веб-инструменты с ключом Parallel
- GIVEN `PARALLEL_API_KEY` задан, а `PARALLEL_MODE` равен `keyless_mcp`
- WHEN строится реестр
- THEN система MUST использовать тот же `MCPTools` без ключа: режим выбирает `PARALLEL_MODE`, а не наличие ключа

#### Scenario: Веб-инструменты в режиме sdk
- GIVEN `PARALLEL_MODE` равен `sdk`
- WHEN строится реестр
- THEN система MUST использовать `ParallelTools()`, а без `PARALLEL_API_KEY` MUST завершиться `RuntimeError`, называющей `PARALLEL_API_KEY`

### Requirement: GET /info
Система MUST возвращать операцию «Get OS Info» по запросу `GET /info` (operationId `get_info`).
В OpenAPI для маршрута не объявлена схема безопасности.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /info` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `InfoResponse`
- AND тело MUST содержать поля `os_id`, `os_version`, `agno_version`

### Requirement: GET /config
Система MUST возвращать операцию «Get OS Configuration» по запросу `GET /config` (operationId `get_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /config` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ConfigResponse`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /config`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /config`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /config`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /config`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /config`
- THEN система MUST вернуть `500`

### Requirement: GET /health
Система MUST возвращать операцию «Health Check» по запросу `GET /health` (operationId `health_check`).
В OpenAPI для маршрута не объявлена схема безопасности.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /health` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `HealthResponse`
- AND тело MUST содержать поля `status`, `instantiated_at`

### Requirement: GET /registry
Система MUST возвращать операцию «List Registry» по запросу `GET /registry` (operationId `list_registry`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `resource_type` (query, RegistryResourceType (tool | model | db | vector_db | schema | function | agent | team | workflow | knowledge | memory_manager | session_summary_manager | learning) | null, необязательный)
- `name` (query, string | null, необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /registry` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_RegistryContentResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /registry`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /registry`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /registry`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /registry`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /registry`
- THEN система MUST вернуть `500`

### Requirement: POST /databases/all/migrate
Система MUST выполнять операцию «Migrate All Databases» по запросу `POST /databases/all/migrate` (operationId `migrate_all_databases`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `target_version` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /databases/all/migrate` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /databases/all/migrate`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /databases/all/migrate`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /databases/all/migrate`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /databases/all/migrate`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to migrate databases»
- WHEN клиент выполняет `POST /databases/all/migrate`
- THEN система MUST вернуть `500`

### Requirement: POST /databases/{db_id}/migrate
Система MUST выполнять операцию «Migrate Database» по запросу `POST /databases/{db_id}/migrate` (operationId `migrate_database`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (path, string, обязательный)
- `target_version` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /databases/{db_id}/migrate` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /databases/{db_id}/migrate`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /databases/{db_id}/migrate`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Database not found»
- WHEN клиент выполняет `POST /databases/{db_id}/migrate`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /databases/{db_id}/migrate`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to migrate database»
- WHEN клиент выполняет `POST /databases/{db_id}/migrate`
- THEN система MUST вернуть `500`

### Requirement: GET /sessions/{session_id}/media/{storage_key}
Система MUST возвращать операцию «Fetch stored media for a session» по запросу `GET /sessions/{session_id}/media/{storage_key}` (operationId `get_session_media`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `storage_key` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `redirect` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthenticated»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session or media not found»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Media storage could not be reached»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 501
- GIVEN выполняется условие ошибки «Remote databases are not supported»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `501`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «Media storage is not configured»
- WHEN клиент выполняет `GET /sessions/{session_id}/media/{storage_key}`
- THEN система MUST вернуть `503`

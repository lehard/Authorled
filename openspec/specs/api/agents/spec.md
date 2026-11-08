# Agents API Specification

## Purpose
Регистрация, запуск и управление ходами агентов AgentOS.

Домен содержит 12 операций HTTP (теги OpenAPI: Agents). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Зарегистрированные агенты
`GET /agents` MUST возвращать агентов `claude-engineer` (`Claude Engineer`, metadata `sdk: claude-agent-sdk`), `company-manager-internal` (`Company Manager`, модель `deepseek-thinking`) и продуктового агента `coauthor` (`Соавтор`). Все MUST использовать БД `agentos-db`; при отсутствии sandbox поле `sandboxed` MUST быть `false`.

#### Scenario: Неизвестный агент
- GIVEN агента `nope` не существует
- WHEN клиент выполняет `GET /agents/nope`
- THEN система MUST вернуть `404`

#### Scenario: Codex Engineer снят
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /agents/codex-engineer`
- THEN система MUST вернуть `404`

### Requirement: Конфигурация инженеров
`claude-engineer` MUST создаваться как `ClaudeAgent` с моделью `deepseek-thinking`, `system_prompt` preset `claude_code` и `permission_mode="acceptEdits"`. Процесс Claude Code MUST получать адрес прокси как `ANTHROPIC_BASE_URL` и ключ прокси как `ANTHROPIC_API_KEY`, перекрывающие унаследованные значения; модели по умолчанию Claude Code MUST быть псевдонимами прокси (`deepseek-thinking`, для лёгких запросов `deepseek-fast`); необязательный трафик Claude Code MUST быть выключен. Без sandbox инженер MUST работать в абсолютном корне репозитория (`cwd`) на сервере AgentOS и MUST NOT получать `repository`.

#### Scenario: Sandbox без репозитория
- GIVEN `sandbox_provider()` возвращает sandbox, а `REPOSITORY` равен `None`
- WHEN импортируется `agents/engineers.py`
- THEN импорт MUST завершиться `ValueError("Set REPOSITORY in app/sandbox.py before enabling a sandbox.")`

#### Scenario: Sandbox с репозиторием
- GIVEN sandbox включён и `REPOSITORY` задан
- WHEN создаются инженеры
- THEN `cwd` MUST быть `None`, а `repository` MUST быть равен `REPOSITORY`

#### Scenario: Инженер без адреса прокси
- GIVEN `LITELLM_URL` не задан
- WHEN импортируется `agents/engineers.py`
- THEN импорт MUST завершиться ошибкой, называющей `LITELLM_URL`

### Requirement: Статусы хода
Статус хода MUST принимать одно из значений `RunStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `PAUSED`, `CANCELLED`, `ERROR`, `REGENERATED`.

#### Scenario: Список ходов без сессии
- GIVEN агент `claude-engineer` существует
- WHEN клиент выполняет `GET /agents/claude-engineer/runs` без `session_id`
- THEN система MUST вернуть `422`

### Requirement: POST /agents/{agent_id}/runs
Система MUST выполнять операцию «Create Agent Run» по запросу `POST /agents/{agent_id}/runs` (operationId `create_agent_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)

Тело запроса (`multipart/form-data`, схема `Body_create_agent_run`):
- `message`: string, обязательное
- `stream`: boolean, по умолчанию `true`
- `session_id`: string | null
- `user_id`: string | null
- `files`: array[string] | null
- `files_metadata`: string | null
- `version`: integer | null
- `background`: boolean, по умолчанию `false`
- `factory_input`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request or unsupported file type»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: GET /agents/{agent_id}/runs
Система MUST возвращать операцию «List Agent Runs» по запросу `GET /agents/{agent_id}/runs` (operationId `list_agent_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)
- `status` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents/{agent_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: POST /agents/{agent_id}/runs/{run_id}/cancel
Система MUST выполнять операцию «Cancel Agent Run» по запросу `POST /agents/{agent_id}/runs/{run_id}/cancel` (operationId `cancel_agent_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to cancel run»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `500`

### Requirement: POST /agents/{agent_id}/runs/{run_id}/continue
Система MUST выполнять операцию «Continue Agent Run» по запросу `POST /agents/{agent_id}/runs/{run_id}/continue` (operationId `continue_agent_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_continue_agent_run`):
- `tools`: string, по умолчанию `""`
- `input`: string | null
- `continue_from`: string, по умолчанию `"end"`
- `fork`: boolean, по умолчанию `false`
- `regenerate`: boolean, по умолчанию `false`
- `replace_original`: boolean | null
- `additional_instructions`: string | null
- `session_id`: string | null
- `user_id`: string | null
- `stream`: boolean, по умолчанию `true`
- `background`: boolean, по умолчанию `false`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid JSON in tools field or invalid tool structure»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 403
- GIVEN выполняется условие ошибки «Run has a pending admin approval and cannot be continued by the user yet.»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `403`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 409
- GIVEN выполняется условие ошибки «Continuation conflict: a durable queue ticket owns this run's continuation (continue it with background=true), or a continuation is already queued or executing. Runs in any state can be continued - a COMPLETED run forks into a follow-up; RUNNING/ERROR runs resume.»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `409`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `500`

### Requirement: POST /agents/{agent_id}/sessions/{session_id}/fork
Система MUST выполнять операцию «Fork Agent Session» по запросу `POST /agents/{agent_id}/sessions/{session_id}/fork` (operationId `fork_agent_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `session_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Source session is empty or missing»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `500`

### Requirement: POST /agents/{agent_id}/sessions/{session_id}/compact
Система MUST выполнять операцию «Compact Agent Session» по запросу `POST /agents/{agent_id}/sessions/{session_id}/compact` (operationId `compact_agent_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `session_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent or session not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/sessions/{session_id}/compact`
- THEN система MUST вернуть `500`

### Requirement: GET /agents
Система MUST возвращать операцию «List All Agents» по запросу `GET /agents` (operationId `get_agents`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[AgentResponse]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /agents`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /agents`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents`
- THEN система MUST вернуть `500`

### Requirement: GET /agents/{agent_id}
Система MUST возвращать операцию «Get Agent Details» по запросу `GET /agents/{agent_id}` (operationId `get_agent`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents/{agent_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `AgentResponse`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /agents/{agent_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents/{agent_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `GET /agents/{agent_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents/{agent_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents/{agent_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /agents/{agent_id}/runs/{run_id}
Система MUST возвращать операцию «Get Agent Run» по запросу `GET /agents/{agent_id}/runs/{run_id}` (operationId `get_agent_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent or run not found»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /agents/{agent_id}/runs/{run_id}/checkpoints
Система MUST возвращать операцию «List Agent Run Checkpoints» по запросу `GET /agents/{agent_id}/runs/{run_id}/checkpoints` (operationId `list_agent_run_checkpoints`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent or run not found»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `500`

### Requirement: GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}
Система MUST возвращать операцию «Get Agent Run Checkpoint Snapshot» по запросу `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}` (operationId `get_agent_run_checkpoint_snapshot`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `message_index` (path, integer, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid checkpoint message index»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent or run not found»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `500`

### Requirement: POST /agents/{agent_id}/runs/{run_id}/resume
Система MUST выполнять операцию «Resume Agent Run Stream» по запросу `POST /agents/{agent_id}/runs/{run_id}/resume` (operationId `resume_agent_run_stream`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_resume_agent_run_stream`):
- `last_event_index`: integer | null
- `session_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Not supported for remote agents»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent not found»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /agents/{agent_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `500`

### Requirement: Соавтор
Агент `coauthor` MUST отвечать по-русски, опираясь на контекст, присланный фронтендом (история, открытый документ, выделенный фрагмент), на историю беседы и на данные истории, прочитанные инструментами ядра. Его инструменты MUST быть только инструментами ядра из требования «Инструменты соавтора». Он MUST NOT утверждать, что изменил текст сценария, и MUST NOT сохранять память о пользователе или содержание произведения вне сессии беседы и ядра. Модель — `default_model()` через LiteLLM. Заметки, документы драфта и комментарии он MUST менять только по прямой просьбе автора и только после подтверждения вызова (требования «Подтверждение действия» и «Режим соавтора»); после изменения он MUST коротко сказать автору, что сделано.

До вызова модели соавтор MUST проверять лимит подписки пользователя, а после ответа MUST записывать расход запуска в журнал ядра (`core/subscriptions`: «Проверка лимита до запуска», «Журнал расхода соавтора»). Отказ проверки MUST завершать запуск событием ошибки (`RUN_ERROR` в AG-UI) без вызова модели; ошибка записи расхода MUST завершать запуск событием ошибки, а не только строкой в логе. Цена модели соавтора MUST быть в файле цен, иначе API MUST NOT стартовать. Запуск, продолженный после паузы подтверждения, MUST записываться в журнал одной строкой со всеми токенами до и после паузы.

Промпт соавтора MUST браться из навыка `agno/skills/coauthor/SKILL.md` в формате Anthropic Agent Skills: заголовок с `name: coauthor` и непустым `description`, тело — промпт. Тело MUST целиком входить в системное сообщение на каждом ходу. Промпта соавтора в коде MUST NOT быть. Инструментов навыков (загрузка инструкций, справочных материалов и скриптов навыков) у соавтора MUST NOT быть.

#### Scenario: Ответ по контексту
- GIVEN контекст AG-UI содержит открытый документ «Вера» с полем «Главный страх: Что Аня узнает правду и уйдёт»
- WHEN автор спрашивает «Чего боится героиня?»
- THEN ответ MUST опираться на этот страх

#### Scenario: Промпт из навыка
- GIVEN `agno/skills/coauthor/SKILL.md` с `name: coauthor` и телом промпта
- WHEN API стартует и автор отправляет сообщение соавтору
- THEN системное сообщение хода MUST содержать тело `SKILL.md` целиком
- AND у соавтора MUST быть только инструменты ядра из требования «Инструменты соавтора»

#### Scenario: Нет навыка
- GIVEN файла `agno/skills/coauthor/SKILL.md` нет
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей отсутствующий путь
- AND соавтор MUST NOT работать с запасным промптом

#### Scenario: Неверный заголовок навыка
- GIVEN в `agno/skills/coauthor/SKILL.md` нет `description` или `name` отличается от `coauthor`
- WHEN запускается API
- THEN старт MUST завершиться ошибкой, называющей файл и причину

#### Scenario: Расход записан
- GIVEN у автора есть действующая подписка с остатком лимита
- WHEN он отправляет сообщение соавтору и получает ответ
- THEN в журнале расхода MUST появиться строка этого запуска, и токены MUST совпадать с метриками запуска Agno

#### Scenario: Лимит исчерпан
- GIVEN расход автора за текущий период не меньше лимита тарифа
- WHEN он отправляет сообщение соавтору
- THEN поток AG-UI MUST завершиться `RUN_ERROR` с сообщением об исчерпанном лимите и датой обновления, модель MUST NOT вызываться

#### Scenario: Совет без просьбы действовать
- GIVEN режим соавтора автора — `auto`
- WHEN автор спрашивает «Каким мог бы быть брат Веры?»
- THEN соавтор MUST ответить вариантами в чате и MUST NOT создавать документ

#### Scenario: Расход запуска с паузой
- GIVEN режим соавтора автора — `ask`, и запуск встал на паузу перед созданием заметки
- WHEN автор нажимает «Разрешить», и запуск завершается ответом
- THEN в журнале расхода MUST быть ровно одна строка этого запуска с токенами до и после паузы

### Requirement: AG-UI соавтора
`POST /agents/coauthor/agui` MUST принимать запуск AG-UI (`RunAgentInput`) и отдавать события AG-UI потоком SSE. `thread_id` запроса MUST быть идентификатором сессии Agno; `user_id` MUST браться из токена, а не из тела запроса. Без токена MUST возвращаться `401`, без scope `agents:coauthor:run` — `403`.

#### Scenario: Без токена
- GIVEN запрос без `Authorization`
- WHEN клиент вызывает `POST /agents/coauthor/agui`
- THEN система MUST вернуть `401`

#### Scenario: Сессия автора
- GIVEN автор отправил сообщение с `thread_id` = `water:1`
- WHEN он запрашивает `GET /sessions?type=agent&component_id=coauthor`
- THEN список MUST содержать сессию `water:1`, а у другого пользователя MUST NOT

### Requirement: Инструменты соавтора
Соавтор MUST иметь инструменты ядра. Читающие: список документов драфта, чтение документа, чтение текста сценария целиком или сцены по `uid`, чтение текста файла беседы, список и чтение заметок истории. Предлагающие: создание предложения правки. Меняющие (требование «Действия соавтора»): создание и изменение заметки, создание персонажа, локации или мира, изменение документа драфта, комментарий к цитате сцены. Драфт определяется только беседой (`session_id` вида `<projectId>:<draftId>:<uuid>`), пользователь — только запуском; доступ — только у владельца истории. Других изменений инструментами MUST NOT быть: удаления, корзины и восстановления, принятия и отклонения предложений, решения веток и правки сообщений, изменения текста сценария, драфтов, историй, версий, файлов и импорта.

#### Scenario: Чтение персонажа
- GIVEN в драфте беседы есть персонаж «Вера» с полем «Главный страх»
- WHEN автор спрашивает в чате без открытого документа «Чего боится Вера?»
- THEN соавтор MUST прочитать профиль инструментом и опираться на этот страх

#### Scenario: Чужая история
- GIVEN беседа с `session_id` вида `<projectId>:<draftId>:<uuid>` истории другого пользователя
- WHEN инструмент вызывается в запуске этого пользователя
- THEN инструмент MUST вернуть отказ «история не найдена» без данных истории

#### Scenario: Беседа без истории
- GIVEN `session_id` беседы не содержит id истории и драфта
- WHEN соавтор вызывает любой инструмент ядра
- THEN инструмент MUST вернуть отказ с причиной, а не данные другой истории

#### Scenario: Документ другого драфта
- GIVEN беседа драфта 2
- WHEN соавтор читает документ драфта 1 по его `id`
- THEN инструмент MUST вернуть отказ «документ не найден»

#### Scenario: Драфт в корзине
- GIVEN драфт беседы лежит в корзине
- WHEN соавтор вызывает инструмент
- THEN инструмент MUST вернуть отказ с причиной

#### Scenario: Заметка в чате
- GIVEN в истории беседы есть заметка «Финал», и она не открыта на экране
- WHEN автор спрашивает «Что у меня в заметке про финал?»
- THEN соавтор MUST прочитать заметку инструментом и опираться на её текст

#### Scenario: Удалить нельзя
- GIVEN автор просит «удали персонажа Пётр»
- WHEN соавтор отвечает
- THEN персонаж MUST остаться вне корзины, а соавтор MUST сказать, что удаляет только автор

### Requirement: Предложение правки соавтором
Инструмент создания предложения MUST принимать `uid` сцены, точную цитату из неё, предлагаемый текст и «зачем», проверять, что сцена есть в тексте сценария драфта беседы и цитата встречается в ней, и сохранять предложение со статусом `open` и беседой. Если сцены или цитаты нет или драфт заперт, MUST возвращаться отказ с причиной, предложение MUST NOT сохраняться. Текст сценария инструмент MUST NOT менять.

#### Scenario: Цитаты нет
- GIVEN в сцене `s3` нет фразы «Вода холодная»
- WHEN соавтор предлагает правку с этой цитатой в сцене `s3`
- THEN инструмент MUST вернуть отказ «цитата не найдена в сцене», предложения MUST NOT появиться

#### Scenario: Предложение создано
- GIVEN в сцене `s3` есть фраза «Вера молчит»
- WHEN соавтор предлагает заменить её на «Вера отворачивается»
- THEN `GET /api/v1/documents/{id}/suggestions?status=open` MUST вернуть это предложение
- AND ревизия текста сценария MUST NOT измениться

#### Scenario: Предложение в запертом драфте
- GIVEN драфт беседы заперт
- WHEN соавтор предлагает правку
- THEN инструмент MUST вернуть отказ с причиной, предложения MUST NOT появиться

### Requirement: Действия соавтора
Меняющие инструменты MUST вызывать операции ядра и проверять то же, что маршруты автора: история и драфт не в корзине, драфт не заперт, документ из драфта беседы, заметка из истории беседы, поля по виду документа. Отказ MUST возвращаться соавтору текстом с причиной, данные MUST NOT меняться. Изменение MUST применяться к текущей ревизии.

#### Scenario: Новый персонаж
- GIVEN режим соавтора — `auto`
- WHEN автор просит «заведи персонажа Пётр, брат Веры»
- THEN `GET /api/v1/drafts/{id}/documents` MUST вернуть персонажа «Пётр» в конце группы персонажей

#### Scenario: Дописать заметку
- GIVEN заметка «Финал» с текстом «Вера уходит к воде.»
- WHEN соавтор дописывает «Аня идёт за ней.»
- THEN текст заметки MUST заканчиваться «Аня идёт за ней.», и прежний текст MUST остаться перед ним

#### Scenario: Запертый драфт
- GIVEN драфт беседы заперт
- WHEN соавтор создаёт персонажа или меняет документ
- THEN инструмент MUST вернуть отказ с причиной, документов MUST NOT появиться или измениться

#### Scenario: Неизвестное поле
- GIVEN персонаж «Вера»
- WHEN соавтор задаёт ему поле, которого нет у персонажа
- THEN инструмент MUST вернуть отказ, называющий поле, и документ MUST NOT измениться

### Requirement: Снимок перед изменением соавтором
Перед изменением имени, роли, описания или полей документа соавтором MUST сохраняться снимок части `fields` с причиной `coauthor`, независимо от возраста последнего снимка.

#### Scenario: Поле профиля и снимок
- GIVEN у «Веры» поле «Главный страх» = «Остаться одной»
- WHEN соавтор меняет его на «Что Аня узнает правду»
- THEN документ MUST иметь новое значение и следующую ревизию
- AND `GET /api/v1/documents/{id}/versions` MUST вернуть снимок с причиной `coauthor` и значением «Остаться одной»

### Requirement: Режим соавтора
Режим соавтора (`coauthor_mode` в `/api/v1/me`) MUST определять, кто подтверждает паузу меняющего инструмента: в режиме `ask` — автор карточкой в чате, в режиме `auto` — сам чат, сразу и без карточки (`web/workspace`, «Режим соавтора в чате»). Сервер ставит на паузу каждый меняющий вызов в любом режиме. Читающие инструменты и предложение правки MUST NOT ставить запуск на паузу.

#### Scenario: Сразу в режиме «Сам»
- GIVEN режим соавтора — `auto`
- WHEN автор просит соавтора создать заметку
- THEN заметка MUST появиться до конца ответа соавтора, и автор MUST NOT видеть карточку подтверждения

#### Scenario: Смена режима
- GIVEN режим соавтора — `ask`
- WHEN автор меняет его на `auto` и просит создать заметку
- THEN заметка MUST создаться без карточки подтверждения уже в этом ответе

#### Scenario: Предложение без паузы
- GIVEN режим соавтора — `ask`
- WHEN соавтор предлагает правку реплики
- THEN предложение MUST создаться без паузы

### Requirement: Подтверждение действия
Каждый вызов меняющего инструмента MUST ставить запуск на паузу AG-UI: поток содержит этот вызов с аргументами и `RUN_FINISHED`, данные не меняются. Ответ инструмента `{"accepted": true}` с тем же `tool_call_id` MUST выполнять вызов и продолжать запуск; любой другой ответ MUST отклонять вызов без изменений, и соавтор MUST узнать об отказе.

#### Scenario: Спросить и разрешить
- GIVEN соавтор работает в любом режиме
- WHEN соавтор вызывает создание персонажа «Пётр»
- THEN поток AG-UI MUST закончиться вызовом этого инструмента с именем «Пётр» и `RUN_FINISHED`, и персонажа MUST NOT быть в драфте
- AND после ответа инструмента `{"accepted": true}` с тем же `tool_call_id` персонаж MUST появиться, а запуск MUST продолжиться ответом соавтора

#### Scenario: Спросить и отклонить
- GIVEN запуск стоит на паузе перед созданием персонажа «Пётр»
- WHEN автор отвечает `{"accepted": false}`
- THEN персонажа MUST NOT быть в драфте, и соавтор MUST сказать, что не стал его создавать

### Requirement: Комментарий соавтором
Инструмент комментария MUST принимать `uid` сцены, точную цитату из одного абзаца сцены и непустой текст, проверять сцену и цитату в тексте сценария драфта беседы и создавать ветку с `scene_uid`, цитатой и первым сообщением от соавтора. Текст сценария MUST NOT меняться: метку ставит браузер (`web/workspace`, «Комментарий соавтора по якорю»). Нет сцены или цитаты — отказ с причиной, ветка MUST NOT создаваться.

#### Scenario: Комментарий создан
- GIVEN в сцене `s3` есть фраза «Вера молчит»
- WHEN соавтор комментирует её «Здесь пауза важнее реплики»
- THEN `GET /api/v1/documents/{id}/comments` MUST вернуть ветку с цитатой «Вера молчит», `scene_uid` `s3` и сообщением соавтора
- AND ревизия текста сценария MUST NOT измениться

#### Scenario: Цитаты нет
- GIVEN в сцене `s3` нет фразы «Вода холодная»
- WHEN соавтор комментирует эту цитату
- THEN инструмент MUST вернуть отказ «цитата не найдена в сцене», ветки MUST NOT появиться

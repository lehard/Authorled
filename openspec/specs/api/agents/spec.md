# Agents API Specification

## Purpose
Регистрация, запуск и управление ходами агентов AgentOS.

Домен содержит 12 операций HTTP (теги OpenAPI: Agents). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Зарегистрированные агенты
`GET /agents` MUST возвращать агентов `claude-engineer` (`Claude Engineer`, metadata `sdk: claude-agent-sdk`), `codex-engineer` (`Codex Engineer`, metadata `sdk: codex`) и `company-manager-internal` (`Company Manager`, модель `claude-opus-5-5`). Все MUST использовать БД `agentos-db`; при отсутствии sandbox поле `sandboxed` MUST быть `false`.

#### Scenario: Неизвестный агент
- GIVEN агента `nope` не существует
- WHEN клиент выполняет `GET /agents/nope`
- THEN система MUST вернуть `404`

### Requirement: Конфигурация инженеров
`claude-engineer` MUST создаваться как `ClaudeAgent` с `model="claude-opus-5-5"`, `system_prompt` preset `claude_code` и `permission_mode="acceptEdits"`. `codex-engineer` MUST создаваться как `CodexAgent` с `model="gpt-6.1-sol"` и `sandbox_mode="workspace-write"` (`agents/engineers.py`). Без sandbox оба MUST работать в абсолютном корне репозитория (`cwd`) на сервере AgentOS и MUST NOT получать `repository`.

#### Scenario: Sandbox без репозитория
- GIVEN `sandbox_provider()` возвращает sandbox, а `REPOSITORY` равен `None`
- WHEN импортируется `agents/engineers.py`
- THEN импорт MUST завершиться `ValueError("Set REPOSITORY in app/sandbox.py before enabling a sandbox.")`

#### Scenario: Sandbox с репозиторием
- GIVEN sandbox включён и `REPOSITORY` задан
- WHEN создаются инженеры
- THEN `cwd` MUST быть `None`, а `repository` MUST быть равен `REPOSITORY`

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

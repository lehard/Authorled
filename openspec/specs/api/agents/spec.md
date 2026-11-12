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

До вызова модели соавтор MUST проверять лимит подписки пользователя, а после ответа MUST записывать расход запуска в журнал биллинга (`billing/subscriptions`: «Проверка лимита до запуска», «Журнал расхода соавтора»); лимит и журнал хук берёт только через интерфейс биллинга (`billing/module`). Отказ проверки MUST завершать запуск событием ошибки (`RUN_ERROR` в AG-UI) без вызова модели; ошибка записи расхода MUST завершать запуск событием ошибки, а не только строкой в логе. Цена модели соавтора MUST быть в файле цен, иначе API MUST NOT стартовать. Запуск, продолженный после паузы подтверждения, MUST записываться в журнал одной строкой со всеми токенами до и после паузы.

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
Соавтор MUST иметь инструменты ядра. Читающие: список документов драфта, чтение документа, чтение текста сценария целиком или сцены по `uid`, чтение текста файла беседы, список и чтение заметок истории, поиск по драфту и истории беседы (тот же поиск ядра, что у маршрута «Поиск по драфту истории» `api/stories`: сцены с `uid`, документы и заметки с `id` и кусочком текста вокруг совпадения; короткий запрос — отказ с причиной), список каркасов историй с актами и точками, поиск по библиотеке первоисточников и оформление цитаты из неё (`sources/library`: «Поиск по библиотеке», «Проверка цитаты»). Предлагающие: создание предложения правки. Меняющие (требование «Действия соавтора»): создание и изменение заметки, сохранение файла беседы в заметку, создание задания на исследование (заметка с заданием, требование «Задание на исследование»), создание персонажа, локации или мира, изменение документа драфта, комментарий к цитате сцены. Драфт определяется только беседой (`session_id` вида `<projectId>:<draftId>:<uuid>`), пользователь — только запуском; доступ — только у владельца истории. Других изменений инструментами MUST NOT быть: удаления, корзины и восстановления, принятия и отклонения предложений, решения веток и правки сообщений, изменения текста сценария, драфтов, историй, версий, оригиналов заметок и импорта.

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

#### Scenario: Каркасы из ядра
- WHEN соавтор вызывает инструмент списка каркасов
- THEN ответ MUST содержать те же каркасы, акты, точки и подсказки, что `GET /api/v1/story-templates`

#### Scenario: Поиск по истории
- GIVEN в драфте беседы лодка упоминается в двух сценах и в профиле Коли
- WHEN автор спрашивает «В каких сценах есть лодка?»
- THEN соавтор MUST найти их инструментом поиска без подтверждения автора и назвать эти сцены по номерам, а не читать для этого весь текст сценария

#### Scenario: Задание среди меняющих
- GIVEN режим соавтора — `ask`
- WHEN соавтор создаёт задание на исследование
- THEN запуск MUST встать на паузу перед этим вызовом, как перед созданием заметки

#### Scenario: Поиск по библиотеке без подтверждения
- GIVEN режим соавтора — `ask`
- WHEN соавтор ищет в библиотеке первоисточников или оформляет цитату
- THEN запуск MUST NOT вставать на паузу

#### Scenario: Сбой поиска по библиотеке
- GIVEN модель эмбеддингов недоступна
- WHEN соавтор ищет в библиотеке
- THEN инструмент MUST вернуть отказ о сбое поиска, а не «ничего не нашлось»

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

Описание инструментов создания и изменения документа, которое получает модель, MUST совпадать с тем, что проверяет ядро:
- значение каждого поля профиля MUST быть описано как строка, у изменения — строка или null (null убирает поле);
- роль MUST быть описана перечислением `main`, `secondary`, `episodic`; описание MUST говорить, что при создании персонажа и локации роль обязательна, а у мира её нет;
- описание полей MUST перечислять поля каждого вида с короткими пояснениями по-русски и допустимые значения там, где они ограничены (`gender`), и MUST строиться из того же списка полей, которым пользуется ядро;
- поля сценария, значения которых не строки (`show`, `title_page`), MUST NOT быть в описании: соавтор их не меняет.

После отказа соавтор MUST исправить вызов по причине из отказа и MUST NOT переносить сведения из полей профиля в описание документа (`summary`), чтобы обойти отказ.

#### Scenario: Новый персонаж
- GIVEN режим соавтора — `auto`
- WHEN автор просит «заведи персонажа Пётр, брат Веры»
- THEN `GET /api/v1/drafts/{id}/documents` MUST вернуть персонажа «Пётр» в конце группы персонажей

#### Scenario: Персонаж с профилем
- GIVEN режим соавтора — `auto`
- WHEN автор просит «Создай ужасного персонажа Василия, который бомж и дикий шизанутый»
- THEN персонаж «Василий» MUST появиться, и его профиль MUST содержать сведения о нём в полях профиля персонажа (например, `personality`, `body`, `dress`, `speech`, `fear`)
- AND каждое значение поля MUST быть строкой

#### Scenario: Описание инструмента
- WHEN соавтор получает описание инструмента создания документа
- THEN схема `fields` MUST описывать значения строками, схема `role` MUST перечислять `main`, `secondary`, `episodic`
- AND описание MUST называть каждое поле профиля персонажа, локации и мира из списка полей ядра
- AND описание `role` MUST говорить, что роль обязательна при создании персонажа и локации и не передаётся у мира

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
- THEN инструмент MUST вернуть отказ, называющий поле и допустимые поля персонажа, и документ MUST NOT измениться

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

### Requirement: Название продукта у соавтора
Промпт соавтора MUST называть продукт «Соавтор», а в ответах соавтор MUST называть продукт «Соавтор» и MUST NOT называть его Authorled или CoAuthor. Описание контекста, которое чат передаёт соавтору, MUST называть продукт так же.

#### Scenario: Вопрос о названии
- GIVEN автор в чате истории
- WHEN он спрашивает «Как называется этот сервис?»
- THEN соавтор MUST ответить, что сервис называется «Соавтор»
- AND в ответе MUST NOT быть слов Authorled и CoAuthor

#### Scenario: Промпт без старого названия
- GIVEN `agno/skills/coauthor/SKILL.md`
- WHEN в нём ищутся слова Authorled и CoAuthor
- THEN совпадений MUST NOT быть

### Requirement: Ответ на проверку наставника
На проверку наставника (вода, желание героя, темп, голоса, тон, конфликт, показано или рассказано, противоречия) соавтор MUST назвать одно–три главных места с точной цитатой из выделенного фрагмента или открытого документа, объяснить, почему место слабое, и задать автору вопрос. Переписанный фрагмент целиком он MUST NOT присылать; короткую конкретную правку — только предложением правки.

#### Scenario: Где вода
- GIVEN открыт текст сценария демо-истории «Тихая вода», выделена сцена
- WHEN автор отправляет проверку «Где вода?»
- THEN ответ MUST содержать от одной до трёх цитат из этой сцены с объяснением и вопрос автору
- AND ответ MUST NOT содержать переписанную сцену

#### Scenario: Правка предложением
- GIVEN в выделенной реплике есть лишний повтор
- WHEN соавтор на проверку «Где вода?» хочет предложить сокращение реплики
- THEN сокращение MUST прийти предложением правки по цитате реплики, а текст сценария MUST NOT меняться

### Requirement: Проверка без материала
Если проверке наставника не на что опереться (пустой документ, нет выделения и открыт документ без текста), соавтор MUST сказать это и спросить автора, что проверить, и MUST NOT придумывать текст для проверки.

#### Scenario: Не на что опереться
- GIVEN открыта пустая заметка, ничего не выделено
- WHEN автор отправляет проверку «Темп»
- THEN соавтор MUST сказать, что проверять нечего, и спросить, какую сцену проверить

### Requirement: Опора соавтора на материалы истории
Соавтор MUST утверждать факты о сценарии, документах и заметках истории только по прочитанному инструментами или присланному в контексте; в разборе и пересказе MUST NOT добавлять деталей, которых нет в тексте. Если того, о чём спрашивает автор (персонажа, сцены, заметки, реплики), в истории нет, соавтор MUST прямо сказать об этом и уточнить, MUST NOT подменять похожим и MUST NOT обращаться с ним как с существующим.

#### Scenario: Заметки нет
- GIVEN в истории нет заметки «Соседка» (она в корзине)
- WHEN автор просит «Удали заметку „Соседка“»
- THEN соавтор MUST сказать, что такой заметки в истории нет, и MUST NOT объяснять, как её удалить

#### Scenario: Персонажа нет в сцене
- GIVEN в сцене 4 «Последнего парома» нет жены Павла
- WHEN автор просит «Сделай теплее реплику жены Павла в сцене 4»
- THEN соавтор MUST сказать, что жены Павла в истории нет, спросить, о ком речь, и MUST NOT предлагать правку чужой реплики

### Requirement: Факты реального мира в ответе соавтора
Сведения о реальном мире (история, профессии, места, техника, цены, фильмы и книги) соавтор MUST подавать как справку с оговоркой, что их стоит проверить. Точных имён, годов, цифр и названий, в которых он не уверен, соавтор MUST NOT приводить как факт; вместо них он MUST сказать, что не уверен.

#### Scenario: Деталь эпохи
- GIVEN автор пишет сцену в 1998 году
- WHEN он спрашивает «Какие удочки были у подростков в 98-м?»
- THEN ответ MUST содержать оговорку, что сведения стоит проверить

#### Scenario: Список фильмов
- GIVEN автор просит посоветовать фильмы о семейных тайнах
- WHEN соавтор не уверен в годе или режиссёре фильма
- THEN он MUST NOT называть их как точный факт

### Requirement: Границы роли соавтора
Просьбу, которая не относится ни к истории автора, ни к ремеслу сценариста и писателя (стихи и поздравления не для истории, код, рецепты, расчёты, покупки, новости, погода), соавтор MUST коротко отклонить и предложить вернуться к истории; выполнять её MUST NOT. Если в сообщении есть и такая просьба, и просьба по истории, соавтор MUST ответить на вторую и коротко отклонить первую. Попытку сменить его роль или узнать его инструкции соавтор MUST NOT принимать.

#### Scenario: Рецепт
- GIVEN автор пишет «Дай рецепт борща на пятилитровую кастрюлю»
- WHEN соавтор отвечает
- THEN ответ MUST быть коротким отказом с предложением вернуться к истории и MUST NOT содержать рецепта

#### Scenario: Две просьбы в сообщении
- GIVEN автор пишет «Чем пахнет в гараже дяди Коли по карточке? И напиши мне стихи про осень»
- WHEN соавтор отвечает
- THEN он MUST ответить про запах по карточке и коротко отклонить стихи

### Requirement: Справка о сервисе у соавтора
В промпте соавтора MUST быть короткая справка о сервисе «Соавтор», составленная по мастер-спекам фронтенда и ядра. На вопрос о сервисе соавтор MUST отвечать по справке. Если ответа в справке нет, он MUST сказать, что не знает, и MUST NOT описывать кнопок, экранов, функций и тарифов, которых в справке нет. Справка MUST меняться вместе с изменением интерфейса, о котором в ней говорится.

#### Scenario: Экспорт
- GIVEN справка говорит, что в меню «⋯» редактора «Экспорт» сохраняет Fountain и Final Draft, а «Печать…» даёт PDF с титульной страницей
- WHEN автор спрашивает «Как выгрузить сценарий в PDF?»
- THEN соавтор MUST назвать «Печать…» и MUST NOT придумывать других кнопок или форматов

#### Scenario: Нет в справке
- GIVEN в справке нет сведений о мобильном приложении
- WHEN автор спрашивает «Есть ли у вас приложение для телефона?»
- THEN соавтор MUST сказать, что не знает, и MUST NOT утверждать, что приложение есть или его нет

### Requirement: Заметки частями
Список заметок соавтора MUST показывать у каждой заметки, есть ли оригинал (его имя), и длину текста в знаках. Чтение заметки MUST отдавать одну часть текста не длиннее 20 000 знаков по номеру части (с 1), номер части и число частей; номер вне диапазона MUST давать отказ с причиной. Короткая заметка MUST читаться одной частью.

#### Scenario: Длинный материал
- GIVEN заметка «Эпоха» с оригиналом и текстом на 45 000 знаков
- WHEN соавтор читает её часть 3
- THEN ответ MUST содержать знаки с 40 001 по 45 000, номер части 3 и число частей 3

#### Scenario: Оригинал в списке
- GIVEN в истории заметки «Финал» без оригинала и «Эпоха» из `Эпоха.pdf`
- WHEN соавтор читает список заметок
- THEN у «Эпохи» MUST быть имя `Эпоха.pdf`, а у «Финала» — признак, что оригинала нет

#### Scenario: Части нет
- GIVEN заметка на одну часть
- WHEN соавтор читает её часть 2
- THEN инструмент MUST вернуть отказ с причиной

### Requirement: Файл беседы в заметку
Инструмент сохранения файла беседы MUST принимать `id` файла, приложенного к этой беседе, и создавать заметку с его копией по правилам `POST /api/v1/files/{id}/note`, включая предел длины текста и место по тарифу пользователя запуска. Файл другой беседы, файл импорта и оригинал заметки MUST давать отказ с причиной без изменений.

#### Scenario: Сохрани в заметки
- GIVEN автор приложил к сообщению `Эпоха.pdf`, режим соавтора — `auto`
- WHEN автор пишет «сохрани это в заметки»
- THEN в истории MUST появиться заметка «Эпоха» с оригиналом, и соавтор MUST коротко сказать, что сохранил

#### Scenario: Файл другой беседы
- GIVEN файл приложен к другой беседе этой истории
- WHEN соавтор сохраняет его в заметки
- THEN инструмент MUST вернуть отказ с причиной, и заметка MUST NOT появиться

#### Scenario: Места нет
- GIVEN место для оригиналов заметок пользователя занято до предела
- WHEN соавтор сохраняет файл беседы в заметки
- THEN инструмент MUST вернуть отказ с занятым местом и пределом, и заметка MUST NOT появиться

### Requirement: Раскладка по каркасу
На просьбу разложить историю по каркасу соавтор MUST прочитать каркас инструментом и сценарий драфта беседы. Он MUST создать заметку истории, где каждой точке каркаса сопоставлены сцены по номеру и заголовку, и названы точки без сцен. Текст сценария MUST NOT меняться. Каркас, которого нет в списке ядра, соавтор MUST назвать отсутствующим и перечислить имеющиеся.

#### Scenario: Раскладка по трём актам
- GIVEN режим соавтора — `auto`, в драфте беседы сценарий демо-истории
- WHEN автор просит «разложи мою историю по трём актам»
- THEN в истории MUST появиться одна новая заметка с точками каркаса `three-acts` и сценами под ними
- AND текст сценария и его ревизия MUST остаться прежними

#### Scenario: Каркаса нет
- WHEN автор просит «разложи по семи точкам Уэллса»
- THEN соавтор MUST сказать, что такого каркаса нет, перечислить каркасы ядра и MUST NOT создавать заметку

### Requirement: Форма логлайна и синопсиса у соавтора
Соавтор MUST писать версии по форме:
- логлайн — главный герой описанием, его цель, главное препятствие и ставки; одно-два предложения, до 35 слов, настоящее время;
- синопсис на страницу — до 400 слов, абзац — до 120 слов; третье лицо, настоящее время, завязка, ключевые повороты и финал по порядку;
- для зрителя — 50–100 слов, завязка и ставки, финал и главные повороты не раскрыты.

Оценок и рекламных слов («захватывающий», «невероятный») MUST NOT быть.

#### Scenario: Логлайн по форме
- GIVEN открыт «Логлайн» демо-истории «Тихая вода»
- WHEN автор просит предложить варианты логлайна
- THEN соавтор MUST прислать три варианта, в каждом — героиня, её цель и препятствие, не длиннее 35 слов

#### Scenario: Для зрителя без финала
- GIVEN в синопсисе «Тихой воды» раскрыто, что Миша утонул не случайно
- WHEN автор просит версию синопсиса для зрителя
- THEN ответ MUST NOT раскрывать, что гибель Миши не была случайной

### Requirement: Синопсис под требования заявки
Если автор назвал требования заявки (объём, состав, что раскрыть), соавтор MUST следовать им вместо общей формы и MUST NOT превышать названный объём. Если в просьбе «под заявку» требований нет, соавтор MUST спросить о них, а не писать по общей форме. Число слов или знаков MUST NOT называться, если соавтор его не посчитал.

#### Scenario: Требований нет
- GIVEN автор отправил «Напиши синопсис под заявку. Требования: » без продолжения
- WHEN соавтор отвечает
- THEN он MUST спросить требования заявки и MUST NOT присылать синопсис

### Requirement: Запись логлайна и синопсиса
На просьбу написать логлайн или синопсис соавтор MUST показать текст в чате и предложить записать его. Логлайн и синопсис на страницу MUST записываться в документ драфта, остальные версии — заметкой истории с названием «Синопсис: <версия>». Записывать MUST только после согласия автора или его прямой просьбы записать. Если в документе уже есть текст, соавтор MUST сказать, что запись его заменит.

#### Scenario: Варианты без записи
- GIVEN режим соавтора — `auto`
- WHEN автор просит предложить варианты логлайна
- THEN соавтор MUST NOT вызывать изменяющих инструментов, а ответ MUST предлагать записать выбранный вариант

#### Scenario: Замена непустого синопсиса
- GIVEN синопсис драфта не пуст
- WHEN соавтор предлагает записать новый синопсис на страницу
- THEN предложение MUST говорить, что нынешний синопсис будет заменён

#### Scenario: Версия заметкой
- GIVEN автор согласился сохранить версию для зрителя
- WHEN соавтор её записывает
- THEN MUST появиться заметка истории «Синопсис: для зрителя», а синопсис драфта MUST NOT измениться

### Requirement: Логлайн и синопсис по материалам истории
Сюжет логлайна и синопсиса соавтор MUST брать из текста сценария, поэпизодника, документов и заметок драфта, прочитанных инструментами. Если текста сценария мало, он MUST опираться на поэпизодник и заметки; если нет и их, MUST задать автору вопросы о герое, его цели и финале и MUST NOT придумывать сюжет.

#### Scenario: Пустая история
- GIVEN в драфте нет текста сценария, поэпизодника и заметок
- WHEN автор просит написать синопсис на страницу
- THEN соавтор MUST спросить о герое, его цели и финале и MUST NOT присылать синопсис

### Requirement: Разметка синопсиса у соавтора
Синопсис, который соавтор записывает в документ драфта, MUST быть Markdown редактора прозы: абзацы через пустую строку, жирный и курсив по смыслу, заголовки `#` и `##` — только в расширенном синопсисе (больше страницы) или по просьбе автора. Заголовков глубже второго уровня, списков и таблиц MUST NOT быть. Версии синопсиса в заметках и логлайн MUST оставаться простым текстом. Читая синопсис, соавтор MUST понимать разметку и MUST NOT цитировать автору знаки разметки как текст.

#### Scenario: Синопсис на страницу без заголовков
- GIVEN открыт синопсис «Тихой воды», он пуст
- WHEN автор просит написать синопсис на страницу и разрешает запись
- THEN записанный `synopsis` MUST NOT содержать строк, начинающихся с `#`, списков и таблиц

#### Scenario: Расширенный синопсис по актам
- WHEN автор просит синопсис на три страницы с разбивкой по актам и разрешает запись
- THEN записанный `synopsis` MUST содержать заголовки актов строками `# ` или `## ` и MUST NOT содержать `###`

#### Scenario: Версия в заметке
- WHEN автор просит версию синопсиса для зрителя и разрешает запись
- THEN текст заметки «Синопсис: для зрителя» MUST NOT содержать знаков разметки Markdown

### Requirement: Задание на исследование
Инструмент задания на исследование MUST принимать тему, текст задания и вложения (сценарий драфта беседы и заметки истории по `id`). Он MUST создавать заметку истории «Исследование: <тема>» с текстом задания и больше ничего не менять. Проверки — как у создания заметки соавтором. Отказ с причиной без заметки MUST быть, если тема или текст пусты, текст длиннее 8 000 знаков или вложенная заметка не из истории беседы, в корзине или без оригинала.

#### Scenario: Задание создано
- GIVEN режим соавтора — `auto`, в истории есть заметка «Эпоха» из `Эпоха.pdf`
- WHEN соавтор создаёт задание с темой «быт цыган в 70-е», вложениями «сценарий» и «Эпоха»
- THEN в истории MUST появиться заметка «Исследование: быт цыган в 70-е», текст которой равен тексту задания
- AND у этой заметки MUST NOT быть оригинала, а заметка «Эпоха» и сценарий MUST NOT измениться

#### Scenario: Слишком длинное задание
- GIVEN текст задания длиннее 8 000 знаков
- WHEN соавтор создаёт задание
- THEN инструмент MUST вернуть отказ с пределом, и заметка MUST NOT появиться

#### Scenario: Вложение без оригинала
- GIVEN заметка «Финал» без оригинала
- WHEN соавтор вкладывает её в задание
- THEN инструмент MUST вернуть отказ, называющий заметку и причину, и заметка задания MUST NOT появиться

#### Scenario: Заметка чужой истории
- GIVEN `id` заметки другой истории
- WHEN соавтор вкладывает её в задание
- THEN инструмент MUST вернуть отказ «заметка не найдена», и заметка задания MUST NOT появиться

### Requirement: Задание на исследование у соавтора
Просьба автора изучить тему вне истории (быт, профессия, эпоха, место) MUST быть для соавтора просьбой создать задание на исследование. До задания соавтор MUST читать то, что в истории касается темы, и MAY задать не больше двух уточнений. Соавтор MUST NOT утверждать, что исследует тему сам. Отвечая на вопрос о фактах, он MAY предложить задание словами, не создавая его.

#### Scenario: Просьба изучить
- GIVEN режим соавтора — `auto`, история «Тихая вода»
- WHEN автор пишет «хочу изучить, как жили паромщики на Волге в 90-е»
- THEN соавтор MUST задать не больше двух уточнений или создать задание на исследование
- AND он MUST NOT писать, что сам проводит исследование

#### Scenario: Вопрос о факте
- GIVEN автор спрашивает «Какие удочки были у подростков в 98-м?»
- WHEN соавтор отвечает
- THEN он MUST NOT создавать задание без просьбы автора

### Requirement: Состав задания на исследование
Текст задания MUST быть на русском и годиться для любого сервиса Deep Research без нашей истории: тема и цель (для чего материал автору), короткий контекст истории (эпоха, место, жанр, несколько строк о героях, которых касается тема), конкретные вопросы и что не нужно, формат отчёта. Формат отчёта MUST требовать источники у утверждений, пометку слабых сведений, клише по теме и детали для сцены. Сцены и тексты заметок целиком MUST NOT входить в задание.

#### Scenario: Состав
- GIVEN соавтор создал задание по теме «паромщики на Волге в 90-е» в истории «Тихая вода»
- WHEN автор открывает заметку задания
- THEN в тексте MUST быть цель, контекст истории, вопросы и формат отчёта с источниками
- AND в тексте MUST NOT быть сцен сценария целиком

### Requirement: Опора соавтора на первоисточники
На вопросы о драматургии, структуре, приёмах и при обосновании своего совета соавтор MUST искать в библиотеке первоисточников. Цитату из книги он MUST показывать только в виде, который вернуло оформление цитаты, со ссылкой. Куски книг длиннее цитаты он MUST NOT пересказывать близко к тексту. Если в библиотеке нужного нет, он MUST NOT ссылаться на книги из неё.

#### Scenario: Обоснование совета
- GIVEN в библиотеке загружена «Поэтика»
- WHEN автор спрашивает «Почему сцена без развязки кажется незаконченной?»
- THEN соавтор MUST найти кусок «Поэтики» поиском и дать в ответе проверенную цитату со ссылкой

#### Scenario: Непроверенная цитата
- GIVEN оформление цитаты вернуло отказ «цитаты нет в источнике»
- WHEN соавтор пишет ответ
- THEN он MUST NOT подавать этот текст как цитату из книги

#### Scenario: Ничего не нашлось
- GIVEN поиск по библиотеке не нашёл ничего по теме вопроса
- WHEN соавтор отвечает
- THEN он MUST NOT называть книгу библиотеки источником своего совета

### Requirement: Цитата из английской книги
Цитату из книги на английском соавтор MUST давать в оригинале, проверенной. Перевод он MAY дать рядом и MUST пометить его как перевод соавтора, а не издания.

#### Scenario: Цитата из «Impro»
- GIVEN соавтор опирается на кусок «Impro» о статусе
- WHEN он цитирует книгу русскоязычному автору
- THEN цитата MUST быть на английском со ссылкой, а русский текст рядом MUST быть помечен как перевод соавтора

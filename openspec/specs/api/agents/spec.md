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
Агент `coauthor` MUST отвечать по-русски, опираясь на контекст, присланный фронтендом (история, открытый документ, выделенный фрагмент), на историю беседы и на данные истории, прочитанные инструментами ядра. Его инструменты MUST быть только инструментами ядра из требования «Инструменты соавтора». Он MUST NOT утверждать, что изменил текст автора, и MUST NOT сохранять память о пользователе или содержание произведения вне сессии беседы и ядра. Модель — `default_model()` через LiteLLM.

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
Соавтор MUST иметь инструменты ядра: список документов истории, чтение документа, чтение текста сценария целиком или сцены по `uid`, чтение текста файла беседы и создание предложения правки. История определяется только беседой (`session_id` вида `<projectId>:<uuid>`), пользователь — только запуском; доступ — только у владельца истории. Изменять, удалять, принимать и отклонять что-либо инструментами MUST NOT быть возможно.

#### Scenario: Чтение персонажа
- GIVEN в истории беседы есть персонаж «Вера» с полем «Главный страх»
- WHEN автор спрашивает в чате без открытого документа «Чего боится Вера?»
- THEN соавтор MUST прочитать профиль инструментом и опираться на этот страх

#### Scenario: Чужая история
- GIVEN беседа с `session_id` вида `<projectId>:<uuid>` истории другого пользователя
- WHEN инструмент вызывается в запуске этого пользователя
- THEN инструмент MUST вернуть отказ «история не найдена» без данных истории

#### Scenario: Беседа без истории
- GIVEN `session_id` беседы не содержит id истории
- WHEN соавтор вызывает любой инструмент ядра
- THEN инструмент MUST вернуть отказ с причиной, а не данные другой истории

### Requirement: Предложение правки соавтором
Инструмент создания предложения MUST принимать `uid` сцены, точную цитату из неё, предлагаемый текст и «зачем», проверять, что сцена есть в тексте сценария и цитата встречается в ней, и сохранять предложение со статусом `open` и беседой. Если сцены или цитаты нет, MUST возвращаться отказ с причиной, предложение MUST NOT сохраняться. Текст сценария инструмент MUST NOT менять.

#### Scenario: Цитаты нет
- GIVEN в сцене `s3` нет фразы «Вода холодная»
- WHEN соавтор предлагает правку с этой цитатой в сцене `s3`
- THEN инструмент MUST вернуть отказ «цитата не найдена в сцене», предложения MUST NOT появиться

#### Scenario: Предложение создано
- GIVEN в сцене `s3` есть фраза «Вера молчит»
- WHEN соавтор предлагает заменить её на «Вера отворачивается»
- THEN `GET /api/v1/documents/{id}/suggestions?status=open` MUST вернуть это предложение
- AND ревизия текста сценария MUST NOT измениться

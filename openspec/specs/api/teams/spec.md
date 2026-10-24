# Teams API Specification

## Purpose
Команды агентов. В репозитории единственная команда — встроенный OS Manager.

Домен содержит 11 операций HTTP (теги OpenAPI: Teams). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: OS Manager
`GET /teams` MUST возвращать команду `os-manager-internal` (`OS Manager`) в режиме `coordinate` с моделью `claude-opus-5-5` и участниками `platform-builder-internal`, `platform-manager-internal`, `company-manager-internal`. Команду MUST создавать Agno через `OSManager(root=agentos_root, model=manager_model(), learning=shared_learning)`; репозиторий MUST NOT объявлять собственных команд (каталога `teams/` нет). Участников `platform-builder-internal` и `platform-manager-internal` определяет Agno; их назначение и поведение описаны в документации Agno (https://docs.agno.com/agent-platform/overview, https://docs.agno.com/agent-platform/run-local) и здесь не дублируются.

#### Scenario: Неизвестная команда
- GIVEN команды `nope` не существует
- WHEN клиент выполняет `GET /teams/nope`
- THEN система MUST вернуть `404`

### Requirement: POST /teams/{team_id}/runs
Система MUST выполнять операцию «Create Team Run» по запросу `POST /teams/{team_id}/runs` (operationId `create_team_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)

Тело запроса (`multipart/form-data`, схема `Body_create_team_run`):
- `message`: string, обязательное
- `stream`: boolean, по умолчанию `true`
- `monitor`: boolean, по умолчанию `true`
- `session_id`: string | null
- `user_id`: string | null
- `files`: array[string] | null
- `files_metadata`: string | null
- `version`: integer | null
- `background`: boolean, по умолчанию `false`
- `factory_input`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /teams/{team_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request or unsupported file type»
- WHEN клиент выполняет `POST /teams/{team_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /teams/{team_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `POST /teams/{team_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: GET /teams/{team_id}/runs
Система MUST возвращать операцию «List Team Runs» по запросу `GET /teams/{team_id}/runs` (operationId `list_team_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)
- `status` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams/{team_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /teams/{team_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams/{team_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `GET /teams/{team_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: POST /teams/{team_id}/runs/{run_id}/cancel
Система MUST выполнять операцию «Cancel Team Run» по запросу `POST /teams/{team_id}/runs/{run_id}/cancel` (operationId `cancel_team_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to cancel team run»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `500`

### Requirement: POST /teams/{team_id}/runs/{run_id}/resume
Система MUST выполнять операцию «Resume Team Run Stream» по запросу `POST /teams/{team_id}/runs/{run_id}/resume` (operationId `resume_team_run_stream`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_resume_team_run_stream`):
- `last_event_index`: integer | null
- `session_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Not supported for remote teams»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `500`

### Requirement: POST /teams/{team_id}/runs/{run_id}/continue
Система MUST выполнять операцию «Continue Team Run» по запросу `POST /teams/{team_id}/runs/{run_id}/continue` (operationId `continue_team_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_continue_team_run`):
- `requirements`: string, по умолчанию `""`
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
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid JSON in requirements field or invalid requirement structure»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 403
- GIVEN выполняется условие ошибки «Run has a pending admin approval and cannot be continued by the user yet.»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `403`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 409
- GIVEN выполняется условие ошибки «Continuation conflict: a durable queue ticket owns this run's continuation (continue it with background=true), or a continuation is already queued or executing. Runs in any state can be continued - a COMPLETED run forks into a follow-up; RUNNING/ERROR runs resume.»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `409`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /teams/{team_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `500`

### Requirement: POST /teams/{team_id}/sessions/{session_id}/fork
Система MUST выполнять операцию «Fork Team Session» по запросу `POST /teams/{team_id}/sessions/{session_id}/fork` (operationId `fork_team_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `session_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Source session is empty or missing»
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /teams/{team_id}/sessions/{session_id}/fork`
- THEN система MUST вернуть `500`

### Requirement: GET /teams
Система MUST возвращать операцию «List All Teams» по запросу `GET /teams` (operationId `get_teams`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[TeamResponse]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /teams`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /teams`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams`
- THEN система MUST вернуть `500`

### Requirement: GET /teams/{team_id}
Система MUST возвращать операцию «Get Team Details» по запросу `GET /teams/{team_id}` (operationId `get_team`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams/{team_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `TeamResponse`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /teams/{team_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams/{team_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team not found»
- WHEN клиент выполняет `GET /teams/{team_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams/{team_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams/{team_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /teams/{team_id}/runs/{run_id}
Система MUST возвращать операцию «Get Team Run» по запросу `GET /teams/{team_id}/runs/{run_id}` (operationId `get_team_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team or run not found»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /teams/{team_id}/runs/{run_id}/checkpoints
Система MUST возвращать операцию «List Team Run Checkpoints» по запросу `GET /teams/{team_id}/runs/{run_id}/checkpoints` (operationId `list_team_run_checkpoints`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team or run not found»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints`
- THEN система MUST вернуть `500`

### Requirement: GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}
Система MUST возвращать операцию «Get Team Run Checkpoint Snapshot» по запросу `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}` (operationId `get_team_run_checkpoint_snapshot`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `team_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `message_index` (path, integer, обязательный)
- `session_id` (query, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid checkpoint message index»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Team or run not found»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}`
- THEN система MUST вернуть `500`

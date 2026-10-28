# Sessions API Specification

## Purpose
Сессии (диалоги) агентов и команд, хранящиеся в таблице `agno_sessions` БД `agentos-db`.

Домен содержит 10 операций HTTP (теги OpenAPI: Sessions). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Изоляция сессий по пользователю
Система MUST включать `user_isolation=True`: данные сессий MUST разделяться по `user_id` аутентифицированного пользователя.

#### Scenario: Неизвестная сессия
- GIVEN сессии `nope` не существует
- WHEN клиент выполняет `GET /sessions/nope`
- THEN система MUST вернуть `404`

### Requirement: GET /sessions
Система MUST возвращать операцию «List Sessions» по запросу `GET /sessions` (operationId `get_sessions`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `component_id` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `session_name` (query, string | null, необязательный)
- `limit` (query, integer | null, необязательный)
- `page` (query, integer | null, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_SessionSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid session type or filter parameters»
- WHEN клиент выполняет `GET /sessions`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /sessions`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not found»
- WHEN клиент выполняет `GET /sessions`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error in query parameters»
- WHEN клиент выполняет `GET /sessions`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /sessions`
- THEN система MUST вернуть `500`

### Requirement: POST /sessions
Система MUST выполнять операцию «Create New Session» по запросу `POST /sessions` (operationId `create_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `type` (query, SessionType (agent | team | workflow), необязательный)
- `db_id` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `CreateSessionRequest`):
- `session_id`: string | null
- `session_name`: string | null
- `session_state`: object | null
- `metadata`: object | null
- `user_id`: string | null
- `agent_id`: string | null
- `team_id`: string | null
- `workflow_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /sessions` с корректными параметрами
- THEN система MUST вернуть `201`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request parameters»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 409
- GIVEN выполняется условие ошибки «A session with the supplied session_id already exists»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `409`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to create session»
- WHEN клиент выполняет `POST /sessions`
- THEN система MUST вернуть `500`

### Requirement: DELETE /sessions
Система MUST удалять операцию «Delete Multiple Sessions» по запросу `DELETE /sessions` (operationId `delete_sessions`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `delete_media` (query, boolean, необязательный)

Тело запроса (`application/json`, схема `DeleteSessionRequest`):
- `session_ids`: array[string], обязательное
- `session_types`: array[SessionType (agent | team | workflow)], обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /sessions` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - session IDs and types length mismatch»
- WHEN клиент выполняет `DELETE /sessions`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /sessions`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /sessions`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /sessions`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete sessions»
- WHEN клиент выполняет `DELETE /sessions`
- THEN система MUST вернуть `500`

### Requirement: GET /sessions/{session_id}
Система MUST возвращать операцию «Get Session by ID» по запросу `GET /sessions/{session_id}` (operationId `get_session_by_id`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /sessions/{session_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /sessions/{session_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session not found»
- WHEN клиент выполняет `GET /sessions/{session_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid session type»
- WHEN клиент выполняет `GET /sessions/{session_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /sessions/{session_id}`
- THEN система MUST вернуть `500`

### Requirement: DELETE /sessions/{session_id}
Система MUST удалять операцию «Delete Session» по запросу `DELETE /sessions/{session_id}` (operationId `delete_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `delete_media` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /sessions/{session_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /sessions/{session_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /sessions/{session_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /sessions/{session_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete session»
- WHEN клиент выполняет `DELETE /sessions/{session_id}`
- THEN система MUST вернуть `500`

### Requirement: PATCH /sessions/{session_id}
Система MUST обновлять операцию «Update Session» по запросу `PATCH /sessions/{session_id}` (operationId `update_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `UpdateSessionRequest`):
- `session_name`: string | null
- `session_state`: object | null
- `metadata`: object | null
- `summary`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `PATCH /sessions/{session_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /sessions/{session_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session not found»
- WHEN клиент выполняет `PATCH /sessions/{session_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid request»
- WHEN клиент выполняет `PATCH /sessions/{session_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to update session»
- WHEN клиент выполняет `PATCH /sessions/{session_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /sessions/{session_id}/runs
Система MUST возвращать операцию «Get Session Runs» по запросу `GET /sessions/{session_id}/runs` (operationId `get_session_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `created_after` (query, integer | null, необязательный)
- `created_before` (query, integer | null, необязательный)
- `status` (query, array[string] | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions/{session_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session not found or has no runs»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid session type»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: GET /sessions/{session_id}/run-previews
Система MUST возвращать операцию «Get Session Run Previews» по запросу `GET /sessions/{session_id}/run-previews` (operationId `get_session_run_previews`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `created_after` (query, integer | null, необязательный)
- `created_before` (query, integer | null, необязательный)
- `status` (query, array[string] | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[SessionRunPreviewSchema]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session not found»
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid session type»
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /sessions/{session_id}/run-previews`
- THEN система MUST вернуть `500`

### Requirement: GET /sessions/{session_id}/runs/{run_id}
Система MUST возвращать операцию «Get Run by ID» по запросу `GET /sessions/{session_id}/runs/{run_id}` (operationId `get_session_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session or run not found»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid session type»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /sessions/{session_id}/runs/{run_id}`
- THEN система MUST вернуть `500`

### Requirement: POST /sessions/{session_id}/rename
Система MUST выполнять операцию «Rename Session» по запросу `POST /sessions/{session_id}/rename` (operationId `rename_session`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `session_id` (path, string, обязательный)
- `type` (query, SessionType (agent | team | workflow) | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `Body_rename_session`):
- `session_name`: string, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /sessions/{session_id}/rename` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid session name»
- WHEN клиент выполняет `POST /sessions/{session_id}/rename`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /sessions/{session_id}/rename`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Session not found»
- WHEN клиент выполняет `POST /sessions/{session_id}/rename`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Invalid session type or validation error»
- WHEN клиент выполняет `POST /sessions/{session_id}/rename`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /sessions/{session_id}/rename`
- THEN система MUST вернуть `500`

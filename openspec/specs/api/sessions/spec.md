# API `sessions` Specification

## Purpose
Сессии диалогов, их запуски и сохранённые медиафайлы.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /sessions — List Sessions
Система MUST предоставлять эндпоинт `GET /sessions` (operationId `get_sessions`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Retrieve paginated list of sessions with filtering and sorting options. Supports filtering by session type (agent, team, workflow), component, user, and name. Sessions represent conversation histories and execution contexts.»

Query-параметры: `type`, `component_id`, `user_id`, `session_name`, `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions` с корректными параметрами
- THEN система MUST вернуть статус `200` («Sessions retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid session type or filter parameters»
- THEN система MUST вернуть статус `400` («Invalid session type or filter parameters»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Not found»
- THEN система MUST вернуть статус `404` («Not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation error in query parameters»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /sessions — Create New Session
Система MUST предоставлять эндпоинт `POST /sessions` (operationId `create_session`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Create a new empty session with optional configuration. Useful for pre-creating sessions with specific session_state, metadata, or other properties before running any agent/team/workflow interactions. The session can later be used by providing its session_id in run requests.»

Query-параметры: `type`, `db_id`.

Тело запроса: `application/json`, схема `CreateSessionRequest`. Поля: `session_id`, `session_name`, `session_state`, `metadata`, `user_id`, `agent_id`, `team_id`, `workflow_id`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /sessions` с корректными параметрами
- THEN система MUST вернуть статус `201` («Session created successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request parameters»
- THEN система MUST вернуть статус `400` («Invalid request parameters»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Not Found»
- THEN система MUST вернуть статус `404` («Not Found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to create session»
- THEN система MUST вернуть статус `500` («Failed to create session»)

#### Scenario: Ответ 409
- GIVEN платформа запущена
- WHEN условие ошибки: «A session with the supplied session_id already exists»
- THEN система MUST вернуть статус `409` («A session with the supplied session_id already exists»)

### Requirement: DELETE /sessions — Delete Multiple Sessions
Система MUST предоставлять эндпоинт `DELETE /sessions` (operationId `delete_sessions`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Delete multiple sessions by their IDs in a single operation. This action cannot be undone and will permanently remove all specified sessions and their runs.»

Query-параметры: `user_id`, `db_id`, `table`, `delete_media`.

Тело запроса: `application/json`, схема `DeleteSessionRequest`, обязательное. Поля: `session_ids` (обязательное), `session_types` (обязательное).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /sessions` с корректными параметрами
- THEN система MUST вернуть статус `204` («Sessions deleted successfully»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - session IDs and types length mismatch»
- THEN система MUST вернуть статус `400` («Invalid request - session IDs and types length mismatch»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Not Found»
- THEN система MUST вернуть статус `404` («Not Found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to delete sessions»
- THEN система MUST вернуть статус `500` («Failed to delete sessions»)

### Requirement: GET /sessions/{session_id} — Get Session by ID
Система MUST предоставлять эндпоинт `GET /sessions/{session_id}` (operationId `get_session_by_id`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Retrieve detailed information about a specific session including metadata, configuration, and run history. Response schema varies based on session type (agent, team, or workflow).»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Session details retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session not found»
- THEN система MUST вернуть статус `404` («Session not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid session type»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: DELETE /sessions/{session_id} — Delete Session
Система MUST предоставлять эндпоинт `DELETE /sessions/{session_id}` (operationId `delete_session`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Permanently delete a specific session and all its associated runs. This action cannot be undone and will remove all conversation history.»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`, `db_id`, `table`, `delete_media`.

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Not Found»
- THEN система MUST вернуть статус `404` («Not Found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to delete session»
- THEN система MUST вернуть статус `500` («Failed to delete session»)

### Requirement: PATCH /sessions/{session_id} — Update Session
Система MUST предоставлять эндпоинт `PATCH /sessions/{session_id}` (operationId `update_session`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Update session properties such as session_name, session_state, metadata, or summary. Use this endpoint to modify the session name, update state, add metadata, or update the session summary.»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `db_id`, `table`.

Тело запроса: `application/json`, схема `UpdateSessionRequest`, обязательное. Поля: `session_name`, `session_state`, `metadata`, `summary`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /sessions/{session_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Session updated successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session not found»
- THEN система MUST вернуть статус `404` («Session not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid request»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to update session»
- THEN система MUST вернуть статус `500` («Failed to update session»)

### Requirement: GET /sessions/{session_id}/runs — Get Session Runs
Система MUST предоставлять эндпоинт `GET /sessions/{session_id}/runs` (operationId `get_session_runs`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Retrieve all runs (executions) for a specific session with optional timestamp and status filtering. Repeat the status param to match any of several (case-insensitive; e.g. status=PENDING&status=RUNNING&status=PAUSED is the live set a queue tray shows). Response schema varies based on session type. F…»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `created_after`, `created_before`, `status`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions/{session_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Session runs retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session not found or has no runs»
- THEN система MUST вернуть статус `404` («Session not found or has no runs»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid session type»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /sessions/{session_id}/run-previews — Get Session Run Previews
Система MUST предоставлять эндпоинт `GET /sessions/{session_id}/run-previews` (operationId `get_session_run_previews`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Lightweight listing of a session's runs for polling clients such as a queue tray: ids, status, timestamps and truncated input/output previews, without messages, events, media or metrics. Accepts the same filters as GET /sessions/{session_id}/runs.»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `created_after`, `created_before`, `status`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions/{session_id}/run-previews` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session not found»
- THEN система MUST вернуть статус `404` («Session not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid session type»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /sessions/{session_id}/runs/{run_id} — Get Run by ID
Система MUST предоставлять эндпоинт `GET /sessions/{session_id}/runs/{run_id}` (operationId `get_session_run`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Retrieve a specific run by its ID from a session. Response schema varies based on the run type (agent run, team run, or workflow run).»

Path-параметры: `session_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions/{session_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Run retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad Request»
- THEN система MUST вернуть статус `400` («Bad Request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session or run not found»
- THEN система MUST вернуть статус `404` («Session or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid session type»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /sessions/{session_id}/rename — Rename Session
Система MUST предоставлять эндпоинт `POST /sessions/{session_id}/rename` (operationId `rename_session`, раздел OpenAPI «Sessions»).

Описание в OpenAPI: «Update the name of an existing session. Useful for organizing and categorizing sessions with meaningful names for better identification and management.»

Path-параметры: `session_id` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `db_id`, `table`.

Тело запроса: `application/json`, схема `Body_rename_session`, обязательное. Поля: `session_name` (обязательное).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /sessions/{session_id}/rename` с корректными параметрами
- THEN система MUST вернуть статус `200` («Session renamed successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid session name»
- THEN система MUST вернуть статус `400` («Invalid session name»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session not found»
- THEN система MUST вернуть статус `404` («Session not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Invalid session type or validation error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /sessions/{session_id}/media/{storage_key} — Fetch stored media for a session
Система MUST предоставлять эндпоинт `GET /sessions/{session_id}/media/{storage_key}` (operationId `get_session_media`, раздел OpenAPI «Media»).

Описание в OpenAPI: «Stream (or, with redirect=true, redirect to a freshly-signed URL for) a piece of media stored in external media storage. Scoped to the caller's session ownership; the storage_key must belong to the session.»

Path-параметры: `session_id`, `storage_key` — MUST быть заданы (обязательные).

Query-параметры: `type`, `user_id`, `db_id`, `table`, `redirect`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /sessions/{session_id}/media/{storage_key}` с корректными параметрами
- THEN система MUST вернуть статус `200` («The media bytes, served with the stored mime type»)
- AND формат содержимого ответа: `application/json`, `application/octet-stream`

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthenticated»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Session or media not found»
- THEN система MUST вернуть статус `404` («Session or media not found»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Media storage could not be reached»
- THEN система MUST вернуть статус `500` («Media storage could not be reached»)

#### Scenario: Ответ 501
- GIVEN платформа запущена
- WHEN условие ошибки: «Remote databases are not supported»
- THEN система MUST вернуть статус `501` («Remote databases are not supported»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «Media storage is not configured»
- THEN система MUST вернуть статус `503` («Media storage is not configured»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

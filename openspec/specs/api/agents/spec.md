# API `agents` Specification

## Purpose
Запуск и управление агентами AgentOS: запуски (runs), чекпоинты, форк и компактация сессий.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: POST /agents/{agent_id}/runs — Create Agent Run
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/runs` (operationId `create_agent_run`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Execute an agent with a message and optional media files. Supports both streaming and non-streaming responses.»

Path-параметры: `agent_id` — MUST быть заданы (обязательные).

Тело запроса: `multipart/form-data`, схема `Body_create_agent_run`, обязательное. Поля: `message` (обязательное), `stream`, `session_id`, `user_id`, `files`, `files_metadata`, `version`, `background`, `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Agent run executed successfully»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request or unsupported file type»
- THEN система MUST вернуть статус `400` («Invalid request or unsupported file type»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents/{agent_id}/runs — List Agent Runs
Система MUST предоставлять эндпоинт `GET /agents/{agent_id}/runs` (operationId `list_agent_runs`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «List runs for an agent within a session, optionally filtered by status.»

Path-параметры: `agent_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный), `status`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents/{agent_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («List of runs retrieved successfully»)
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
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /agents/{agent_id}/runs/{run_id}/cancel — Cancel Agent Run
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/runs/{run_id}/cancel` (operationId `cancel_agent_run`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Cancel a currently executing agent run. This will attempt to stop the agent's execution gracefully.»

Path-параметры: `agent_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/runs/{run_id}/cancel` с корректными параметрами
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
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to cancel run»
- THEN система MUST вернуть статус `500` («Failed to cancel run»)

### Requirement: POST /agents/{agent_id}/runs/{run_id}/continue — Continue Agent Run
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/runs/{run_id}/continue` (operationId `continue_agent_run`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Advance a persisted agent run from its current state. Dispatches on the body shape and the persisted run state.»

Path-параметры: `agent_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_continue_agent_run`. Поля: `tools`, `input`, `continue_from`, `fork`, `regenerate`, `replace_original`, `additional_instructions`, `session_id`, `user_id`, `stream`, `background`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть статус `200` («Agent run continued successfully»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid JSON in tools field or invalid tool structure»
- THEN система MUST вернуть статус `400` («Invalid JSON in tools field or invalid tool structure»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 403
- GIVEN платформа запущена
- WHEN условие ошибки: «Run has a pending admin approval and cannot be continued by the user yet.»
- THEN система MUST вернуть статус `403` («Run has a pending admin approval and cannot be continued by the user yet.»)

#### Scenario: Ответ 409
- GIVEN платформа запущена
- WHEN условие ошибки: «Continuation conflict: a durable queue ticket owns this run's continuation (continue it with background=true), or a continuation is already queued or executing. Runs in any state can be continued - a COMPLETED run forks into a follow-up; RUNNING/ERROR runs resume.»
- THEN система MUST вернуть статус `409` («Continuation conflict: a durable queue ticket owns this run's continuation (continue it with background=true), or a continuation is already queued or executing. Runs in any state can be continued - a COMPLETED run forks into a follow-up; RUNNING/ERROR runs resume.»)

### Requirement: POST /agents/{agent_id}/sessions/{session_id}/fork — Fork Agent Session
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/sessions/{session_id}/fork` (operationId `fork_agent_session`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Deep-copy a session into a new independent session. Every run is copied with a fresh ``run_id``; the new session has a fresh ``session_id``. The original is untouched. Use to explore alternative conversation paths without mutating the source.»

Path-параметры: `agent_id`, `session_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/sessions/{session_id}/fork` с корректными параметрами
- THEN система MUST вернуть статус `200` («Session forked successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Source session is empty or missing»
- THEN система MUST вернуть статус `400` («Source session is empty or missing»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /agents/{agent_id}/sessions/{session_id}/compact — Compact Agent Session
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/sessions/{session_id}/compact` (operationId `compact_agent_session`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Fold this session's older history into a summary now, without waiting for the context to reach ``compact_at_tokens``. The stored transcript is never modified - compaction shortens what is sent to the model, not the record.»

Path-параметры: `agent_id`, `session_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/sessions/{session_id}/compact` с корректными параметрами
- THEN система MUST вернуть статус `200` («Compaction attempted; see status for the outcome»)
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
- WHEN условие ошибки: «Agent or session not found»
- THEN система MUST вернуть статус `404` («Agent or session not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents — List All Agents
Система MUST предоставлять эндпоинт `GET /agents` (operationId `get_agents`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Retrieve a comprehensive list of all agents configured in this OS instance.»

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents` с корректными параметрами
- THEN система MUST вернуть статус `200` («List of agents retrieved successfully»)
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
- WHEN условие ошибки: «Not Found»
- THEN система MUST вернуть статус `404` («Not Found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents/{agent_id} — Get Agent Details
Система MUST предоставлять эндпоинт `GET /agents/{agent_id}` (operationId `get_agent`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Retrieve detailed configuration and capabilities of a specific agent.»

Path-параметры: `agent_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents/{agent_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Agent details retrieved successfully»)
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
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents/{agent_id}/runs/{run_id} — Get Agent Run
Система MUST предоставлять эндпоинт `GET /agents/{agent_id}/runs/{run_id}` (operationId `get_agent_run`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Retrieve the status and output of an agent run. Use this to poll for background run completion.»

Path-параметры: `agent_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents/{agent_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Run output retrieved successfully»)
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
- WHEN условие ошибки: «Agent or run not found»
- THEN система MUST вернуть статус `404` («Agent or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents/{agent_id}/runs/{run_id}/checkpoints — List Agent Run Checkpoints
Система MUST предоставлять эндпоинт `GET /agents/{agent_id}/runs/{run_id}/checkpoints` (operationId `list_agent_run_checkpoints`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «List FE-friendly continuation boundaries derived from the current stored run. No separate checkpoint table is used; entries are inferred from message-level checkpoint markers and the terminal end of the transcript.»

Path-параметры: `agent_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents/{agent_id}/runs/{run_id}/checkpoints` с корректными параметрами
- THEN система MUST вернуть статус `200` («Run checkpoints retrieved successfully»)
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
- WHEN условие ошибки: «Agent or run not found»
- THEN система MUST вернуть статус `404` («Agent or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index} — Get Agent Run Checkpoint Snapshot
Система MUST предоставлять эндпоинт `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}` (operationId `get_agent_run_checkpoint_snapshot`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Return a derived run snapshot truncated at a message boundary. Use the returned message_index as `continue_from` when continuing this run.»

Path-параметры: `agent_id`, `run_id`, `message_index` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /agents/{agent_id}/runs/{run_id}/checkpoints/{message_index}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Run checkpoint snapshot retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid checkpoint message index»
- THEN система MUST вернуть статус `400` («Invalid checkpoint message index»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent or run not found»
- THEN система MUST вернуть статус `404` («Agent or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /agents/{agent_id}/runs/{run_id}/resume — Resume Agent Run Stream
Система MUST предоставлять эндпоинт `POST /agents/{agent_id}/runs/{run_id}/resume` (operationId `resume_agent_run_stream`, раздел OpenAPI «Agents»).

Описание в OpenAPI: «Resume an SSE stream for an agent run after disconnection.»

Path-параметры: `agent_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_resume_agent_run_stream`. Поля: `last_event_index`, `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /agents/{agent_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть статус `200` («SSE stream of catch-up and/or live events»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Not supported for remote agents»
- THEN система MUST вернуть статус `400` («Not supported for remote agents»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent not found»
- THEN система MUST вернуть статус `404` («Agent not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

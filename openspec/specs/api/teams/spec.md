# API `teams` Specification

## Purpose
Запуск и управление командами агентов (teams), в том числе OS Manager.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: POST /teams/{team_id}/runs — Create Team Run
Система MUST предоставлять эндпоинт `POST /teams/{team_id}/runs` (operationId `create_team_run`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Execute a team collaboration with multiple agents working together on a task.»

Path-параметры: `team_id` — MUST быть заданы (обязательные).

Тело запроса: `multipart/form-data`, схема `Body_create_team_run`, обязательное. Поля: `message` (обязательное), `stream`, `monitor`, `session_id`, `user_id`, `files`, `files_metadata`, `version`, `background`, `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /teams/{team_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Team run executed successfully»)
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
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /teams/{team_id}/runs — List Team Runs
Система MUST предоставлять эндпоинт `GET /teams/{team_id}/runs` (operationId `list_team_runs`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «List runs for a team within a session, optionally filtered by status.»

Path-параметры: `team_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный), `status`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams/{team_id}/runs` с корректными параметрами
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
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /teams/{team_id}/runs/{run_id}/cancel — Cancel Team Run
Система MUST предоставлять эндпоинт `POST /teams/{team_id}/runs/{run_id}/cancel` (operationId `cancel_team_run`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Cancel a currently executing team run. This will attempt to stop the team's execution gracefully.»

Path-параметры: `team_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /teams/{team_id}/runs/{run_id}/cancel` с корректными параметрами
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
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to cancel team run»
- THEN система MUST вернуть статус `500` («Failed to cancel team run»)

### Requirement: POST /teams/{team_id}/runs/{run_id}/resume — Resume Team Run Stream
Система MUST предоставлять эндпоинт `POST /teams/{team_id}/runs/{run_id}/resume` (operationId `resume_team_run_stream`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Resume an SSE stream for a team run after disconnection.»

Path-параметры: `team_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_resume_team_run_stream`. Поля: `last_event_index`, `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /teams/{team_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть статус `200` («SSE stream of catch-up and/or live events»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Not supported for remote teams»
- THEN система MUST вернуть статус `400` («Not supported for remote teams»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /teams/{team_id}/runs/{run_id}/continue — Continue Team Run
Система MUST предоставлять эндпоинт `POST /teams/{team_id}/runs/{run_id}/continue` (operationId `continue_team_run`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Continue a paused or incomplete team run with updated requirements.»

Path-параметры: `team_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_continue_team_run`. Поля: `requirements`, `input`, `continue_from`, `fork`, `regenerate`, `replace_original`, `additional_instructions`, `session_id`, `user_id`, `stream`, `background`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /teams/{team_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть статус `200` («Team run continued successfully»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid JSON in requirements field or invalid requirement structure»
- THEN система MUST вернуть статус `400` («Invalid JSON in requirements field or invalid requirement structure»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

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

### Requirement: POST /teams/{team_id}/sessions/{session_id}/fork — Fork Team Session
Система MUST предоставлять эндпоинт `POST /teams/{team_id}/sessions/{session_id}/fork` (operationId `fork_team_session`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Deep-copy a team session into a new independent session. Every run is copied with a fresh ``run_id``; the new session has a fresh ``session_id``. The original is untouched. Use to explore alternative conversation paths without mutating the source.»

Path-параметры: `team_id`, `session_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /teams/{team_id}/sessions/{session_id}/fork` с корректными параметрами
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
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /teams — List All Teams
Система MUST предоставлять эндпоинт `GET /teams` (operationId `get_teams`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Retrieve a comprehensive list of all teams configured in this OS instance.»

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams` с корректными параметрами
- THEN система MUST вернуть статус `200` («List of teams retrieved successfully»)
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

### Requirement: GET /teams/{team_id} — Get Team Details
Система MUST предоставлять эндпоинт `GET /teams/{team_id}` (operationId `get_team`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Retrieve detailed configuration and member information for a specific team.»

Path-параметры: `team_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams/{team_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Team details retrieved successfully»)
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
- WHEN условие ошибки: «Team not found»
- THEN система MUST вернуть статус `404` («Team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /teams/{team_id}/runs/{run_id} — Get Team Run
Система MUST предоставлять эндпоинт `GET /teams/{team_id}/runs/{run_id}` (operationId `get_team_run`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Retrieve the status and output of a team run. Use this to poll for background run completion.»

Path-параметры: `team_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams/{team_id}/runs/{run_id}` с корректными параметрами
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
- WHEN условие ошибки: «Team or run not found»
- THEN система MUST вернуть статус `404` («Team or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /teams/{team_id}/runs/{run_id}/checkpoints — List Team Run Checkpoints
Система MUST предоставлять эндпоинт `GET /teams/{team_id}/runs/{run_id}/checkpoints` (operationId `list_team_run_checkpoints`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «List FE-friendly continuation boundaries derived from the current stored team run. No separate checkpoint table is used; entries are inferred from message-level checkpoint markers and the terminal end of the transcript.»

Path-параметры: `team_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams/{team_id}/runs/{run_id}/checkpoints` с корректными параметрами
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
- WHEN условие ошибки: «Team or run not found»
- THEN система MUST вернуть статус `404` («Team or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index} — Get Team Run Checkpoint Snapshot
Система MUST предоставлять эндпоинт `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}` (operationId `get_team_run_checkpoint_snapshot`, раздел OpenAPI «Teams»).

Описание в OpenAPI: «Return a derived team run snapshot truncated at a message boundary. Use the returned message_index as `continue_from` when continuing this run.»

Path-параметры: `team_id`, `run_id`, `message_index` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /teams/{team_id}/runs/{run_id}/checkpoints/{message_index}` с корректными параметрами
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
- WHEN условие ошибки: «Team or run not found»
- THEN система MUST вернуть статус `404` («Team or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

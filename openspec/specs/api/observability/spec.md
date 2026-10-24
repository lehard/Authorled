# API `observability` Specification

## Purpose
Оценки качества (evals), метрики и трассировки запусков (`tracing=True`).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /eval-runs — List Evaluation Runs
Система MUST предоставлять эндпоинт `GET /eval-runs` (operationId `get_eval_runs`, раздел OpenAPI «Evals»).

Описание в OpenAPI: «Retrieve paginated evaluation runs with filtering and sorting options. Filter by agent, team, workflow, model, or evaluation type.»

Query-параметры: `agent_id`, `team_id`, `workflow_id`, `model_id`, `type`, `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `table`, `eval_types`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /eval-runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Evaluation runs retrieved successfully»)
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

### Requirement: DELETE /eval-runs — Delete Evaluation Runs
Система MUST предоставлять эндпоинт `DELETE /eval-runs` (operationId `delete_eval_runs`, раздел OpenAPI «Evals»).

Описание в OpenAPI: «Delete multiple evaluation runs by their IDs. This action cannot be undone.»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `DeleteEvalRunsRequest`, обязательное. Поля: `eval_run_ids` (обязательное).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /eval-runs` с корректными параметрами
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
- WHEN условие ошибки: «Failed to delete evaluation runs»
- THEN система MUST вернуть статус `500` («Failed to delete evaluation runs»)

### Requirement: POST /eval-runs — Execute Evaluation
Система MUST предоставлять эндпоинт `POST /eval-runs` (operationId `run_eval`, раздел OpenAPI «Evals»).

Описание в OpenAPI: «Run evaluation tests on agents or teams. Supports accuracy, agent-as-judge, performance, and reliability evaluations. Requires either agent_id or team_id, but not both.»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `EvalRunInput`, обязательное. Поля: `agent_id`, `team_id`, `model_id`, `model_provider`, `eval_type` (обязательное), `input` (обязательное), `additional_guidelines`, `additional_context`, `num_iterations`, `name`, `expected_output`, `criteria`, `scoring_strategy`, `threshold`, `warmup_runs`, `expected_tool_calls`, `allow_additional_tool_calls`, `expected_tool_call_arguments`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /eval-runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Evaluation executed successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - provide either agent_id or team_id»
- THEN система MUST вернуть статус `400` («Invalid request - provide either agent_id or team_id»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Agent or team not found»
- THEN система MUST вернуть статус `404` («Agent or team not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /eval-runs/{eval_run_id} — Get Evaluation Run
Система MUST предоставлять эндпоинт `GET /eval-runs/{eval_run_id}` (operationId `get_eval_run`, раздел OpenAPI «Evals»).

Описание в OpenAPI: «Retrieve detailed results and metrics for a specific evaluation run.»

Path-параметры: `eval_run_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /eval-runs/{eval_run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Evaluation run details retrieved successfully»)
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
- WHEN условие ошибки: «Evaluation run not found»
- THEN система MUST вернуть статус `404` («Evaluation run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: PATCH /eval-runs/{eval_run_id} — Update Evaluation Run
Система MUST предоставлять эндпоинт `PATCH /eval-runs/{eval_run_id}` (operationId `update_eval_run`, раздел OpenAPI «Evals»).

Описание в OpenAPI: «Update the name or other properties of an existing evaluation run.»

Path-параметры: `eval_run_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `UpdateEvalRunRequest`, обязательное. Поля: `name` (обязательное).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /eval-runs/{eval_run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Evaluation run updated successfully»)
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
- WHEN условие ошибки: «Evaluation run not found»
- THEN система MUST вернуть статус `404` («Evaluation run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to update evaluation run»
- THEN система MUST вернуть статус `500` («Failed to update evaluation run»)

### Requirement: GET /metrics — Get AgentOS Metrics
Система MUST предоставлять эндпоинт `GET /metrics` (operationId `get_metrics`, раздел OpenAPI «Metrics»).

Описание в OpenAPI: «Retrieve AgentOS metrics and analytics data for a specified date range. If no date range is specified, returns all available metrics.»

Query-параметры: `starting_date`, `ending_date`, `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /metrics` с корректными параметрами
- THEN система MUST вернуть статус `200` («Metrics retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid date range parameters»
- THEN система MUST вернуть статус `400` («Invalid date range parameters»)

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
- WHEN условие ошибки: «Failed to retrieve metrics»
- THEN система MUST вернуть статус `500` («Failed to retrieve metrics»)

### Requirement: POST /metrics/refresh — Refresh Metrics
Система MUST предоставлять эндпоинт `POST /metrics/refresh` (operationId `refresh_metrics`, раздел OpenAPI «Metrics»).

Описание в OpenAPI: «Manually trigger recalculation of system metrics from raw data. This operation analyzes system activity logs and regenerates aggregated metrics. Useful for ensuring metrics are up-to-date or after system maintenance. By default the refresh runs synchronously and returns the refreshed metrics. Pass b…»

Query-параметры: `db_id`, `table`, `user_id`, `background`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /metrics/refresh` с корректными параметрами
- THEN система MUST вернуть статус `200` («Metrics refreshed successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Успешный ответ 202
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /metrics/refresh` с корректными параметрами
- THEN система MUST вернуть статус `202` («Background refresh started»)
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
- WHEN условие ошибки: «Failed to refresh metrics»
- THEN система MUST вернуть статус `500` («Failed to refresh metrics»)

### Requirement: GET /metrics/refresh/status — Get Metrics Refresh Status
Система MUST предоставлять эндпоинт `GET /metrics/refresh/status` (operationId `get_metrics_refresh_status`, раздел OpenAPI «Metrics»).

Описание в OpenAPI: «Get the status of the most recent metrics refresh for the target database. Returns 'running' while a refresh is in progress, then 'completed' or 'failed' with the finish timestamp — the state updates even when a refresh completes without writing new data. Returns 'idle' if no refresh has been trigge…»

Query-параметры: `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /metrics/refresh/status` с корректными параметрами
- THEN система MUST вернуть статус `200` («Current refresh status»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request»
- THEN система MUST вернуть статус `400` («Invalid request»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Database not found»
- THEN система MUST вернуть статус `404` («Database not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to get refresh status»
- THEN система MUST вернуть статус `500` («Failed to get refresh status»)

### Requirement: GET /traces — List Traces
Система MUST предоставлять эндпоинт `GET /traces` (operationId `get_traces`, раздел OpenAPI «Traces»).

Описание в OpenAPI: «Retrieve a paginated list of execution traces with optional filtering.»

Query-параметры: `run_id`, `session_id`, `user_id`, `agent_id`, `team_id`, `workflow_id`, `status`, `start_time`, `end_time`, `page`, `limit`, `db_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /traces` с корректными параметрами
- THEN система MUST вернуть статус `200` («List of traces retrieved successfully»)
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

### Requirement: GET /traces/filter-schema — Get Trace Filter Schema
Система MUST предоставлять эндпоинт `GET /traces/filter-schema` (operationId `get_traces_filter_schema`, раздел OpenAPI «Traces»).

Описание в OpenAPI: «Returns the available filterable fields, their types, valid operators, and enum values.»

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /traces/filter-schema` с корректными параметрами
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

### Requirement: GET /traces/{trace_id} — Get Trace or Span Detail
Система MUST предоставлять эндпоинт `GET /traces/{trace_id}` (operationId `get_trace`, раздел OpenAPI «Traces»).

Описание в OpenAPI: «Retrieve detailed trace information with hierarchical span tree, or a specific span within the trace.»

Path-параметры: `trace_id` — MUST быть заданы (обязательные).

Query-параметры: `span_id`, `run_id`, `db_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /traces/{trace_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Trace or span detail retrieved successfully»)
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
- WHEN условие ошибки: «Trace or span not found»
- THEN система MUST вернуть статус `404` («Trace or span not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /trace_session_stats — Get Trace Statistics by Session
Система MUST предоставлять эндпоинт `GET /trace_session_stats` (operationId `get_trace_stats`, раздел OpenAPI «Traces»).

Описание в OpenAPI: «Retrieve aggregated trace statistics grouped by session ID with pagination.»

Query-параметры: `user_id`, `agent_id`, `team_id`, `workflow_id`, `start_time`, `end_time`, `page`, `limit`, `db_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /trace_session_stats` с корректными параметрами
- THEN система MUST вернуть статус `200` («Trace statistics retrieved successfully»)
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
- WHEN условие ошибки: «Failed to retrieve statistics»
- THEN система MUST вернуть статус `500` («Failed to retrieve statistics»)

### Requirement: POST /traces/search — Search Traces with Advanced Filters
Система MUST предоставлять эндпоинт `POST /traces/search` (operationId `search_traces`, раздел OpenAPI «Traces»).

Описание в OpenAPI: «Search traces using the FilterExpr DSL for complex, composable queries.»

Query-параметры: `db_id`.

Тело запроса: `application/json`, схема `TraceSearchRequest`, обязательное. Поля: `filter`, `group_by`, `page`, `limit`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /traces/search` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid filter expression»
- THEN система MUST вернуть статус `400` («Invalid filter expression»)

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

# Observability API Specification

## Purpose
Трассировка (`tracing=True`), метрики (`agno_metrics`) и результаты evals (`agno_eval_runs`).

Домен содержит 13 операций HTTP (теги OpenAPI: Traces, Metrics, Evals). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: GET /traces
Система MUST возвращать операцию «List Traces» по запросу `GET /traces` (operationId `get_traces`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `run_id` (query, string | null, необязательный)
- `session_id` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `workflow_id` (query, string | null, необязательный)
- `status` (query, string | null, необязательный)
- `start_time` (query, string | null, необязательный)
- `end_time` (query, string | null, необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)
- `db_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /traces` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_TraceSummary_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /traces`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /traces`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /traces`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /traces`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /traces`
- THEN система MUST вернуть `500`

### Requirement: GET /traces/filter-schema
Система MUST возвращать операцию «Get Trace Filter Schema» по запросу `GET /traces/filter-schema` (operationId `get_traces_filter_schema`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /traces/filter-schema` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `FilterSchemaResponse`
- AND тело MUST содержать поля `fields`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /traces/filter-schema`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /traces/filter-schema`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /traces/filter-schema`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /traces/filter-schema`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /traces/filter-schema`
- THEN система MUST вернуть `500`

### Requirement: GET /traces/{trace_id}
Система MUST возвращать операцию «Get Trace or Span Detail» по запросу `GET /traces/{trace_id}` (operationId `get_trace`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `trace_id` (path, string, обязательный)
- `span_id` (query, string | null, необязательный)
- `run_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /traces/{trace_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /traces/{trace_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /traces/{trace_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Trace or span not found»
- WHEN клиент выполняет `GET /traces/{trace_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /traces/{trace_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /traces/{trace_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /trace_session_stats
Система MUST возвращать операцию «Get Trace Statistics by Session» по запросу `GET /trace_session_stats` (operationId `get_trace_stats`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `workflow_id` (query, string | null, необязательный)
- `start_time` (query, string | null, необязательный)
- `end_time` (query, string | null, необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)
- `db_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /trace_session_stats` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_TraceSessionStats_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /trace_session_stats`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /trace_session_stats`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /trace_session_stats`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /trace_session_stats`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to retrieve statistics»
- WHEN клиент выполняет `GET /trace_session_stats`
- THEN система MUST вернуть `500`

### Requirement: POST /traces/search
Система MUST выполнять операцию «Search Traces with Advanced Filters» по запросу `POST /traces/search` (operationId `search_traces`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `TraceSearchRequest`):
- `filter`: object | null
- `group_by`: TraceSearchGroupBy (run | session), по умолчанию `"run"`
- `page`: integer, по умолчанию `1`
- `limit`: integer, по умолчанию `20`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /traces/search` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid filter expression»
- WHEN клиент выполняет `POST /traces/search`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /traces/search`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /traces/search`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /traces/search`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /traces/search`
- THEN система MUST вернуть `500`

### Requirement: GET /metrics
Система MUST возвращать операцию «Get AgentOS Metrics» по запросу `GET /metrics` (operationId `get_metrics`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `starting_date` (query, string | null, необязательный)
- `ending_date` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /metrics` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `MetricsResponse`
- AND тело MUST содержать поля `metrics`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid date range parameters»
- WHEN клиент выполняет `GET /metrics`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /metrics`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /metrics`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /metrics`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to retrieve metrics»
- WHEN клиент выполняет `GET /metrics`
- THEN система MUST вернуть `500`

### Requirement: POST /metrics/refresh
Система MUST выполнять операцию «Refresh Metrics» по запросу `POST /metrics/refresh` (operationId `refresh_metrics`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `background` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /metrics/refresh` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /metrics/refresh`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /metrics/refresh`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /metrics/refresh`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /metrics/refresh`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to refresh metrics»
- WHEN клиент выполняет `POST /metrics/refresh`
- THEN система MUST вернуть `500`

### Requirement: GET /metrics/refresh/status
Система MUST возвращать операцию «Get Metrics Refresh Status» по запросу `GET /metrics/refresh/status` (operationId `get_metrics_refresh_status`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /metrics/refresh/status` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `MetricsRefreshStatusResponse`
- AND тело MUST содержать поля `status`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request»
- WHEN клиент выполняет `GET /metrics/refresh/status`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /metrics/refresh/status`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Database not found»
- WHEN клиент выполняет `GET /metrics/refresh/status`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /metrics/refresh/status`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to get refresh status»
- WHEN клиент выполняет `GET /metrics/refresh/status`
- THEN система MUST вернуть `500`

### Requirement: GET /eval-runs
Система MUST возвращать операцию «List Evaluation Runs» по запросу `GET /eval-runs` (operationId `get_eval_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `workflow_id` (query, string | null, необязательный)
- `model_id` (query, string | null, необязательный)
- `type` (query, EvalFilterType (agent | team | workflow) | null, необязательный)
- `limit` (query, integer | null, необязательный)
- `page` (query, integer | null, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `eval_types` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /eval-runs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_EvalSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /eval-runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /eval-runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /eval-runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /eval-runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /eval-runs`
- THEN система MUST вернуть `500`

### Requirement: DELETE /eval-runs
Система MUST удалять операцию «Delete Evaluation Runs» по запросу `DELETE /eval-runs` (operationId `delete_eval_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `DeleteEvalRunsRequest`):
- `eval_run_ids`: array[string], обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /eval-runs` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /eval-runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /eval-runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /eval-runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /eval-runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete evaluation runs»
- WHEN клиент выполняет `DELETE /eval-runs`
- THEN система MUST вернуть `500`

### Requirement: POST /eval-runs
Система MUST выполнять операцию «Execute Evaluation» по запросу `POST /eval-runs` (operationId `run_eval`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `EvalRunInput`):
- `agent_id`: string | null
- `team_id`: string | null
- `model_id`: string | null
- `model_provider`: string | null
- `eval_type`: EvalType (accuracy | agent_as_judge | performance | reliability), обязательное
- `input`: string, обязательное
- `additional_guidelines`: string | null
- `additional_context`: string | null
- `num_iterations`: integer, по умолчанию `1`
- `name`: string | null
- `expected_output`: string | null
- `criteria`: string | null
- `scoring_strategy`: string (numeric | binary) | null, по умолчанию `"binary"`
- `threshold`: integer | null, по умолчанию `7`
- `warmup_runs`: integer, по умолчанию `0`
- `expected_tool_calls`: array[string] | null
- `allow_additional_tool_calls`: boolean, по умолчанию `false`
- `expected_tool_call_arguments`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /eval-runs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `EvalSchema`
- AND тело MUST содержать поля `id`, `eval_type`, `eval_data`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - provide either agent_id or team_id»
- WHEN клиент выполняет `POST /eval-runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /eval-runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Agent or team not found»
- WHEN клиент выполняет `POST /eval-runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /eval-runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /eval-runs`
- THEN система MUST вернуть `500`

### Requirement: GET /eval-runs/{eval_run_id}
Система MUST возвращать операцию «Get Evaluation Run» по запросу `GET /eval-runs/{eval_run_id}` (operationId `get_eval_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `eval_run_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `EvalSchema`
- AND тело MUST содержать поля `id`, `eval_type`, `eval_data`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Evaluation run not found»
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `500`

### Requirement: PATCH /eval-runs/{eval_run_id}
Система MUST обновлять операцию «Update Evaluation Run» по запросу `PATCH /eval-runs/{eval_run_id}` (operationId `update_eval_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `eval_run_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `UpdateEvalRunRequest`):
- `name`: string, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `EvalSchema`
- AND тело MUST содержать поля `id`, `eval_type`, `eval_data`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Evaluation run not found»
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to update evaluation run»
- WHEN клиент выполняет `PATCH /eval-runs/{eval_run_id}`
- THEN система MUST вернуть `500`

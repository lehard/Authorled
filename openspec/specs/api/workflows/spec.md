# Workflows API Specification

## Purpose
Workflows AgentOS. Репозиторий не регистрирует ни одного workflow.

Домен содержит 8 операций HTTP (теги OpenAPI: Workflows). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Отсутствие workflows
`GET /workflows` MUST возвращать пустой список.

#### Scenario: Неизвестный workflow
- GIVEN workflow `nope` не существует
- WHEN клиент выполняет `GET /workflows/nope`
- THEN система MUST вернуть `404`

### Requirement: GET /workflows
Система MUST возвращать операцию «List All Workflows» по запросу `GET /workflows` (operationId `get_workflows`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /workflows` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[WorkflowSummaryResponse]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /workflows`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /workflows`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /workflows`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /workflows`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /workflows`
- THEN система MUST вернуть `500`

### Requirement: GET /workflows/{workflow_id}
Система MUST возвращать операцию «Get Workflow Details» по запросу `GET /workflows/{workflow_id}` (operationId `get_workflow`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `version` (query, integer | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /workflows/{workflow_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `WorkflowResponse`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /workflows/{workflow_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /workflows/{workflow_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow not found»
- WHEN клиент выполняет `GET /workflows/{workflow_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}`
- THEN система MUST вернуть `500`

### Requirement: POST /workflows/{workflow_id}/runs
Система MUST выполнять операцию «Execute Workflow» по запросу `POST /workflows/{workflow_id}/runs` (operationId `create_workflow_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_create_workflow_run`):
- `message`: string, обязательное
- `stream`: boolean, по умолчанию `true`
- `background`: boolean, по умолчанию `false`
- `session_id`: string | null
- `user_id`: string | null
- `version`: integer | null
- `factory_input`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid input data or workflow configuration»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow not found»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Workflow execution error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: GET /workflows/{workflow_id}/runs
Система MUST возвращать операцию «List Workflow Runs» по запросу `GET /workflows/{workflow_id}/runs` (operationId `list_workflow_runs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)
- `status` (query, string | null, необязательный)
- `factory_input` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow not found»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs`
- THEN система MUST вернуть `500`

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/continue
Система MUST выполнять операцию «Continue Workflow Run» по запросу `POST /workflows/{workflow_id}/runs/{run_id}/continue` (operationId `continue_workflow_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_continue_workflow_run`):
- `step_requirements`: string, по умолчанию `""`
- `session_id`: string | null
- `user_id`: string | null
- `stream`: boolean, по умолчанию `true`
- `background`: boolean, по умолчанию `false`
- `factory_input`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid JSON in requirements field»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow not found»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 409
- GIVEN выполняется условие ошибки «Run is not paused. Only PAUSED runs can be continued.»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `409`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/continue`
- THEN система MUST вернуть `500`

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/cancel
Система MUST выполнять операцию «Cancel Workflow Run» по запросу `POST /workflows/{workflow_id}/runs/{run_id}/cancel` (operationId `cancel_workflow_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow or run not found»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to cancel workflow run»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/cancel`
- THEN система MUST вернуть `500`

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/resume
Система MUST выполнять операцию «Resume Workflow Run Stream» по запросу `POST /workflows/{workflow_id}/runs/{run_id}/resume` (operationId `resume_workflow_run_stream`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_resume_workflow_run_stream`):
- `last_event_index`: integer | null
- `session_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть `200`
- AND при `stream=true` ответ MUST передаваться как `text/event-stream` (SSE)

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Not supported for remote workflows»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow not found»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /workflows/{workflow_id}/runs/{run_id}/resume`
- THEN система MUST вернуть `500`

### Requirement: GET /workflows/{workflow_id}/runs/{run_id}
Система MUST возвращать операцию «Get Workflow Run» по запросу `GET /workflows/{workflow_id}/runs/{run_id}` (operationId `get_workflow_run`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `workflow_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)
- `session_id` (query, string, обязательный)
- `factory_input` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Workflow or run not found»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /workflows/{workflow_id}/runs/{run_id}`
- THEN система MUST вернуть `500`

# API `workflows` Specification

## Purpose
Запуск и управление workflows. В текущей конфигурации репозитория workflows не зарегистрированы (`GET /workflows` возвращает пустой список).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /workflows — List All Workflows
Система MUST предоставлять эндпоинт `GET /workflows` (operationId `get_workflows`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Retrieve a comprehensive list of all workflows configured in this OS instance.»

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /workflows` с корректными параметрами
- THEN система MUST вернуть статус `200` («List of workflows retrieved successfully»)
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

### Requirement: GET /workflows/{workflow_id} — Get Workflow Details
Система MUST предоставлять эндпоинт `GET /workflows/{workflow_id}` (operationId `get_workflow`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Retrieve detailed configuration and step information for a specific workflow.»

Path-параметры: `workflow_id` — MUST быть заданы (обязательные).

Query-параметры: `version`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /workflows/{workflow_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Workflow details retrieved successfully»)
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
- WHEN условие ошибки: «Workflow not found»
- THEN система MUST вернуть статус `404` («Workflow not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /workflows/{workflow_id}/runs — Execute Workflow
Система MUST предоставлять эндпоинт `POST /workflows/{workflow_id}/runs` (operationId `create_workflow_run`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Execute a workflow with the provided input data. Workflows can run in streaming or batch mode.»

Path-параметры: `workflow_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_create_workflow_run`, обязательное. Поля: `message` (обязательное), `stream`, `background`, `session_id`, `user_id`, `version`, `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /workflows/{workflow_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Workflow executed successfully»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid input data or workflow configuration»
- THEN система MUST вернуть статус `400` («Invalid input data or workflow configuration»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Workflow not found»
- THEN система MUST вернуть статус `404` («Workflow not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Workflow execution error»
- THEN система MUST вернуть статус `500` («Workflow execution error»)

### Requirement: GET /workflows/{workflow_id}/runs — List Workflow Runs
Система MUST предоставлять эндпоинт `GET /workflows/{workflow_id}/runs` (operationId `list_workflow_runs`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «List runs for a workflow within a session, optionally filtered by status.»

Path-параметры: `workflow_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный), `status`, `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /workflows/{workflow_id}/runs` с корректными параметрами
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
- WHEN условие ошибки: «Workflow not found»
- THEN система MUST вернуть статус `404` («Workflow not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/continue — Continue Workflow Run
Система MUST предоставлять эндпоинт `POST /workflows/{workflow_id}/runs/{run_id}/continue` (operationId `continue_workflow_run`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Continue a paused workflow run with resolved requirements.»

Path-параметры: `workflow_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_continue_workflow_run`. Поля: `step_requirements`, `session_id`, `user_id`, `stream`, `background`, `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /workflows/{workflow_id}/runs/{run_id}/continue` с корректными параметрами
- THEN система MUST вернуть статус `200` («Workflow run continued successfully»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid JSON in requirements field»
- THEN система MUST вернуть статус `400` («Invalid JSON in requirements field»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Workflow not found»
- THEN система MUST вернуть статус `404` («Workflow not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 409
- GIVEN платформа запущена
- WHEN условие ошибки: «Run is not paused. Only PAUSED runs can be continued.»
- THEN система MUST вернуть статус `409` («Run is not paused. Only PAUSED runs can be continued.»)

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/cancel — Cancel Workflow Run
Система MUST предоставлять эндпоинт `POST /workflows/{workflow_id}/runs/{run_id}/cancel` (operationId `cancel_workflow_run`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Cancel a currently executing workflow run, stopping all active steps and cleanup. **Note:** Complex workflows with multiple parallel steps may take time to fully cancel.»

Path-параметры: `workflow_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /workflows/{workflow_id}/runs/{run_id}/cancel` с корректными параметрами
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
- WHEN условие ошибки: «Workflow or run not found»
- THEN система MUST вернуть статус `404` («Workflow or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to cancel workflow run»
- THEN система MUST вернуть статус `500` («Failed to cancel workflow run»)

### Requirement: POST /workflows/{workflow_id}/runs/{run_id}/resume — Resume Workflow Run Stream
Система MUST предоставлять эндпоинт `POST /workflows/{workflow_id}/runs/{run_id}/resume` (operationId `resume_workflow_run_stream`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Resume an SSE stream for a workflow run after disconnection.»

Path-параметры: `workflow_id`, `run_id` — MUST быть заданы (обязательные).

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_resume_workflow_run_stream`. Поля: `last_event_index`, `session_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /workflows/{workflow_id}/runs/{run_id}/resume` с корректными параметрами
- THEN система MUST вернуть статус `200` («SSE stream of catch-up and/or live events»)
- AND формат содержимого ответа: `application/json`, `text/event-stream`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Not supported for remote workflows»
- THEN система MUST вернуть статус `400` («Not supported for remote workflows»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Workflow not found»
- THEN система MUST вернуть статус `404` («Workflow not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /workflows/{workflow_id}/runs/{run_id} — Get Workflow Run
Система MUST предоставлять эндпоинт `GET /workflows/{workflow_id}/runs/{run_id}` (operationId `get_workflow_run`, раздел OpenAPI «Workflows»).

Описание в OpenAPI: «Retrieve the status and output of a workflow run. Use this to poll for run completion.»

Path-параметры: `workflow_id`, `run_id` — MUST быть заданы (обязательные).

Query-параметры: `session_id` (обязательный), `factory_input`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /workflows/{workflow_id}/runs/{run_id}` с корректными параметрами
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
- WHEN условие ошибки: «Workflow or run not found»
- THEN система MUST вернуть статус `404` («Workflow or run not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

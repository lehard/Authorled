# Company Operations API Specification

## Purpose
Sources, Routines, исполнение Tasks, внимание оператора, wiki и Decisions модуля CompanyOS.

Домен содержит 26 операций HTTP (теги OpenAPI: Company heartbeat, Company execution, Company playbook). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Объявленные Sources
Product `this-agentos` MUST иметь Source `website` `https://github.com/agno-agi/agno/releases` и Source `git` с абсолютным путём корня репозитория (в контейнере `/app`). Если `REPOSITORY` задан, система MUST добавить Source `git` с `REPOSITORY.url`.

#### Scenario: Sources без REPOSITORY
- GIVEN `REPOSITORY` равен `None`
- WHEN клиент выполняет `GET /company/sources`
- THEN ответ MUST содержать ровно два Source: `website` и `git` `/app`

### Requirement: Routine agentos-maintenance
Система MUST объявлять Routine `agentos-maintenance` с `executor_type="agent"`, `executor_id="company-manager-internal"`, `cron_expr="0 9 * * *"`, `auto_accept=False` и инструкциями `MAINTENANCE`. Инструкции MUST ограничивать работу предложением не более трёх Backlog Tasks с доказательствами и MUST запрещать принимать или выполнять работу.

#### Scenario: Сохранённая Routine
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /company/routines`
- THEN ответ MUST содержать `this-agentos.agentos-maintenance` с `cron_expr` `0 9 * * *`, `timezone` `UTC`, `enabled: true`, `managed_by: company`, `schedule_type: scheduled`
- AND `endpoint` MUST быть `/agents/company-manager-internal/runs`

### Requirement: Исполнители Routine
`executor_type` в `RoutineCreate` MUST принимать `agent`, `team` или `workflow`; `timezone` по умолчанию MUST быть `UTC`, `auto_accept` по умолчанию MUST быть `false`.

#### Scenario: Недопустимый executor_type
- GIVEN Product существует
- WHEN клиент создаёт Routine с `executor_type`, не входящим в перечисление
- THEN система MUST вернуть `422`

### Requirement: GET /company/sources
Система MUST возвращать операцию «List Sources» по запросу `GET /company/sources` (operationId `list_sources_company_sources_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/sources` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/sources`
- THEN система MUST вернуть `422`

### Requirement: POST /company/sources
Система MUST выполнять операцию «Create Source» по запросу `POST /company/sources` (operationId `create_source_company_sources_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `SourceCreate`):
- `id`: null
- `type`: string (git | markdown | website), обязательное
- `reference`: string, обязательное
- `credential_ref`: string | null
- `config`: object
- `product_id`: string, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/sources` с корректными параметрами
- THEN система MUST вернуть `201`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/sources`
- THEN система MUST вернуть `422`

### Requirement: DELETE /company/sources/{source_id}
Система MUST удалять операцию «Delete Source» по запросу `DELETE /company/sources/{source_id}` (operationId `delete_source_company_sources__source_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `source_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /company/sources/{source_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /company/sources/{source_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/sources/{source_id}/restore
Система MUST выполнять операцию «Restore Source» по запросу `POST /company/sources/{source_id}/restore` (operationId `restore_source_company_sources__source_id__restore_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `source_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/sources/{source_id}/restore` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/sources/{source_id}/restore`
- THEN система MUST вернуть `422`

### Requirement: GET /company/routines
Система MUST возвращать операцию «List Routines» по запросу `GET /company/routines` (operationId `list_routines_company_routines_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/routines` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_RoutineResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/routines`
- THEN система MUST вернуть `422`

### Requirement: POST /company/routines
Система MUST выполнять операцию «Create Routine» по запросу `POST /company/routines` (operationId `create_routine_company_routines_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `RoutineCreate`):
- `name`: string, обязательное
- `template`: string (refresh | intake | summary) | null
- `executor_type`: string (agent | team | workflow), обязательное
- `executor_id`: string, обязательное
- `cron_expr`: string | null
- `timezone`: string, по умолчанию `"UTC"`
- `instructions`: string | null
- `auto_accept`: boolean | AutoAccept, по умолчанию `false`
- `product_id`: string, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/routines` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `RoutineResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`, `schedule_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/routines`
- THEN система MUST вернуть `422`

### Requirement: GET /company/routines/{routine_id}
Система MUST возвращать операцию «Get Routine» по запросу `GET /company/routines/{routine_id}` (operationId `get_routine_company_routines__routine_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/routines/{routine_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `RoutineResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`, `schedule_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/routines/{routine_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /company/routines/{routine_id}
Система MUST обновлять операцию «Update Routine» по запросу `PATCH /company/routines/{routine_id}` (operationId `update_routine_company_routines__routine_id__patch`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `RoutineUpdate`):
- `name`: string | null
- `executor_type`: string (agent | team | workflow) | null
- `executor_id`: string | null
- `instructions`: string | null
- `cron_expr`: string | null
- `timezone`: string | null
- `auto_accept`: boolean | AutoAccept | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /company/routines/{routine_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `RoutineResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`, `schedule_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /company/routines/{routine_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/routines/{routine_id}/trigger
Система MUST выполнять операцию «Trigger Routine» по запросу `POST /company/routines/{routine_id}/trigger` (operationId `trigger_routine_company_routines__routine_id__trigger_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/routines/{routine_id}/trigger` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleRunResponse`
- AND тело MUST содержать поля `id`, `schedule_id`, `attempt`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/routines/{routine_id}/trigger`
- THEN система MUST вернуть `422`

### Requirement: POST /company/routines/{routine_id}/pause
Система MUST выполнять операцию «Pause Routine» по запросу `POST /company/routines/{routine_id}/pause` (operationId `pause_routine_company_routines__routine_id__pause_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/routines/{routine_id}/pause` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `RoutineResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`, `schedule_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/routines/{routine_id}/pause`
- THEN система MUST вернуть `422`

### Requirement: POST /company/routines/{routine_id}/resume
Система MUST выполнять операцию «Resume Routine» по запросу `POST /company/routines/{routine_id}/resume` (operationId `resume_routine_company_routines__routine_id__resume_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/routines/{routine_id}/resume` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `RoutineResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`, `schedule_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/routines/{routine_id}/resume`
- THEN система MUST вернуть `422`

### Requirement: GET /company/routines/{routine_id}/runs
Система MUST возвращать операцию «Routine Runs» по запросу `GET /company/routines/{routine_id}/runs` (operationId `routine_runs_company_routines__routine_id__runs_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `routine_id` (path, string, обязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/routines/{routine_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/routines/{routine_id}/runs`
- THEN система MUST вернуть `422`

### Requirement: POST /company/setup
Система MUST выполнять операцию «Setup» по запросу `POST /company/setup` (operationId `setup_company_setup_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `Setup`):
- `id`: null
- `name`: string, обязательное
- `purpose`: string | null
- `user_id`: null
- `metadata`: object
- `sources`: array[Source]
- `routines`: array[Routine]

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/setup` с корректными параметрами
- THEN система MUST вернуть `201`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/setup`
- THEN система MUST вернуть `422`

### Requirement: Переходы Task и запуск
Переход в `in_progress` через `POST /company/tasks/{task_id}/transitions` MUST отклоняться `409`; вход выполняется только запуском `POST /company/tasks/{task_id}/runs`. Полная таблица переходов Task и Project — в спецификации `api/company` (Requirement «Переходы Task» и «Переходы Project»).

#### Scenario: Запуск вместо перехода
- GIVEN Task в статусе `ready`
- WHEN клиент передаёт `target` `in_progress` в `transitions`
- THEN система MUST вернуть `409` с указанием использовать `/company/tasks/{task_id}/runs` (live, `agno/os/routers/company/tasks.py:148-152`)
- AND запуск допустим только из `ready`, `in_progress`, `in_review` при заданном исполнителе (source: `agno/db/schemas/tasks.py:112-113`); сам запуск live не проверялся (вызовы модели)

### Requirement: POST /company/tasks/{task_id}/runs
Система MUST выполнять операцию «Start» по запросу `POST /company/tasks/{task_id}/runs` (operationId `start_company_tasks__task_id__runs_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `TaskRunCreate`):
- `attempt`: integer, по умолчанию `1`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/tasks/{task_id}/runs` с корректными параметрами
- THEN система MUST вернуть `202`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/tasks/{task_id}/runs`
- THEN система MUST вернуть `422`

### Requirement: GET /company/tasks/{task_id}/runs
Система MUST возвращать операцию «Runs» по запросу `GET /company/tasks/{task_id}/runs` (operationId `runs_company_tasks__task_id__runs_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/tasks/{task_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_Dict_str__Any__`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/tasks/{task_id}/runs`
- THEN система MUST вернуть `422`

### Requirement: GET /company/runs/{run_id}
Система MUST возвращать операцию «Get Run» по запросу `GET /company/runs/{run_id}` (operationId `get_run_company_runs__run_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `run_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/runs/{run_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/runs/{run_id}/cancel
Система MUST выполнять операцию «Cancel» по запросу `POST /company/runs/{run_id}/cancel` (operationId `cancel_company_runs__run_id__cancel_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `run_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/runs/{run_id}/cancel` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/runs/{run_id}/cancel`
- THEN система MUST вернуть `422`

### Requirement: GET /company/attention
Система MUST возвращать операцию «Attention» по запросу `GET /company/attention` (operationId `attention_company_attention_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/attention` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/attention`
- THEN система MUST вернуть `422`

### Requirement: GET /company/products/{product_id}/wiki
Система MUST возвращать операцию «List Product Wiki» по запросу `GET /company/products/{product_id}/wiki` (operationId `list_product_wiki_company_products__product_id__wiki_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (path, string, обязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/products/{product_id}/wiki` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_WikiPageResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/products/{product_id}/wiki`
- THEN система MUST вернуть `422`

### Requirement: GET /company/products/{product_id}/wiki/{path}
Система MUST возвращать операцию «Read Product Wiki» по запросу `GET /company/products/{product_id}/wiki/{path}` (operationId `read_product_wiki_company_products__product_id__wiki__path__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `path` (path, string, обязательный)
- `product_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/products/{product_id}/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `WikiReadResponse`
- AND тело MUST содержать поля `content`, `metadata`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/products/{product_id}/wiki/{path}`
- THEN система MUST вернуть `422`

### Requirement: PUT /company/products/{product_id}/wiki/{path}
Система MUST записывать операцию «Write Product Wiki» по запросу `PUT /company/products/{product_id}/wiki/{path}` (operationId `write_product_wiki_company_products__product_id__wiki__path__put`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `path` (path, string, обязательный)
- `product_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `WikiWrite`):
- `content`: string, обязательное
- `expected_version`: integer, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PUT /company/products/{product_id}/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `WikiPageResponse`
- AND тело MUST содержать поля `path`, `size_bytes`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PUT /company/products/{product_id}/wiki/{path}`
- THEN система MUST вернуть `422`

### Requirement: GET /company/wiki
Система MUST возвращать операцию «List Company Wiki» по запросу `GET /company/wiki` (operationId `list_company_wiki_company_wiki_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/wiki` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_WikiPageResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/wiki`
- THEN система MUST вернуть `422`

### Requirement: GET /company/wiki/{path}
Система MUST возвращать операцию «Read Company Wiki» по запросу `GET /company/wiki/{path}` (operationId `read_company_wiki_company_wiki__path__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `path` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `WikiReadResponse`
- AND тело MUST содержать поля `content`, `metadata`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/wiki/{path}`
- THEN система MUST вернуть `422`

### Requirement: PUT /company/wiki/{path}
Система MUST записывать операцию «Write Company Wiki» по запросу `PUT /company/wiki/{path}` (operationId `write_company_wiki_company_wiki__path__put`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `path` (path, string, обязательный)

Тело запроса (`application/json`, схема `WikiWrite`):
- `content`: string, обязательное
- `expected_version`: integer, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PUT /company/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `WikiPageResponse`
- AND тело MUST содержать поля `path`, `size_bytes`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PUT /company/wiki/{path}`
- THEN система MUST вернуть `422`

### Requirement: GET /company/decisions
Система MUST возвращать операцию «List Decisions» по запросу `GET /company/decisions` (operationId `list_decisions_company_decisions_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `query` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `session_id` (query, string | null, необязательный)
- `days` (query, integer | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/decisions` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_DecisionResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/decisions`
- THEN система MUST вернуть `422`

### Requirement: POST /company/decisions
Система MUST выполнять операцию «Create Decision» по запросу `POST /company/decisions` (operationId `create_decision_company_decisions_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `DecisionCreate`):
- `decision`: string, обязательное
- `reasoning`: string | null
- `context`: string | null
- `outcome`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/decisions` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `DecisionResponse`
- AND тело MUST содержать поля `id`, `decision`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/decisions`
- THEN система MUST вернуть `422`

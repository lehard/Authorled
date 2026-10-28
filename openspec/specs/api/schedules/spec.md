# Schedules API Specification

## Purpose
Cron-расписания, которые вызывают маршруты AgentOS (`scheduler=True`, `scheduler_base_url=AGENTOS_URL`).

Домен содержит 10 операций HTTP (теги OpenAPI: Schedules). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Расписания CompanyOS
Система MUST содержать два расписания с `managed_by: company`: `Company automation` (`0 * * * *`, `GET /company/attention`) и `this-agentos.agentos-maintenance` (`0 9 * * *`, `POST /agents/company-manager-internal/runs`, `target_type: agent`).

#### Scenario: Список расписаний
- GIVEN платформа запущена из репозитория
- WHEN клиент выполняет `GET /schedules`
- THEN `meta.total_count` MUST быть `2`

### Requirement: Значения по умолчанию ScheduleCreate
`ScheduleCreate` MUST требовать `name` и `endpoint`; по умолчанию `method` MUST быть `POST`, `timezone` `UTC`, `timeout_seconds` `3600`, `max_retries` `0`, `retry_delay_seconds` `60`.

#### Scenario: Расписание без endpoint
- GIVEN клиент аутентифицирован
- WHEN клиент создаёт расписание без `endpoint`
- THEN система MUST вернуть `422`

### Requirement: GET /schedules
Система MUST возвращать операцию «List Schedules» по запросу `GET /schedules` (operationId `list_schedules_schedules_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `enabled` (query, boolean | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /schedules` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ScheduleResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /schedules`
- THEN система MUST вернуть `422`

### Requirement: POST /schedules
Система MUST выполнять операцию «Create Schedule» по запросу `POST /schedules` (operationId `create_schedule_schedules_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `ScheduleCreate`):
- `name`: string, обязательное
- `cron_expr`: string, по умолчанию `""`
- `endpoint`: string, обязательное
- `method`: string, по умолчанию `"POST"`
- `description`: string | null
- `payload`: object | null
- `timezone`: string, по умолчанию `"UTC"`
- `timeout_seconds`: integer, по умолчанию `3600`
- `max_retries`: integer, по умолчанию `0`
- `retry_delay_seconds`: integer, по умолчанию `60`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /schedules` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ScheduleResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /schedules`
- THEN система MUST вернуть `422`

### Requirement: GET /schedules/{schedule_id}
Система MUST возвращать операцию «Get Schedule» по запросу `GET /schedules/{schedule_id}` (operationId `get_schedule_schedules__schedule_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /schedules/{schedule_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /schedules/{schedule_id}
Система MUST обновлять операцию «Update Schedule» по запросу `PATCH /schedules/{schedule_id}` (operationId `update_schedule_schedules__schedule_id__patch`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ScheduleUpdate`):
- `name`: string | null
- `cron_expr`: string | null
- `endpoint`: string | null
- `method`: string | null
- `description`: string | null
- `payload`: object | null
- `timezone`: string | null
- `timeout_seconds`: integer | null
- `max_retries`: integer | null
- `retry_delay_seconds`: integer | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleResponse`
- AND тело MUST содержать поля `id`, `name`, `method`, `endpoint`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`, `enabled`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /schedules/{schedule_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /schedules/{schedule_id}
Система MUST удалять операцию «Delete Schedule» по запросу `DELETE /schedules/{schedule_id}` (operationId `delete_schedule_schedules__schedule_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /schedules/{schedule_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /schedules/{schedule_id}/enable
Система MUST выполнять операцию «Enable Schedule» по запросу `POST /schedules/{schedule_id}/enable` (operationId `enable_schedule_schedules__schedule_id__enable_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /schedules/{schedule_id}/enable` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleStateResponse`
- AND тело MUST содержать поля `id`, `name`, `enabled`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /schedules/{schedule_id}/enable`
- THEN система MUST вернуть `422`

### Requirement: POST /schedules/{schedule_id}/disable
Система MUST выполнять операцию «Disable Schedule» по запросу `POST /schedules/{schedule_id}/disable` (operationId `disable_schedule_schedules__schedule_id__disable_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /schedules/{schedule_id}/disable` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleStateResponse`
- AND тело MUST содержать поля `id`, `name`, `enabled`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /schedules/{schedule_id}/disable`
- THEN система MUST вернуть `422`

### Requirement: POST /schedules/{schedule_id}/trigger
Система MUST выполнять операцию «Trigger Schedule» по запросу `POST /schedules/{schedule_id}/trigger` (operationId `trigger_schedule_schedules__schedule_id__trigger_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /schedules/{schedule_id}/trigger` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleRunResponse`
- AND тело MUST содержать поля `id`, `schedule_id`, `attempt`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /schedules/{schedule_id}/trigger`
- THEN система MUST вернуть `422`

### Requirement: GET /schedules/{schedule_id}/runs
Система MUST возвращать операцию «List Schedule Runs» по запросу `GET /schedules/{schedule_id}/runs` (operationId `list_schedule_runs_schedules__schedule_id__runs_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /schedules/{schedule_id}/runs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ScheduleRunResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /schedules/{schedule_id}/runs`
- THEN система MUST вернуть `422`

### Requirement: GET /schedules/{schedule_id}/runs/{run_id}
Система MUST возвращать операцию «Get Schedule Run» по запросу `GET /schedules/{schedule_id}/runs/{run_id}` (operationId `get_schedule_run_schedules__schedule_id__runs__run_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `schedule_id` (path, string, обязательный)
- `run_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /schedules/{schedule_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ScheduleRunResponse`
- AND тело MUST содержать поля `id`, `schedule_id`, `attempt`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /schedules/{schedule_id}/runs/{run_id}`
- THEN система MUST вернуть `422`

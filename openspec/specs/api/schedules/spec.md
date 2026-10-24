# API `schedules` Specification

## Purpose
Расписания (cron) запуска агентов и других исполнителей (`scheduler=True`).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /schedules — List Schedules
Система MUST предоставлять эндпоинт `GET /schedules` (operationId `list_schedules_schedules_get`, раздел OpenAPI «Schedules»).

Query-параметры: `enabled`, `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /schedules` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /schedules — Create Schedule
Система MUST предоставлять эндпоинт `POST /schedules` (operationId `create_schedule_schedules_post`, раздел OpenAPI «Schedules»).

Тело запроса: `application/json`, схема `ScheduleCreate`, обязательное. Поля: `name` (обязательное), `cron_expr`, `endpoint` (обязательное), `method`, `description`, `payload`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /schedules` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /schedules/{schedule_id} — Get Schedule
Система MUST предоставлять эндпоинт `GET /schedules/{schedule_id}` (operationId `get_schedule_schedules__schedule_id__get`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /schedules/{schedule_id} — Update Schedule
Система MUST предоставлять эндпоинт `PATCH /schedules/{schedule_id}` (operationId `update_schedule_schedules__schedule_id__patch`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `ScheduleUpdate`, обязательное. Поля: `name`, `cron_expr`, `endpoint`, `method`, `description`, `payload`, `timezone`, `timeout_seconds`, `max_retries`, `retry_delay_seconds`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /schedules/{schedule_id} — Delete Schedule
Система MUST предоставлять эндпоинт `DELETE /schedules/{schedule_id}` (operationId `delete_schedule_schedules__schedule_id__delete`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /schedules/{schedule_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /schedules/{schedule_id}/enable — Enable Schedule
Система MUST предоставлять эндпоинт `POST /schedules/{schedule_id}/enable` (operationId `enable_schedule_schedules__schedule_id__enable_post`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /schedules/{schedule_id}/enable` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /schedules/{schedule_id}/disable — Disable Schedule
Система MUST предоставлять эндпоинт `POST /schedules/{schedule_id}/disable` (operationId `disable_schedule_schedules__schedule_id__disable_post`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /schedules/{schedule_id}/disable` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /schedules/{schedule_id}/trigger — Trigger Schedule
Система MUST предоставлять эндпоинт `POST /schedules/{schedule_id}/trigger` (operationId `trigger_schedule_schedules__schedule_id__trigger_post`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /schedules/{schedule_id}/trigger` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /schedules/{schedule_id}/runs — List Schedule Runs
Система MUST предоставлять эндпоинт `GET /schedules/{schedule_id}/runs` (operationId `list_schedule_runs_schedules__schedule_id__runs_get`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id` — MUST быть заданы (обязательные).

Query-параметры: `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /schedules/{schedule_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /schedules/{schedule_id}/runs/{run_id} — Get Schedule Run
Система MUST предоставлять эндпоинт `GET /schedules/{schedule_id}/runs/{run_id}` (operationId `get_schedule_run_schedules__schedule_id__runs__run_id__get`, раздел OpenAPI «Schedules»).

Path-параметры: `schedule_id`, `run_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /schedules/{schedule_id}/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

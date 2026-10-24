# API `queue` Specification

## Purpose
Просмотр и повторная постановка задач долговечной очереди (`QueueConfig(durable=True)`).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /queue/jobs — List Queue Jobs
Система MUST предоставлять эндпоинт `GET /queue/jobs` (operationId `list_queue_jobs`, раздел OpenAPI «Queue»).

Описание в OpenAPI: «List job queue jobs, optionally filtered by status, session and submitting user. Repeat status or session_id to match any of several (e.g. status=failed&status=cancelled for the requeueable set; status=failed alone is the dead-letter list; session_id=s1&session_id=s2 for one conversation's jobs). An…»

Query-параметры: `status`, `session_id`, `user_id`, `limit`, `page`, `sort_by`, `sort_order`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /queue/jobs` с корректными параметрами
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

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «Durable job queue not enabled on this replica»
- THEN система MUST вернуть статус `503` («Durable job queue not enabled on this replica»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /queue/jobs/{job_id} — Get Queue Job
Система MUST предоставлять эндпоинт `GET /queue/jobs/{job_id}` (operationId `get_queue_job`, раздел OpenAPI «Queue»).

Path-параметры: `job_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /queue/jobs/{job_id}` с корректными параметрами
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

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «Durable job queue not enabled on this replica»
- THEN система MUST вернуть статус `503` («Durable job queue not enabled on this replica»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /queue/jobs/{job_id}/requeue — Requeue Failed Queue Job
Система MUST предоставлять эндпоинт `POST /queue/jobs/{job_id}/requeue` (operationId `requeue_queue_job`, раздел OpenAPI «Queue»).

Описание в OpenAPI: «Requeue a terminally failed or cancelled job for one more execution (raises its attempt budget by one). The operator remedy for crashed runs under the no-silent-re-execution default. Requeueing a CANCELLED job whose cancellation intent is still live requires clear_cancellation=true - an explicit ove…»

Path-параметры: `job_id` — MUST быть заданы (обязательные).

Query-параметры: `clear_cancellation`, `force`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /queue/jobs/{job_id}/requeue` с корректными параметрами
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

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «Durable job queue not enabled on this replica»
- THEN система MUST вернуть статус `503` («Durable job queue not enabled on this replica»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /queue/stats — Queue Stats
Система MUST предоставлять эндпоинт `GET /queue/stats` (operationId `get_queue_stats`, раздел OpenAPI «Queue»).

Описание в OpenAPI: «Job counts by status and the oldest queued job's age - the queue-health signals to alert on.»

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /queue/stats` с корректными параметрами
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

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «Durable job queue not enabled on this replica»
- THEN система MUST вернуть статус `503` («Durable job queue not enabled on this replica»)

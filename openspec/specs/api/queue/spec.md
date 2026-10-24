# Queue API Specification

## Purpose
Долговечная очередь ходов в PostgreSQL (`QueueConfig(durable=True, db=db)`).

Домен содержит 4 операций HTTP (теги OpenAPI: Queue). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Долговечная очередь
Система MUST использовать долговечную очередь в общей БД с упорядочиванием по сессии (`queue_per_session: true`). Задание очереди (`QueueJobSchema`) MUST содержать `id`, `component_type`, `component_id`, `session_id`, `status`; по умолчанию `job_type` MUST быть `run`, `attempt` `0`, `max_attempts` `1`.

#### Scenario: Статистика пустой очереди
- GIVEN заданий нет
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `{"counts":{},"oldest_queued_age_seconds":null}`

### Requirement: GET /queue/jobs
Система MUST возвращать операцию «List Queue Jobs» по запросу `GET /queue/jobs` (operationId `list_queue_jobs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `status` (query, array[string] | null, необязательный)
- `session_id` (query, array[string] | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `sort_by` (query, string, необязательный)
- `sort_order` (query, SortOrder (asc | desc), необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /queue/jobs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_QueueJobSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «Durable job queue not enabled on this replica»
- WHEN клиент выполняет `GET /queue/jobs`
- THEN система MUST вернуть `503`

### Requirement: GET /queue/jobs/{job_id}
Система MUST возвращать операцию «Get Queue Job» по запросу `GET /queue/jobs/{job_id}` (operationId `get_queue_job`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `job_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /queue/jobs/{job_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `QueueJobSchema`
- AND тело MUST содержать поля `id`, `component_type`, `component_id`, `session_id`, `status`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «Durable job queue not enabled on this replica»
- WHEN клиент выполняет `GET /queue/jobs/{job_id}`
- THEN система MUST вернуть `503`

### Requirement: POST /queue/jobs/{job_id}/requeue
Система MUST выполнять операцию «Requeue Failed Queue Job» по запросу `POST /queue/jobs/{job_id}/requeue` (operationId `requeue_queue_job`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `job_id` (path, string, обязательный)
- `clear_cancellation` (query, boolean, необязательный)
- `force` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `QueueJobSchema`
- AND тело MUST содержать поля `id`, `component_type`, `component_id`, `session_id`, `status`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «Durable job queue not enabled on this replica»
- WHEN клиент выполняет `POST /queue/jobs/{job_id}/requeue`
- THEN система MUST вернуть `503`

### Requirement: GET /queue/stats
Система MUST возвращать операцию «Queue Stats» по запросу `GET /queue/stats` (operationId `get_queue_stats`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /queue/stats` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «Durable job queue not enabled on this replica»
- WHEN клиент выполняет `GET /queue/stats`
- THEN система MUST вернуть `503`

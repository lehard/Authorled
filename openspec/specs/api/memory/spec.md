# Memory and Learning API Specification

## Purpose
Пользовательские воспоминания (`agno_memories`) и записи LearningMachine (`agno_learnings`).

Домен содержит 16 операций HTTP (теги OpenAPI: Memory, Learnings). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Shared learning
Система MUST объявлять `shared_learning` как `LearningMachine` с именем `shared-learning` на общей БД, с `user_profile` и `user_memory` в режиме `LearningMode.AGENTIC`, и MUST подключать его к OS Manager. Learning MUST хранить данные в PostgreSQL и MUST NOT дообучать модель.

#### Scenario: Learning в реестре
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать элемент типа `learning` с именем `shared-learning`

### Requirement: POST /memories
Система MUST выполнять операцию «Create Memory» по запросу `POST /memories` (operationId `create_memory`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `UserMemoryCreateSchema`):
- `memory`: string, обязательное
- `user_id`: string | null
- `topics`: array[string] | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /memories` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserMemorySchema`
- AND тело MUST содержать поля `memory_id`, `memory`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request data»
- WHEN клиент выполняет `POST /memories`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /memories`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /memories`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error in payload»
- WHEN клиент выполняет `POST /memories`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to create memory»
- WHEN клиент выполняет `POST /memories`
- THEN система MUST вернуть `500`

### Requirement: DELETE /memories
Система MUST удалять операцию «Delete Multiple Memories» по запросу `DELETE /memories` (operationId `delete_memories`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `DeleteMemoriesRequest`):
- `memory_ids`: array[string], обязательное
- `user_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /memories` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - empty memory_ids list»
- WHEN клиент выполняет `DELETE /memories`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /memories`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /memories`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /memories`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete memories»
- WHEN клиент выполняет `DELETE /memories`
- THEN система MUST вернуть `500`

### Requirement: GET /memories
Система MUST возвращать операцию «List Memories» по запросу `GET /memories` (operationId `get_memories`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `search_content` (query, string | null, необязательный)
- `limit` (query, integer | null, необязательный)
- `page` (query, integer | null, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)
- `topics` (query, array[string] | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /memories` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_UserMemorySchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /memories`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /memories`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /memories`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /memories`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /memories`
- THEN система MUST вернуть `500`

### Requirement: DELETE /memories/{memory_id}
Система MUST удалять операцию «Delete Memory» по запросу `DELETE /memories/{memory_id}` (operationId `delete_memory`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `memory_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /memories/{memory_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /memories/{memory_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Memory not found»
- WHEN клиент выполняет `DELETE /memories/{memory_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /memories/{memory_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete memory»
- WHEN клиент выполняет `DELETE /memories/{memory_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /memories/{memory_id}
Система MUST возвращать операцию «Get Memory by ID» по запросу `GET /memories/{memory_id}` (operationId `get_memory`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `memory_id` (path, string, обязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserMemorySchema`
- AND тело MUST содержать поля `memory_id`, `memory`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /memories/{memory_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /memories/{memory_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Memory not found»
- WHEN клиент выполняет `GET /memories/{memory_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /memories/{memory_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /memories/{memory_id}`
- THEN система MUST вернуть `500`

### Requirement: PATCH /memories/{memory_id}
Система MUST обновлять операцию «Update Memory» по запросу `PATCH /memories/{memory_id}` (operationId `update_memory`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `memory_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `UserMemoryCreateSchema`):
- `memory`: string, обязательное
- `user_id`: string | null
- `topics`: array[string] | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserMemorySchema`
- AND тело MUST содержать поля `memory_id`, `memory`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request data»
- WHEN клиент выполняет `PATCH /memories/{memory_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /memories/{memory_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Memory not found»
- WHEN клиент выполняет `PATCH /memories/{memory_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error in payload»
- WHEN клиент выполняет `PATCH /memories/{memory_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to update memory»
- WHEN клиент выполняет `PATCH /memories/{memory_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /memory_topics
Система MUST возвращать операцию «Get Memory Topics» по запросу `GET /memory_topics` (operationId `get_memory_topics`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /memory_topics` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /memory_topics`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /memory_topics`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /memory_topics`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /memory_topics`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /memory_topics`
- THEN система MUST вернуть `500`

### Requirement: GET /user_memory_stats
Система MUST возвращать операцию «Get User Memory Statistics» по запросу `GET /user_memory_stats` (operationId `get_user_memory_stats`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer | null, необязательный)
- `page` (query, integer | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /user_memory_stats` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_UserStatsSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /user_memory_stats`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /user_memory_stats`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /user_memory_stats`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /user_memory_stats`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to retrieve user statistics»
- WHEN клиент выполняет `GET /user_memory_stats`
- THEN система MUST вернуть `500`

### Requirement: POST /optimize-memories
Система MUST выполнять операцию «Optimize User Memories» по запросу `POST /optimize-memories` (operationId `optimize_memories`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `OptimizeMemoriesRequest`):
- `user_id`: string, обязательное
- `model`: string | null
- `apply`: boolean, по умолчанию `true`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /optimize-memories` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `OptimizeMemoriesResponse`
- AND тело MUST содержать поля `memories`, `memories_before`, `memories_after`, `tokens_before`, `tokens_after`, `tokens_saved`, `reduction_percentage`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad request - User ID is required or invalid model string format»
- WHEN клиент выполняет `POST /optimize-memories`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /optimize-memories`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «No memories found for user»
- WHEN клиент выполняет `POST /optimize-memories`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /optimize-memories`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to optimize memories»
- WHEN клиент выполняет `POST /optimize-memories`
- THEN система MUST вернуть `500`

### Requirement: GET /learnings
Система MUST возвращать операцию «List Learnings» по запросу `GET /learnings` (operationId `list_learnings`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `learning_type` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `session_id` (query, string | null, необязательный)
- `namespace` (query, string | null, необязательный)
- `entity_id` (query, string | null, необязательный)
- `entity_type` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /learnings` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_LearningResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /learnings`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /learnings`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /learnings`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /learnings`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /learnings`
- THEN система MUST вернуть `500`

### Requirement: POST /learnings
Система MUST выполнять операцию «Create Learning» по запросу `POST /learnings` (operationId `create_learning`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `LearningCreate`):
- `learning_type`: string, обязательное
- `content`: object, обязательное
- `namespace`: string | null
- `user_id`: string | null
- `agent_id`: string | null
- `team_id`: string | null
- `session_id`: string | null
- `entity_id`: string | null
- `entity_type`: string | null
- `metadata`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /learnings` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `LearningResponse`
- AND тело MUST содержать поля `learning_id`, `learning_type`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /learnings`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /learnings`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /learnings`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /learnings`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /learnings`
- THEN система MUST вернуть `500`

### Requirement: GET /learnings/users
Система MUST возвращать операцию «List Learning Users» по запросу `GET /learnings/users` (operationId `list_learning_users`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `learning_type` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /learnings/users` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_LearningUserStats_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /learnings/users`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /learnings/users`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /learnings/users`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /learnings/users`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /learnings/users`
- THEN система MUST вернуть `500`

### Requirement: DELETE /learnings/users/{user_id}
Система MUST удалять операцию «Delete Learning User» по запросу `DELETE /learnings/users/{user_id}` (operationId `delete_learning_user`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (path, string, обязательный)
- `learning_type` (query, string | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `DELETE /learnings/users/{user_id}`
- THEN система MUST вернуть `500`

### Requirement: GET /learnings/{learning_id}
Система MUST возвращать операцию «Get Learning» по запросу `GET /learnings/{learning_id}` (operationId `get_learning`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `learning_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /learnings/{learning_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `LearningResponse`
- AND тело MUST содержать поля `learning_id`, `learning_type`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /learnings/{learning_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /learnings/{learning_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /learnings/{learning_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /learnings/{learning_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /learnings/{learning_id}`
- THEN система MUST вернуть `500`

### Requirement: PATCH /learnings/{learning_id}
Система MUST обновлять операцию «Update Learning» по запросу `PATCH /learnings/{learning_id}` (operationId `update_learning`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `learning_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

Тело запроса (`application/json`, схема `LearningUpdate`):
- `content`: object | null
- `metadata`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /learnings/{learning_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `LearningResponse`
- AND тело MUST содержать поля `learning_id`, `learning_type`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `PATCH /learnings/{learning_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /learnings/{learning_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `PATCH /learnings/{learning_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /learnings/{learning_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `PATCH /learnings/{learning_id}`
- THEN система MUST вернуть `500`

### Requirement: DELETE /learnings/{learning_id}
Система MUST удалять операцию «Delete Learning» по запросу `DELETE /learnings/{learning_id}` (operationId `delete_learning`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `learning_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `table` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /learnings/{learning_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /learnings/{learning_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /learnings/{learning_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /learnings/{learning_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /learnings/{learning_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `DELETE /learnings/{learning_id}`
- THEN система MUST вернуть `500`

# API `memory` Specification

## Purpose
Пользовательская память (memories) и накопленные знания обучения (learnings), включая `shared-learning`.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: POST /memories — Create Memory
Система MUST предоставлять эндпоинт `POST /memories` (operationId `create_memory`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Create a new user memory with content and associated topics. Memories are used to store contextual information for users across conversations.»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `UserMemoryCreateSchema`, обязательное. Поля: `memory` (обязательное), `user_id`, `topics`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /memories` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memory created successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request data»
- THEN система MUST вернуть статус `400` («Invalid request data»)

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
- THEN система MUST вернуть статус `422` («Validation error in payload»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to create memory»
- THEN система MUST вернуть статус `500` («Failed to create memory»)

### Requirement: DELETE /memories — Delete Multiple Memories
Система MUST предоставлять эндпоинт `DELETE /memories` (operationId `delete_memories`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Delete multiple user memories by their IDs in a single operation. This action cannot be undone and all specified memories will be permanently removed.»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `DeleteMemoriesRequest`, обязательное. Поля: `memory_ids` (обязательное), `user_id`.

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /memories` с корректными параметрами
- THEN система MUST вернуть статус `204` («Memories deleted successfully»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - empty memory_ids list»
- THEN система MUST вернуть статус `400` («Invalid request - empty memory_ids list»)

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
- WHEN условие ошибки: «Failed to delete memories»
- THEN система MUST вернуть статус `500` («Failed to delete memories»)

### Requirement: GET /memories — List Memories
Система MUST предоставлять эндпоинт `GET /memories` (operationId `get_memories`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Retrieve paginated list of user memories with filtering and search capabilities. Filter by user, agent, team, topics, or search within memory content.»

Query-параметры: `user_id`, `agent_id`, `team_id`, `search_content`, `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `table`, `topics`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /memories` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memories retrieved successfully»)
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

### Requirement: DELETE /memories/{memory_id} — Delete Memory
Система MUST предоставлять эндпоинт `DELETE /memories/{memory_id}` (operationId `delete_memory`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Permanently delete a specific user memory. This action cannot be undone.»

Path-параметры: `memory_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Memory deleted successfully»)
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
- WHEN условие ошибки: «Memory not found»
- THEN система MUST вернуть статус `404` («Memory not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to delete memory»
- THEN система MUST вернуть статус `500` («Failed to delete memory»)

### Requirement: GET /memories/{memory_id} — Get Memory by ID
Система MUST предоставлять эндпоинт `GET /memories/{memory_id}` (operationId `get_memory`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Retrieve detailed information about a specific user memory by its ID.»

Path-параметры: `memory_id` — MUST быть заданы (обязательные).

Query-параметры: `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memory retrieved successfully»)
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
- WHEN условие ошибки: «Memory not found»
- THEN система MUST вернуть статус `404` («Memory not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: PATCH /memories/{memory_id} — Update Memory
Система MUST предоставлять эндпоинт `PATCH /memories/{memory_id}` (operationId `update_memory`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Update an existing user memory's content and topics. Replaces the entire memory content and topic list with the provided values.»

Path-параметры: `memory_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `UserMemoryCreateSchema`, обязательное. Поля: `memory` (обязательное), `user_id`, `topics`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /memories/{memory_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memory updated successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request data»
- THEN система MUST вернуть статус `400` («Invalid request data»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Memory not found»
- THEN система MUST вернуть статус `404` («Memory not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation error in payload»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to update memory»
- THEN система MUST вернуть статус `500` («Failed to update memory»)

### Requirement: GET /memory_topics — Get Memory Topics
Система MUST предоставлять эндпоинт `GET /memory_topics` (operationId `get_memory_topics`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Retrieve all unique topics associated with memories in the system. Useful for filtering and categorizing memories by topic.»

Query-параметры: `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /memory_topics` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memory topics retrieved successfully»)
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

### Requirement: GET /user_memory_stats — Get User Memory Statistics
Система MUST предоставлять эндпоинт `GET /user_memory_stats` (operationId `get_user_memory_stats`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Retrieve paginated statistics about memory usage by user. Provides insights into user engagement and memory distribution across users.»

Query-параметры: `limit`, `page`, `user_id`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /user_memory_stats` с корректными параметрами
- THEN система MUST вернуть статус `200` («User memory statistics retrieved successfully»)
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
- WHEN условие ошибки: «Failed to retrieve user statistics»
- THEN система MUST вернуть статус `500` («Failed to retrieve user statistics»)

### Requirement: POST /optimize-memories — Optimize User Memories
Система MUST предоставлять эндпоинт `POST /optimize-memories` (operationId `optimize_memories`, раздел OpenAPI «Memory»).

Описание в OpenAPI: «Optimize all memories for a given user using the default summarize strategy. This operation combines all memories into a single comprehensive summary, achieving maximum token reduction while preserving all key information. To use a custom model, specify the model parameter in 'provider:model_id' for…»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `OptimizeMemoriesRequest`, обязательное. Поля: `user_id` (обязательное), `model`, `apply`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /optimize-memories` с корректными параметрами
- THEN система MUST вернуть статус `200` («Memories optimized successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Bad request - User ID is required or invalid model string format»
- THEN система MUST вернуть статус `400` («Bad request - User ID is required or invalid model string format»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «No memories found for user»
- THEN система MUST вернуть статус `404` («No memories found for user»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to optimize memories»
- THEN система MUST вернуть статус `500` («Failed to optimize memories»)

### Requirement: GET /learnings — List Learnings
Система MUST предоставлять эндпоинт `GET /learnings` (operationId `list_learnings`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «List learning records with pagination and optional filters. For a scoped (non-admin) caller with user isolation enabled, results are bound to that user and also include records with no owner (`user_id IS NULL`) — this covers global, agent, team, session, and entity-scoped learnings; passing a `user_…»

Query-параметры: `learning_type`, `user_id`, `agent_id`, `team_id`, `session_id`, `namespace`, `entity_id`, `entity_type`, `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /learnings` с корректными параметрами
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

### Requirement: POST /learnings — Create Learning
Система MUST предоставлять эндпоинт `POST /learnings` (operationId `create_learning`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «Create a new learning record. For the identity-keyed learning types (`user_profile`, `user_memory`, `session_context`, `entity_memory`) the record id is derived deterministically from the identity fields so it reconciles with what the agent reads/writes — provide those fields (else 422), and if a re…»

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `LearningCreate`, обязательное. Поля: `learning_type` (обязательное), `content` (обязательное), `namespace`, `user_id`, `agent_id`, `team_id`, `session_id`, `entity_id`, `entity_type`, `metadata`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /learnings` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
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

### Requirement: GET /learnings/users — List Learning Users
Система MUST предоставлять эндпоинт `GET /learnings/users` (operationId `list_learning_users`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «List the users that own learning records, with a per-user count and last-updated timestamp. Intended as the entry point for a per-user view: list users here, then drill into a single user's learnings via `GET /learnings?user_id=...`. Records with no owner (`user_id IS NULL`) are excluded. Pass `lear…»

Query-параметры: `learning_type`, `user_id`, `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /learnings/users` с корректными параметрами
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

### Requirement: DELETE /learnings/users/{user_id} — Delete Learning User
Система MUST предоставлять эндпоинт `DELETE /learnings/users/{user_id}` (operationId `delete_learning_user`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «Delete the learning records owned by a user. By default removes every learning type backed by the agno_learnings table (user_profile, user_memory, and any user-scoped entity records); pass `learning_type` to restrict deletion to a single store. Records with no owner (`user_id IS NULL`) are not affec…»

Path-параметры: `user_id` — MUST быть заданы (обязательные).

Query-параметры: `learning_type`, `db_id`, `table`.

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /learnings/users/{user_id}` с корректными параметрами
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
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

### Requirement: GET /learnings/{learning_id} — Get Learning
Система MUST предоставлять эндпоинт `GET /learnings/{learning_id}` (operationId `get_learning`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «Retrieve a single learning record by its ID.»

Path-параметры: `learning_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /learnings/{learning_id}` с корректными параметрами
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

### Requirement: PATCH /learnings/{learning_id} — Update Learning
Система MUST предоставлять эндпоинт `PATCH /learnings/{learning_id}` (operationId `update_learning`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «Update a learning record. Only `content` and `metadata` may be modified; identity fields (user_id, agent_id, team_id, etc.) are immutable. Provided fields fully replace the existing values. Records with no owner (`user_id IS NULL` — shared agent/team/session/entity learnings) are readable by any cal…»

Path-параметры: `learning_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

Тело запроса: `application/json`, схема `LearningUpdate`, обязательное. Поля: `content`, `metadata`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /learnings/{learning_id}` с корректными параметрами
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

### Requirement: DELETE /learnings/{learning_id} — Delete Learning
Система MUST предоставлять эндпоинт `DELETE /learnings/{learning_id}` (operationId `delete_learning`, раздел OpenAPI «Learnings»).

Описание в OpenAPI: «Permanently delete a learning record by its ID. Records with no owner (`user_id IS NULL` — shared agent/team/session/entity learnings) may only be deleted by an admin.»

Path-параметры: `learning_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `table`.

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /learnings/{learning_id}` с корректными параметрами
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
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

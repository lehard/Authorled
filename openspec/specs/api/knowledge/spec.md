# API `knowledge` Specification

## Purpose
База знаний `shared-knowledge`: загрузка, поиск, обновление и удаление контента.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: POST /knowledge/content — Upload Content
Система MUST предоставлять эндпоинт `POST /knowledge/content` (operationId `upload_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Upload content to the knowledge base. Supports file uploads, text content, or URLs. Content is processed asynchronously in the background. Supports custom readers and chunking strategies.»

Query-параметры: `db_id`, `knowledge_id`.

Тело запроса: `multipart/form-data`, схема `Body_upload_content`. Поля: `name`, `description`, `url`, `metadata`, `file`, `text_content`, `reader_id`, `chunker`, `chunk_size`, `chunk_overlap`.

#### Scenario: Успешный ответ 202
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /knowledge/content` с корректными параметрами
- THEN система MUST вернуть статус `202` («Content upload accepted for processing»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - malformed metadata or missing content»
- THEN система MUST вернуть статус `400` («Invalid request - malformed metadata or missing content»)

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
- THEN система MUST вернуть статус `422` («Validation error in form data»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/content — List Content
Система MUST предоставлять эндпоинт `GET /knowledge/content` (operationId `get_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Retrieve paginated list of all content in the knowledge base with filtering and sorting options. Filter by status, content type, or metadata properties.»

Query-параметры: `limit`, `page`, `sort_by`, `sort_order`, `db_id`, `knowledge_id`, `parent_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/content` с корректными параметрами
- THEN система MUST вернуть статус `200` («Content list retrieved successfully»)
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

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: DELETE /knowledge/content — Delete All Content
Система MUST предоставлять эндпоинт `DELETE /knowledge/content` (operationId `delete_all_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Permanently remove all content from the knowledge base. This is a destructive operation that cannot be undone. Use with extreme caution.»

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /knowledge/content` с корректными параметрами
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
- WHEN условие ошибки: «Failed to delete all content»
- THEN система MUST вернуть статус `500` («Failed to delete all content»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: POST /knowledge/remote-content — Upload Remote Content
Система MUST предоставлять эндпоинт `POST /knowledge/remote-content` (operationId `upload_remote_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Upload content from a remote source (S3, GCS, SharePoint, GitHub) to the knowledge base. Content is processed asynchronously in the background.»

Query-параметры: `db_id`, `knowledge_id`.

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_upload_remote_content`, обязательное. Поля: `config_id` (обязательное), `path` (обязательное), `source_params`, `name`, `description`, `metadata`, `reader_id`, `chunker`, `chunk_size`, `chunk_overlap`.

#### Scenario: Успешный ответ 202
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /knowledge/remote-content` с корректными параметрами
- THEN система MUST вернуть статус `202` («Remote content upload accepted for processing»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - unknown config or missing path»
- THEN система MUST вернуть статус `400` («Invalid request - unknown config or missing path»)

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
- THEN система MUST вернуть статус `422` («Validation error in request body»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: PATCH /knowledge/content/{content_id} — Update Content
Система MUST предоставлять эндпоинт `PATCH /knowledge/content/{content_id}` (operationId `update_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Update content properties such as name, description, metadata, or processing configuration. Allows modification of existing content without re-uploading.»

Path-параметры: `content_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `knowledge_id`.

Тело запроса: `application/x-www-form-urlencoded`, схема `Body_update_content`. Поля: `name`, `description`, `metadata`, `reader_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /knowledge/content/{content_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Content updated successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid request - malformed metadata or invalid reader_id»
- THEN система MUST вернуть статус `400` («Invalid request - malformed metadata or invalid reader_id»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Content not found»
- THEN система MUST вернуть статус `404` («Content not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/content/{content_id} — Get Content by ID
Система MUST предоставлять эндпоинт `GET /knowledge/content/{content_id}` (operationId `get_content_by_id`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Retrieve detailed information about a specific content item including processing status and metadata.»

Path-параметры: `content_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/content/{content_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Content details retrieved successfully»)
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
- WHEN условие ошибки: «Content not found»
- THEN система MUST вернуть статус `404` («Content not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: DELETE /knowledge/content/{content_id} — Delete Content by ID
Система MUST предоставлять эндпоинт `DELETE /knowledge/content/{content_id}` (operationId `delete_content_by_id`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Permanently remove a specific content item from the knowledge base. This action cannot be undone.»

Path-параметры: `content_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /knowledge/content/{content_id}` с корректными параметрами
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
- WHEN условие ошибки: «Content not found»
- THEN система MUST вернуть статус `404` («Content not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Failed to delete content»
- THEN система MUST вернуть статус `500` («Failed to delete content»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: POST /knowledge/content/{content_id}/refresh — Refresh Content
Система MUST предоставлять эндпоинт `POST /knowledge/content/{content_id}/refresh` (operationId `refresh_content`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Re-ingest a URL-sourced content row from its source. For a site row this refreshes changed pages, retries failed ones, and removes pages that left the site.»

Path-параметры: `content_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 202
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /knowledge/content/{content_id}/refresh` с корректными параметрами
- THEN система MUST вернуть статус `202` («Refresh started»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Content has no source URL»
- THEN система MUST вернуть статус `400` («Content has no source URL»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Content not found»
- THEN система MUST вернуть статус `404` («Content not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/content/{content_id}/status — Get Content Status
Система MUST предоставлять эндпоинт `GET /knowledge/content/{content_id}/status` (operationId `get_content_status`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Retrieve the current processing status of a content item. Useful for monitoring asynchronous content processing progress and identifying any processing errors.»

Path-параметры: `content_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/content/{content_id}/status` с корректными параметрами
- THEN система MUST вернуть статус `200` («Content status retrieved successfully»)
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
- WHEN условие ошибки: «Content not found»
- THEN система MUST вернуть статус `404` («Content not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: POST /knowledge/search — Search Knowledge
Система MUST предоставлять эндпоинт `POST /knowledge/search` (operationId `search_knowledge`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Search the knowledge base for relevant documents using query, filters and search type.»

Тело запроса: `application/json`, схема `VectorSearchRequestSchema`, обязательное. Поля: `query` (обязательное), `db_id`, `knowledge_id`, `vector_db_ids`, `search_type`, `max_results`, `filters`, `meta`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /knowledge/search` с корректными параметрами
- THEN система MUST вернуть статус `200` («Search results retrieved successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Invalid search parameters»
- THEN система MUST вернуть статус `400` («Invalid search parameters»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «No documents found»
- THEN система MUST вернуть статус `404` («No documents found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/config — Get Config
Система MUST предоставлять эндпоинт `GET /knowledge/config` (operationId `get_knowledge_config`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «Retrieve available readers, chunkers, and configuration options for content processing. This endpoint provides metadata about supported file types, processing strategies, and filters.»

Query-параметры: `db_id`, `knowledge_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/config` с корректными параметрами
- THEN система MUST вернуть статус `200` («Knowledge configuration retrieved successfully»)
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

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/{knowledge_id}/sources — List Content Sources
Система MUST предоставлять эндпоинт `GET /knowledge/{knowledge_id}/sources` (operationId `list_content_sources`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «List all registered content sources (S3, GCS, SharePoint, GitHub) for the knowledge base.»

Path-параметры: `knowledge_id` — MUST быть заданы (обязательные).

Query-параметры: `db_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/{knowledge_id}/sources` с корректными параметрами
- THEN система MUST вернуть статус `200` («Content sources retrieved successfully»)
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
- WHEN условие ошибки: «Knowledge base not found»
- THEN система MUST вернуть статус `404` («Knowledge base not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

### Requirement: GET /knowledge/{knowledge_id}/sources/{source_id}/files — List Files in Source
Система MUST предоставлять эндпоинт `GET /knowledge/{knowledge_id}/sources/{source_id}/files` (operationId `list_source_files`, раздел OpenAPI «Knowledge»).

Описание в OpenAPI: «List available files and folders in a specific content source. Supports pagination and folder navigation.»

Path-параметры: `knowledge_id`, `source_id` — MUST быть заданы (обязательные).

Query-параметры: `prefix`, `limit`, `page`, `delimiter`, `db_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /knowledge/{knowledge_id}/sources/{source_id}/files` с корректными параметрами
- THEN система MUST вернуть статус `200` («Files listed successfully»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 400
- GIVEN платформа запущена
- WHEN условие ошибки: «Unsupported source type»
- THEN система MUST вернуть статус `400` («Unsupported source type»)

#### Scenario: Ответ 401
- GIVEN платформа запущена
- WHEN запрос отправлен без валидного Bearer-токена при включённой авторизации
- THEN система MUST вернуть статус `401` («Unauthorized»)

#### Scenario: Ответ 404
- GIVEN платформа запущена
- WHEN условие ошибки: «Knowledge base or content source not found»
- THEN система MUST вернуть статус `404` («Knowledge base or content source not found»)

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

#### Scenario: Ответ 500
- GIVEN платформа запущена
- WHEN условие ошибки: «Internal Server Error»
- THEN система MUST вернуть статус `500` («Internal Server Error»)

#### Scenario: Ответ 503
- GIVEN платформа запущена
- WHEN условие ошибки: «No knowledge base is configured on this AgentOS»
- THEN система MUST вернуть статус `503` («No knowledge base is configured on this AgentOS»)

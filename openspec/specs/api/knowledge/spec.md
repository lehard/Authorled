# Knowledge and FileSystem API Specification

## Purpose
База знаний с гибридным поиском на pgvector и файловая система заметок на PostgreSQL.

Домен содержит 17 операций HTTP (теги OpenAPI: Knowledge, FileSystem). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Shared knowledge
Система MUST создавать знание `shared-knowledge` через `create_knowledge(name="shared-knowledge", table_name="shared_knowledge")`: `PgVector` с таблицей `shared_knowledge`, `SearchType.hybrid`, эмбеддер `OpenAIEmbedder(id="text-embedding-3-small")`, и отдельный content-адаптер `PostgresDb` с ID `agentos-db-shared_knowledge_contents` и таблицей `shared_knowledge_contents`. ID content-адаптера MUST отличаться от ID БД OS `agentos-db`.

#### Scenario: Knowledge в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /config`
- THEN `knowledge.knowledge_instances` MUST содержать `shared-knowledge` с `db_id` `agentos-db-shared_knowledge_contents`

### Requirement: Статусы контента
Статус загружаемого контента MUST принимать одно из значений `ContentStatus`: `processing`, `completed`, `partial`, `failed`.

#### Scenario: Читатели контента
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /knowledge/config`
- THEN ответ MUST содержать блок `readers`, включая `website` (`WebsiteReader`)

### Requirement: Shared notes
Система MUST создавать `FileSystem(db=get_postgres_db(), namespace="shared-notes")` и MUST публиковать его инструменты в реестре (`shared_notes.tools(add_instructions=True)`, тип `tool`, имя `filesystem`).

#### Scenario: Пространства имён в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /config`
- THEN `filesystem.namespaces` MUST быть пустым списком, так как `shared_notes` не передаётся в `AgentOS`, а подключается только как инструмент реестра

### Requirement: POST /knowledge/content
Система MUST выполнять операцию «Upload Content» по запросу `POST /knowledge/content` (operationId `upload_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

Тело запроса (`multipart/form-data`, схема `Body_upload_content`):
- `name`: string | null
- `description`: string | null
- `url`: string | null
- `metadata`: string | null
- `file`: string | null
- `text_content`: string | null
- `reader_id`: string | null
- `chunker`: string | null
- `chunk_size`: integer | null
- `chunk_overlap`: integer | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /knowledge/content` с корректными параметрами
- THEN система MUST вернуть `202` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - malformed metadata or missing content»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error in form data»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `POST /knowledge/content`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/content
Система MUST возвращать операцию «List Content» по запросу `GET /knowledge/content` (operationId `get_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer | null, необязательный)
- `page` (query, integer | null, необязательный)
- `sort_by` (query, string | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc) | null, необязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)
- `parent_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/content` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ContentResponseSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/content`
- THEN система MUST вернуть `503`

### Requirement: DELETE /knowledge/content
Система MUST удалять операцию «Delete All Content» по запросу `DELETE /knowledge/content` (operationId `delete_all_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /knowledge/content` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete all content»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `DELETE /knowledge/content`
- THEN система MUST вернуть `503`

### Requirement: POST /knowledge/remote-content
Система MUST выполнять операцию «Upload Remote Content» по запросу `POST /knowledge/remote-content` (operationId `upload_remote_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_upload_remote_content`):
- `config_id`: string, обязательное
- `path`: string, обязательное
- `source_params`: string | null
- `name`: string | null
- `description`: string | null
- `metadata`: string | null
- `reader_id`: string | null
- `chunker`: string | null
- `chunk_size`: integer | null
- `chunk_overlap`: integer | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /knowledge/remote-content` с корректными параметрами
- THEN система MUST вернуть `202` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - unknown config or missing path»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation error in request body»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `POST /knowledge/remote-content`
- THEN система MUST вернуть `503`

### Requirement: PATCH /knowledge/content/{content_id}
Система MUST обновлять операцию «Update Content» по запросу `PATCH /knowledge/content/{content_id}` (operationId `update_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `content_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

Тело запроса (`application/x-www-form-urlencoded`, схема `Body_update_content`):
- `name`: string | null
- `description`: string | null
- `metadata`: string | null
- `reader_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid request - malformed metadata or invalid reader_id»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Content not found»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `PATCH /knowledge/content/{content_id}`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/content/{content_id}
Система MUST возвращать операцию «Get Content by ID» по запросу `GET /knowledge/content/{content_id}` (operationId `get_content_by_id`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `content_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/content/{content_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Content not found»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}`
- THEN система MUST вернуть `503`

### Requirement: DELETE /knowledge/content/{content_id}
Система MUST удалять операцию «Delete Content by ID» по запросу `DELETE /knowledge/content/{content_id}` (operationId `delete_content_by_id`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `content_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Content not found»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Failed to delete content»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `DELETE /knowledge/content/{content_id}`
- THEN система MUST вернуть `503`

### Requirement: POST /knowledge/content/{content_id}/refresh
Система MUST выполнять операцию «Refresh Content» по запросу `POST /knowledge/content/{content_id}/refresh` (operationId `refresh_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `content_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh` с корректными параметрами
- THEN система MUST вернуть `202` с телом по схеме `ContentResponseSchema`
- AND тело MUST содержать поля `id`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Content has no source URL»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Content not found»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `POST /knowledge/content/{content_id}/refresh`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/content/{content_id}/status
Система MUST возвращать операцию «Get Content Status» по запросу `GET /knowledge/content/{content_id}/status` (operationId `get_content_status`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `content_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ContentStatusResponse`
- AND тело MUST содержать поля `status`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Content not found»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/content/{content_id}/status`
- THEN система MUST вернуть `503`

### Requirement: POST /knowledge/search
Система MUST выполнять операцию «Search Knowledge» по запросу `POST /knowledge/search` (operationId `search_knowledge`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `VectorSearchRequestSchema`):
- `query`: string, обязательное
- `db_id`: string | null
- `knowledge_id`: string | null
- `vector_db_ids`: array[string] | null
- `search_type`: string | null
- `max_results`: integer | null
- `filters`: object | null
- `meta`: Meta | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /knowledge/search` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_VectorSearchResult_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Invalid search parameters»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «No documents found»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `POST /knowledge/search`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/config
Система MUST возвращать операцию «Get Config» по запросу `GET /knowledge/config` (operationId `get_knowledge_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `db_id` (query, string | null, необязательный)
- `knowledge_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/config` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ConfigResponseSchema`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/config`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/{knowledge_id}/sources
Система MUST возвращать операцию «List Content Sources» по запросу `GET /knowledge/{knowledge_id}/sources` (operationId `list_content_sources`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `knowledge_id` (path, string, обязательный)
- `db_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[RemoteContentSourceSchema]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Knowledge base not found»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources`
- THEN система MUST вернуть `503`

### Requirement: GET /knowledge/{knowledge_id}/sources/{source_id}/files
Система MUST возвращать операцию «List Files in Source» по запросу `GET /knowledge/{knowledge_id}/sources/{source_id}/files` (operationId `list_source_files`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `knowledge_id` (path, string, обязательный)
- `source_id` (path, string, обязательный)
- `prefix` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `delimiter` (query, string, необязательный)
- `db_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `SourceFilesResponseSchema`
- AND тело MUST содержать поля `source_id`, `source_name`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Unsupported source type»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Knowledge base or content source not found»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `500`

#### Scenario: Ответ 503
- GIVEN выполняется условие ошибки «No knowledge base is configured on this AgentOS»
- WHEN клиент выполняет `GET /knowledge/{knowledge_id}/sources/{source_id}/files`
- THEN система MUST вернуть `503`

### Requirement: GET /filesystem/files
Система MUST возвращать операцию «List Filesystem Files» по запросу `GET /filesystem/files` (operationId `list_filesystem_files`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `agent_id` (query, string | null, необязательный)
- `namespace` (query, string | null, необязательный)
- `query` (query, string | null, необязательный)
- `sort_by` (query, string (type | size | updated_at) | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc), необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /filesystem/files` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `FileSystemTableResponse`
- AND тело MUST содержать поля `entries`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /filesystem/files`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /filesystem/files`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /filesystem/files`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /filesystem/files`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /filesystem/files`
- THEN система MUST вернуть `500`

### Requirement: GET /filesystem/entries
Система MUST возвращать операцию «List Filesystem Entries» по запросу `GET /filesystem/entries` (operationId `list_filesystem_entries`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `namespace` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `directory` (query, string, необязательный)
- `sort_by` (query, string (type | size | updated_at) | null, необязательный)
- `sort_order` (query, SortOrder (asc | desc), необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /filesystem/entries` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `FileSystemListResponse`
- AND тело MUST содержать поля `namespace`, `agent_ids`, `directory`, `entries`, `usage`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /filesystem/entries`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /filesystem/entries`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /filesystem/entries`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /filesystem/entries`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /filesystem/entries`
- THEN система MUST вернуть `500`

### Requirement: GET /filesystem/content
Система MUST возвращать операцию «Read Filesystem Content» по запросу `GET /filesystem/content` (operationId `read_filesystem_content`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `namespace` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `path` (query, string, обязательный)
- `user_id` (query, string | null, необязательный)
- `offset` (query, integer, необязательный)
- `limit` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /filesystem/content` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `FileSystemContentResponse`
- AND тело MUST содержать поля `namespace`, `agent_ids`, `path`, `content`, `size_bytes`, `line_count`, `truncated`, `offset`, `limit`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /filesystem/content`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /filesystem/content`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /filesystem/content`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /filesystem/content`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /filesystem/content`
- THEN система MUST вернуть `500`

### Requirement: GET /filesystem/search
Система MUST возвращать операцию «Search Filesystem» по запросу `GET /filesystem/search` (operationId `search_filesystem`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `namespace` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `query` (query, string, обязательный)
- `directory` (query, string, необязательный)
- `user_id` (query, string | null, необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /filesystem/search` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `FileSystemSearchResponse`
- AND тело MUST содержать поля `namespace`, `agent_ids`, `query`, `directory`, `entries`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /filesystem/search`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /filesystem/search`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /filesystem/search`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /filesystem/search`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /filesystem/search`
- THEN система MUST вернуть `500`

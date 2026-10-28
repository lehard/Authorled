# Components API Specification

## Purpose
Версионируемые компоненты Studio (агенты, команды, workflows) и их конфигурации.

Домен содержит 13 операций HTTP (теги OpenAPI: Components). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: GET /components
Система MUST возвращать операцию «List Components» по запросу `GET /components` (operationId `list_components`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_type` (query, ComponentType (agent | team | workflow) | null, необязательный)
- `page` (query, integer, необязательный)
- `limit` (query, integer, необязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /components` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ComponentResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /components`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /components`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /components`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /components`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /components`
- THEN система MUST вернуть `500`

### Requirement: POST /components
Система MUST выполнять операцию «Create Component» по запросу `POST /components` (operationId `create_component`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `ComponentCreate`):
- `name`: string, обязательное
- `component_id`: string | null
- `component_type`: ComponentType (agent | team | workflow), обязательное
- `description`: string | null
- `metadata`: object | null
- `config`: object | null
- `label`: string | null
- `stage`: string, по умолчанию `"draft"`
- `notes`: string | null
- `set_current`: boolean, по умолчанию `true`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /components` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ComponentResponse`
- AND тело MUST содержать поля `component_id`, `component_type`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /components`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /components`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /components`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /components`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /components`
- THEN система MUST вернуть `500`

### Requirement: GET /components/{component_id}
Система MUST возвращать операцию «Get Component» по запросу `GET /components/{component_id}` (operationId `get_component`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /components/{component_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentResponse`
- AND тело MUST содержать поля `component_id`, `component_type`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /components/{component_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /components/{component_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /components/{component_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /components/{component_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /components/{component_id}`
- THEN система MUST вернуть `500`

### Requirement: PATCH /components/{component_id}
Система MUST обновлять операцию «Update Component» по запросу `PATCH /components/{component_id}` (operationId `update_component`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ComponentUpdate`):
- `name`: string | null
- `description`: string | null
- `component_type`: string | null
- `metadata`: object | null
- `current_version`: integer | null
- `guard`: ComponentGuard | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /components/{component_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentResponse`
- AND тело MUST содержать поля `component_id`, `component_type`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `PATCH /components/{component_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /components/{component_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `PATCH /components/{component_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /components/{component_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `PATCH /components/{component_id}`
- THEN система MUST вернуть `500`

### Requirement: DELETE /components/{component_id}
Система MUST удалять операцию «Delete Component» по запросу `DELETE /components/{component_id}` (operationId `delete_component`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `expected_current_version` (query, integer | null, необязательный)

Тело запроса: `application/json`, схема в OpenAPI не задана.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /components/{component_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /components/{component_id}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /components/{component_id}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /components/{component_id}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /components/{component_id}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `DELETE /components/{component_id}`
- THEN система MUST вернуть `500`

### Requirement: POST /components/{component_id}/restore
Система MUST выполнять операцию «Restore Component» по запросу `POST /components/{component_id}/restore` (operationId `restore_component`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /components/{component_id}/restore` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentResponse`
- AND тело MUST содержать поля `component_id`, `component_type`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /components/{component_id}/restore`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /components/{component_id}/restore`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /components/{component_id}/restore`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /components/{component_id}/restore`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /components/{component_id}/restore`
- THEN система MUST вернуть `500`

### Requirement: GET /components/{component_id}/configs
Система MUST возвращать операцию «List Configs» по запросу `GET /components/{component_id}/configs` (operationId `list_configs`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `include_config` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /components/{component_id}/configs` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `array[ComponentConfigResponse]`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /components/{component_id}/configs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /components/{component_id}/configs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /components/{component_id}/configs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs`
- THEN система MUST вернуть `500`

### Requirement: POST /components/{component_id}/configs
Система MUST выполнять операцию «Create Config Version» по запросу `POST /components/{component_id}/configs` (operationId `create_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ConfigCreate`):
- `config`: object, обязательное
- `version`: integer | null
- `label`: string | null
- `stage`: string, по умолчанию `"draft"`
- `notes`: string | null
- `links`: array[object] | null
- `set_current`: boolean, по умолчанию `true`
- `guard`: ComponentGuard | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /components/{component_id}/configs` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ComponentConfigResponse`
- AND тело MUST содержать поля `component_id`, `version`, `stage`, `config`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /components/{component_id}/configs`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /components/{component_id}/configs`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /components/{component_id}/configs`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /components/{component_id}/configs`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /components/{component_id}/configs`
- THEN система MUST вернуть `500`

### Requirement: PATCH /components/{component_id}/configs/{version}
Система MUST обновлять операцию «Update Draft Config» по запросу `PATCH /components/{component_id}/configs/{version}` (operationId `update_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `version` (path, integer, обязательный)

Тело запроса (`application/json`, схема `ConfigUpdate`):
- `config`: object | null
- `label`: string | null
- `stage`: string | null
- `notes`: string | null
- `links`: array[object] | null
- `guard`: ComponentGuard | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentConfigResponse`
- AND тело MUST содержать поля `component_id`, `version`, `stage`, `config`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `PATCH /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `500`

### Requirement: GET /components/{component_id}/configs/{version}
Система MUST возвращать операцию «Get Config Version» по запросу `GET /components/{component_id}/configs/{version}` (operationId `get_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.
Факт Agno 3.1.10 (`agno/os/routers/components/components.py`): функция `get_config_version` объявлена с operationId `get_config`, который уже занят `GET /config` (домен core); FastAPI предупреждает `Duplicate Operation ID get_config`, идентификатор в OpenAPI не уникален, генераторы клиентов по схеме будут конфликтовать. Не исправляется в коде приложения.

Параметры:
- `component_id` (path, string, обязательный)
- `version` (path, integer, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentConfigResponse`
- AND тело MUST содержать поля `component_id`, `version`, `stage`, `config`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `500`

### Requirement: DELETE /components/{component_id}/configs/{version}
Система MUST удалять операцию «Delete Config Version» по запросу `DELETE /components/{component_id}/configs/{version}` (operationId `delete_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `version` (path, integer, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `DELETE /components/{component_id}/configs/{version}`
- THEN система MUST вернуть `500`

### Requirement: GET /components/{component_id}/configs/current
Система MUST возвращать операцию «Get Current Config» по запросу `GET /components/{component_id}/configs/current` (operationId `get_current_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /components/{component_id}/configs/current` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentConfigResponse`
- AND тело MUST содержать поля `component_id`, `version`, `stage`, `config`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `GET /components/{component_id}/configs/current`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `GET /components/{component_id}/configs/current`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `GET /components/{component_id}/configs/current`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs/current`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `GET /components/{component_id}/configs/current`
- THEN система MUST вернуть `500`

### Requirement: POST /components/{component_id}/configs/{version}/set-current
Система MUST выполнять операцию «Set Current Config Version» по запросу `POST /components/{component_id}/configs/{version}/set-current` (operationId `set_current_config`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `component_id` (path, string, обязательный)
- `version` (path, integer, обязательный)

Тело запроса: `application/json`, схема в OpenAPI не задана.

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ComponentResponse`
- AND тело MUST содержать поля `component_id`, `component_type`, `created_at`

#### Scenario: Ответ 400
- GIVEN выполняется условие ошибки «Bad Request»
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current`
- THEN система MUST вернуть `400`

#### Scenario: Ответ 401
- GIVEN выполняется условие ошибки «Unauthorized»
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current`
- THEN система MUST вернуть `401`

#### Scenario: Ответ 404
- GIVEN выполняется условие ошибки «Not Found»
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current`
- THEN система MUST вернуть `404`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current`
- THEN система MUST вернуть `422`

#### Scenario: Ответ 500
- GIVEN выполняется условие ошибки «Internal Server Error»
- WHEN клиент выполняет `POST /components/{component_id}/configs/{version}/set-current`
- THEN система MUST вернуть `500`

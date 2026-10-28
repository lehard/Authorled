# Identity API Specification

## Purpose
Каталог пользователей (`user_directory=True`) и сервисные учётные записи.

Домен содержит 9 операций HTTP (теги OpenAPI: User directory, Service Accounts). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Защита каталога пользователей
Маршруты `/users*` MUST требовать аутентификацию при включённой авторизации, несмотря на то что OpenAPI не объявляет для них схему безопасности (факт Agno 3.1.10: в `GET /openapi.json` у операций `/users*` нет `security`, но в `prd` без токена ответ `401`). Клиентам и генераторам клиентов не следует выводить отсутствие аутентификации из схемы; не исправляется в коде приложения.

#### Scenario: Каталог без токена в prd
- GIVEN приложение запущено с `RUNTIME_ENV=prd`
- WHEN клиент выполняет `GET`, `POST`, `PATCH` или `DELETE` на `/users` или `/users/{user_id}` без токена
- THEN система MUST вернуть `401`

### Requirement: GET /users
Система MUST возвращать операцию «List Users» по запросу `GET /users` (operationId `list_users_users_get`).
В OpenAPI для маршрута не объявлена схема безопасности.

Параметры:
- `include_disabled` (query, boolean, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `search` (query, string | null, необязательный)
- `sort_by` (query, string, необязательный)
- `sort_order` (query, SortOrder (asc | desc), необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /users` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_UserSchema_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /users`
- THEN система MUST вернуть `422`

### Requirement: POST /users
Система MUST выполнять операцию «Create User» по запросу `POST /users` (operationId `create_user_users_post`).
В OpenAPI для маршрута не объявлена схема безопасности.

Тело запроса (`application/json`, схема `CreateUserRequest`):
- `id`: string, обязательное
- `email`: string | null
- `name`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /users` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserSchema`
- AND тело MUST содержать поля `id`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /users`
- THEN система MUST вернуть `422`

### Requirement: GET /users/metrics
Система MUST возвращать операцию «Get User Metrics» по запросу `GET /users/metrics` (operationId `get_user_metrics_users_metrics_get`).
В OpenAPI для маршрута не объявлена схема безопасности.

Параметры:
- `starting_date` (query, string | null, необязательный)
- `ending_date` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /users/metrics` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserManagementMetrics`
- AND тело MUST содержать поля `total`, `active`, `disabled`, `created_per_day`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /users/metrics`
- THEN система MUST вернуть `422`

### Requirement: GET /users/{user_id}
Система MUST возвращать операцию «Get User» по запросу `GET /users/{user_id}` (operationId `get_user_users__user_id__get`).
В OpenAPI для маршрута не объявлена схема безопасности.

Параметры:
- `user_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserSchema`
- AND тело MUST содержать поля `id`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /users/{user_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /users/{user_id}
Система MUST обновлять операцию «Update User» по запросу `PATCH /users/{user_id}` (operationId `update_user_users__user_id__patch`).
В OpenAPI для маршрута не объявлена схема безопасности.

Параметры:
- `user_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `UpdateUserRequest`):
- `email`: string | null
- `name`: string | null
- `disabled`: boolean | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `UserSchema`
- AND тело MUST содержать поля `id`, `status`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /users/{user_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /users/{user_id}
Система MUST удалять операцию «Delete User» по запросу `DELETE /users/{user_id}` (operationId `delete_user_users__user_id__delete`).
В OpenAPI для маршрута не объявлена схема безопасности.

Параметры:
- `user_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть `200`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /users/{user_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /service-accounts
Система MUST выполнять операцию «Create Service Account» по запросу `POST /service-accounts` (operationId `create_service_account_service_accounts_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `ServiceAccountCreate`):
- `name`: string, обязательное
- `scopes`: array[ScopeItem] | null
- `expires_in_days`: integer | null, по умолчанию `90`
- `never_expires`: boolean, по умолчанию `false`
- `allow_privileged_scopes`: boolean, по умолчанию `false`

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /service-accounts` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ServiceAccountCreateResponse`
- AND тело MUST содержать поля `id`, `name`, `principal`, `token_prefix`, `created_at`, `token`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /service-accounts`
- THEN система MUST вернуть `422`

### Requirement: GET /service-accounts
Система MUST возвращать операцию «List Service Accounts» по запросу `GET /service-accounts` (operationId `list_service_accounts_service_accounts_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `include_revoked` (query, boolean, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `sort_by` (query, string, необязательный)
- `sort_order` (query, string, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /service-accounts` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ServiceAccountResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /service-accounts`
- THEN система MUST вернуть `422`

### Requirement: DELETE /service-accounts/{service_account_id}
Система MUST удалять операцию «Revoke Service Account» по запросу `DELETE /service-accounts/{service_account_id}` (operationId `revoke_service_account_service_accounts__service_account_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `service_account_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /service-accounts/{service_account_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /service-accounts/{service_account_id}`
- THEN система MUST вернуть `422`

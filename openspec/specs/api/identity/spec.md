# API `identity` Specification

## Purpose
Сервисные аккаунты и каталог пользователей (`user_directory=True`).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: POST /service-accounts — Create Service Account
Система MUST предоставлять эндпоинт `POST /service-accounts` (operationId `create_service_account_service_accounts_post`, раздел OpenAPI «Service Accounts»).

Описание в OpenAPI: «Mint a service account token. The plaintext token is returned exactly once.»

Тело запроса: `application/json`, схема `ServiceAccountCreate`, обязательное. Поля: `name` (обязательное), `scopes`, `expires_in_days`, `never_expires`, `allow_privileged_scopes`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /service-accounts` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /service-accounts — List Service Accounts
Система MUST предоставлять эндпоинт `GET /service-accounts` (operationId `list_service_accounts_service_accounts_get`, раздел OpenAPI «Service Accounts»).

Описание в OpenAPI: «List service accounts. Returns metadata and display prefixes only - never hashes or plaintext.»

Query-параметры: `include_revoked`, `limit`, `page`, `sort_by`, `sort_order`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /service-accounts` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /service-accounts/{service_account_id} — Revoke Service Account
Система MUST предоставлять эндпоинт `DELETE /service-accounts/{service_account_id}` (operationId `revoke_service_account_service_accounts__service_account_id__delete`, раздел OpenAPI «Service Accounts»).

Описание в OpenAPI: «Revoke a service account. Idempotent.»

Path-параметры: `service_account_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /service-accounts/{service_account_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /users — List Users
Система MUST предоставлять эндпоинт `GET /users` (operationId `list_users_users_get`, раздел OpenAPI «User directory»).

Query-параметры: `include_disabled`, `limit`, `page`, `search`, `sort_by`, `sort_order`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /users` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /users — Create User
Система MUST предоставлять эндпоинт `POST /users` (operationId `create_user_users_post`, раздел OpenAPI «User directory»).

Тело запроса: `application/json`, схема `CreateUserRequest`, обязательное. Поля: `id` (обязательное), `email`, `name`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /users` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /users/metrics — Get User Metrics
Система MUST предоставлять эндпоинт `GET /users/metrics` (operationId `get_user_metrics_users_metrics_get`, раздел OpenAPI «User directory»).

Описание в OpenAPI: «Directory size (total, active, disabled), users created per UTC day, and, when a role store is configured, users per role and how many hold none. The date range bounds only the per-day series. Served through the async store path so it works whether the directory is bound to a sync or an async databa…»

Query-параметры: `starting_date`, `ending_date`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /users/metrics` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /users/{user_id} — Get User
Система MUST предоставлять эндпоинт `GET /users/{user_id}` (operationId `get_user_users__user_id__get`, раздел OpenAPI «User directory»).

Path-параметры: `user_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /users/{user_id} — Update User
Система MUST предоставлять эндпоинт `PATCH /users/{user_id}` (operationId `update_user_users__user_id__patch`, раздел OpenAPI «User directory»).

Описание в OpenAPI: «Update a user. ``disabled`` is the revocation kill-switch: a disabled user is denied at the enforcement point on their next request, even with a still-valid token.»

Path-параметры: `user_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `UpdateUserRequest`, обязательное. Поля: `email`, `name`, `disabled`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /users/{user_id} — Delete User
Система MUST предоставлять эндпоинт `DELETE /users/{user_id}` (operationId `delete_user_users__user_id__delete`, раздел OpenAPI «User directory»).

Path-параметры: `user_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /users/{user_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

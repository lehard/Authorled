# API `company` Specification

## Purpose
CompanyOS: продукты, источники, рутины, проекты, задачи, wiki, решения и исполнение задач агентами.

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /company/products — List Products
Система MUST предоставлять эндпоинт `GET /company/products` (operationId `list_products_company_products_get`, раздел OpenAPI «Products»).

Query-параметры: `limit`, `page`, `include_deleted`, `sort_by`, `sort_order`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/products` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/products — Create Product
Система MUST предоставлять эндпоинт `POST /company/products` (operationId `create_product_company_products_post`, раздел OpenAPI «Products»).

Тело запроса: `application/json`, схема `ProductCreate`, обязательное. Поля: `name` (обязательное), `purpose`, `metadata`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/products` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/products/{product_id} — Get Product
Система MUST предоставлять эндпоинт `GET /company/products/{product_id}` (operationId `get_product_company_products__product_id__get`, раздел OpenAPI «Products»).

Path-параметры: `product_id` — MUST быть заданы (обязательные).

Query-параметры: `include_deleted`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /company/products/{product_id} — Update Product
Система MUST предоставлять эндпоинт `PATCH /company/products/{product_id}` (operationId `update_product_company_products__product_id__patch`, раздел OpenAPI «Products»).

Path-параметры: `product_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `ProductUpdate`, обязательное. Поля: `name`, `purpose`, `metadata`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /company/products/{product_id} — Delete Product
Система MUST предоставлять эндпоинт `DELETE /company/products/{product_id}` (operationId `delete_product_company_products__product_id__delete`, раздел OpenAPI «Products»).

Path-параметры: `product_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/products/{product_id}/restore — Restore Product
Система MUST предоставлять эндпоинт `POST /company/products/{product_id}/restore` (operationId `restore_product_company_products__product_id__restore_post`, раздел OpenAPI «Products»).

Path-параметры: `product_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/products/{product_id}/restore` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/sources — List Sources
Система MUST предоставлять эндпоинт `GET /company/sources` (operationId `list_sources_company_sources_get`, раздел OpenAPI «Company heartbeat»).

Query-параметры: `product_id`, `limit`, `page`, `include_deleted`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/sources` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/sources — Create Source
Система MUST предоставлять эндпоинт `POST /company/sources` (operationId `create_source_company_sources_post`, раздел OpenAPI «Company heartbeat»).

Тело запроса: `application/json`, схема `SourceCreate`, обязательное. Поля: `id`, `type` (обязательное), `reference` (обязательное), `credential_ref`, `config`, `product_id` (обязательное).

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/sources` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /company/sources/{source_id} — Delete Source
Система MUST предоставлять эндпоинт `DELETE /company/sources/{source_id}` (operationId `delete_source_company_sources__source_id__delete`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `source_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /company/sources/{source_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/sources/{source_id}/restore — Restore Source
Система MUST предоставлять эндпоинт `POST /company/sources/{source_id}/restore` (operationId `restore_source_company_sources__source_id__restore_post`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `source_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/sources/{source_id}/restore` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/routines — List Routines
Система MUST предоставлять эндпоинт `GET /company/routines` (operationId `list_routines_company_routines_get`, раздел OpenAPI «Company heartbeat»).

Query-параметры: `product_id`, `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/routines` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/routines — Create Routine
Система MUST предоставлять эндпоинт `POST /company/routines` (operationId `create_routine_company_routines_post`, раздел OpenAPI «Company heartbeat»).

Тело запроса: `application/json`, схема `RoutineCreate`, обязательное. Поля: `name` (обязательное), `template`, `executor_type` (обязательное), `executor_id` (обязательное), `cron_expr`, `timezone`, `instructions`, `auto_accept`, `product_id` (обязательное).

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/routines` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/routines/{routine_id} — Get Routine
Система MUST предоставлять эндпоинт `GET /company/routines/{routine_id}` (operationId `get_routine_company_routines__routine_id__get`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/routines/{routine_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /company/routines/{routine_id} — Update Routine
Система MUST предоставлять эндпоинт `PATCH /company/routines/{routine_id}` (operationId `update_routine_company_routines__routine_id__patch`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `RoutineUpdate`, обязательное. Поля: `name`, `executor_type`, `executor_id`, `instructions`, `cron_expr`, `timezone`, `auto_accept`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /company/routines/{routine_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/routines/{routine_id}/trigger — Trigger Routine
Система MUST предоставлять эндпоинт `POST /company/routines/{routine_id}/trigger` (operationId `trigger_routine_company_routines__routine_id__trigger_post`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/routines/{routine_id}/trigger` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/routines/{routine_id}/pause — Pause Routine
Система MUST предоставлять эндпоинт `POST /company/routines/{routine_id}/pause` (operationId `pause_routine_company_routines__routine_id__pause_post`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/routines/{routine_id}/pause` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/routines/{routine_id}/resume — Resume Routine
Система MUST предоставлять эндпоинт `POST /company/routines/{routine_id}/resume` (operationId `resume_routine_company_routines__routine_id__resume_post`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/routines/{routine_id}/resume` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/routines/{routine_id}/runs — Routine Runs
Система MUST предоставлять эндпоинт `GET /company/routines/{routine_id}/runs` (operationId `routine_runs_company_routines__routine_id__runs_get`, раздел OpenAPI «Company heartbeat»).

Path-параметры: `routine_id` — MUST быть заданы (обязательные).

Query-параметры: `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/routines/{routine_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/setup — Setup
Система MUST предоставлять эндпоинт `POST /company/setup` (operationId `setup_company_setup_post`, раздел OpenAPI «Company heartbeat»).

Тело запроса: `application/json`, схема `Setup`, обязательное. Поля: `id`, `name` (обязательное), `purpose`, `user_id`, `metadata`, `sources`, `routines`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/setup` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/projects — List Projects
Система MUST предоставлять эндпоинт `GET /company/projects` (operationId `list_projects_company_projects_get`, раздел OpenAPI «Projects»).

Query-параметры: `limit`, `page`, `include_deleted`, `sort_by`, `sort_order`, `product_id`, `status`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/projects` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/projects — Create Project
Система MUST предоставлять эндпоинт `POST /company/projects` (operationId `create_project_company_projects_post`, раздел OpenAPI «Projects»).

Тело запроса: `application/json`, схема `ProjectCreate`, обязательное. Поля: `product_id` (обязательное), `name` (обязательное), `outcome`, `target_date`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/projects` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/projects/{project_id} — Get Project
Система MUST предоставлять эндпоинт `GET /company/projects/{project_id}` (operationId `get_project_company_projects__project_id__get`, раздел OpenAPI «Projects»).

Path-параметры: `project_id` — MUST быть заданы (обязательные).

Query-параметры: `include_deleted`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /company/projects/{project_id} — Update Project
Система MUST предоставлять эндпоинт `PATCH /company/projects/{project_id}` (operationId `update_project_company_projects__project_id__patch`, раздел OpenAPI «Projects»).

Path-параметры: `project_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `ProjectUpdate`, обязательное. Поля: `name`, `outcome`, `target_date`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /company/projects/{project_id} — Delete Project
Система MUST предоставлять эндпоинт `DELETE /company/projects/{project_id}` (operationId `delete_project_company_projects__project_id__delete`, раздел OpenAPI «Projects»).

Path-параметры: `project_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/projects/{project_id}/restore — Restore Project
Система MUST предоставлять эндпоинт `POST /company/projects/{project_id}/restore` (operationId `restore_project_company_projects__project_id__restore_post`, раздел OpenAPI «Projects»).

Path-параметры: `project_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/projects/{project_id}/restore` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/projects/{project_id}/transitions — Transition Project
Система MUST предоставлять эндпоинт `POST /company/projects/{project_id}/transitions` (operationId `transition_project_company_projects__project_id__transitions_post`, раздел OpenAPI «Projects»).

Path-параметры: `project_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `ProjectTransition`, обязательное. Поля: `target` (обязательное), `reason` (обязательное).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/projects/{project_id}/transitions` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/tasks — List Tasks
Система MUST предоставлять эндпоинт `GET /company/tasks` (operationId `list_tasks_company_tasks_get`, раздел OpenAPI «Tasks»).

Query-параметры: `limit`, `page`, `include_deleted`, `sort_by`, `sort_order`, `product_id`, `status`, `project_id`, `failed`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/tasks` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/tasks — Create Task
Система MUST предоставлять эндпоинт `POST /company/tasks` (operationId `create_task_company_tasks_post`, раздел OpenAPI «Tasks»).

Тело запроса: `application/json`, схема `TaskCreate`, обязательное. Поля: `executor_type`, `executor_id`, `product_id` (обязательное), `title` (обязательное), `brief`, `project_id` (обязательное), `evidence`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/tasks` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/tasks/{task_id} — Get Task
Система MUST предоставлять эндпоинт `GET /company/tasks/{task_id}` (operationId `get_task_company_tasks__task_id__get`, раздел OpenAPI «Tasks»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

Query-параметры: `include_deleted`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PATCH /company/tasks/{task_id} — Update Task
Система MUST предоставлять эндпоинт `PATCH /company/tasks/{task_id}` (operationId `update_task_company_tasks__task_id__patch`, раздел OpenAPI «Tasks»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `TaskUpdate`, обязательное. Поля: `executor_type`, `executor_id`, `title`, `brief`, `project_id`, `evidence`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PATCH /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /company/tasks/{task_id} — Delete Task
Система MUST предоставлять эндпоинт `DELETE /company/tasks/{task_id}` (operationId `delete_task_company_tasks__task_id__delete`, раздел OpenAPI «Tasks»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/tasks/{task_id}/restore — Restore Task
Система MUST предоставлять эндпоинт `POST /company/tasks/{task_id}/restore` (operationId `restore_task_company_tasks__task_id__restore_post`, раздел OpenAPI «Tasks»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/tasks/{task_id}/restore` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/tasks/{task_id}/transitions — Transition Task
Система MUST предоставлять эндпоинт `POST /company/tasks/{task_id}/transitions` (operationId `transition_task_company_tasks__task_id__transitions_post`, раздел OpenAPI «Tasks»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `TaskTransition`, обязательное. Поля: `target` (обязательное), `reason` (обязательное), `executor_type`, `executor_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/tasks/{task_id}/transitions` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/products/{product_id}/wiki — List Product Wiki
Система MUST предоставлять эндпоинт `GET /company/products/{product_id}/wiki` (operationId `list_product_wiki_company_products__product_id__wiki_get`, раздел OpenAPI «Company playbook»).

Path-параметры: `product_id` — MUST быть заданы (обязательные).

Query-параметры: `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/products/{product_id}/wiki` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/products/{product_id}/wiki/{path} — Read Product Wiki
Система MUST предоставлять эндпоинт `GET /company/products/{product_id}/wiki/{path}` (operationId `read_product_wiki_company_products__product_id__wiki__path__get`, раздел OpenAPI «Company playbook»).

Path-параметры: `path`, `product_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/products/{product_id}/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PUT /company/products/{product_id}/wiki/{path} — Write Product Wiki
Система MUST предоставлять эндпоинт `PUT /company/products/{product_id}/wiki/{path}` (operationId `write_product_wiki_company_products__product_id__wiki__path__put`, раздел OpenAPI «Company playbook»).

Path-параметры: `path`, `product_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `WikiWrite`, обязательное. Поля: `content` (обязательное), `expected_version` (обязательное).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PUT /company/products/{product_id}/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/wiki — List Company Wiki
Система MUST предоставлять эндпоинт `GET /company/wiki` (operationId `list_company_wiki_company_wiki_get`, раздел OpenAPI «Company playbook»).

Query-параметры: `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/wiki` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/wiki/{path} — Read Company Wiki
Система MUST предоставлять эндпоинт `GET /company/wiki/{path}` (operationId `read_company_wiki_company_wiki__path__get`, раздел OpenAPI «Company playbook»).

Path-параметры: `path` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: PUT /company/wiki/{path} — Write Company Wiki
Система MUST предоставлять эндпоинт `PUT /company/wiki/{path}` (operationId `write_company_wiki_company_wiki__path__put`, раздел OpenAPI «Company playbook»).

Path-параметры: `path` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `WikiWrite`, обязательное. Поля: `content` (обязательное), `expected_version` (обязательное).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `PUT /company/wiki/{path}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/decisions — List Decisions
Система MUST предоставлять эндпоинт `GET /company/decisions` (operationId `list_decisions_company_decisions_get`, раздел OpenAPI «Company playbook»).

Query-параметры: `query`, `agent_id`, `session_id`, `days`, `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/decisions` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/decisions — Create Decision
Система MUST предоставлять эндпоинт `POST /company/decisions` (operationId `create_decision_company_decisions_post`, раздел OpenAPI «Company playbook»).

Тело запроса: `application/json`, схема `DecisionCreate`, обязательное. Поля: `decision` (обязательное), `reasoning`, `context`, `outcome`.

#### Scenario: Успешный ответ 201
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/decisions` с корректными параметрами
- THEN система MUST вернуть статус `201` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/tasks/{task_id}/runs — Start
Система MUST предоставлять эндпоинт `POST /company/tasks/{task_id}/runs` (operationId `start_company_tasks__task_id__runs_post`, раздел OpenAPI «Company execution»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `TaskRunCreate`. Поля: `attempt`.

#### Scenario: Успешный ответ 202
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/tasks/{task_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `202` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/tasks/{task_id}/runs — Runs
Система MUST предоставлять эндпоинт `GET /company/tasks/{task_id}/runs` (operationId `runs_company_tasks__task_id__runs_get`, раздел OpenAPI «Company execution»).

Path-параметры: `task_id` — MUST быть заданы (обязательные).

Query-параметры: `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/tasks/{task_id}/runs` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/runs/{run_id} — Get Run
Система MUST предоставлять эндпоинт `GET /company/runs/{run_id}` (operationId `get_run_company_runs__run_id__get`, раздел OpenAPI «Company execution»).

Path-параметры: `run_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/runs/{run_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /company/runs/{run_id}/cancel — Cancel
Система MUST предоставлять эндпоинт `POST /company/runs/{run_id}/cancel` (operationId `cancel_company_runs__run_id__cancel_post`, раздел OpenAPI «Company execution»).

Path-параметры: `run_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /company/runs/{run_id}/cancel` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /company/attention — Attention
Система MUST предоставлять эндпоинт `GET /company/attention` (operationId `attention_company_attention_get`, раздел OpenAPI «Company execution»).

Query-параметры: `product_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /company/attention` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

# Company API Specification

## Purpose
CompanyOS: Products, Projects и Tasks. Объявления в `app/company.py`, хранение в `agno_company_*`.

Домен содержит 20 операций HTTP (теги OpenAPI: Products, Projects, Tasks). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Объявленный Product
Система MUST объявлять Product `this-agentos` (`name` `AgentOS`, `purpose` «Improve this AgentOS by scanning this codebase and agno releases.») и MUST засевать его при старте.

#### Scenario: Список Products
- GIVEN платформа запущена на чистой БД
- WHEN клиент выполняет `GET /company/products`
- THEN ответ MUST содержать Product `this-agentos`
- AND `metadata` MUST содержать `routine_ids` и `archive_window_days: 14`
- AND `counts.tasks` MUST содержать счётчики `backlog`, `ready`, `in_progress`, `in_review`, `done`, `cancelled`

### Requirement: Переходы Task
Переход Task (`POST /company/tasks/{task_id}/transitions`) MUST принимать `target` из `backlog`, `ready`, `in_progress`, `in_review`, `done`, `cancelled` и обязательный `reason`; MAY принимать `executor_type` и `executor_id`.

#### Scenario: Недопустимый target
- GIVEN Task существует
- WHEN клиент передаёт `target`, отсутствующий в перечислении
- THEN система MUST вернуть `422`

### Requirement: Переходы Project
Переход Project (`POST /company/projects/{project_id}/transitions`) MUST принимать `target` из `proposed`, `active`, `done`, `cancelled` и обязательный `reason`.

#### Scenario: Переход без reason
- GIVEN Project существует
- WHEN клиент передаёт тело без `reason`
- THEN система MUST вернуть `422`

### Requirement: GET /company/products
Система MUST возвращать операцию «List Products» по запросу `GET /company/products` (operationId `list_products_company_products_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `include_deleted` (query, boolean, необязательный)
- `sort_by` (query, string (created_at | updated_at), необязательный)
- `sort_order` (query, string (asc | desc), необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/products` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ProductResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/products`
- THEN система MUST вернуть `422`

### Requirement: POST /company/products
Система MUST выполнять операцию «Create Product» по запросу `POST /company/products` (operationId `create_product_company_products_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `ProductCreate`):
- `name`: string, обязательное
- `purpose`: string | null
- `metadata`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/products` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ProductResponse`
- AND тело MUST содержать поля `id`, `name`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/products`
- THEN система MUST вернуть `422`

### Requirement: GET /company/products/{product_id}
Система MUST возвращать операцию «Get Product» по запросу `GET /company/products/{product_id}` (operationId `get_product_company_products__product_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (path, string, обязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProductResponse`
- AND тело MUST содержать поля `id`, `name`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/products/{product_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /company/products/{product_id}
Система MUST обновлять операцию «Update Product» по запросу `PATCH /company/products/{product_id}` (operationId `update_product_company_products__product_id__patch`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ProductUpdate`):
- `name`: string | null
- `purpose`: string | null
- `metadata`: object | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProductResponse`
- AND тело MUST содержать поля `id`, `name`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /company/products/{product_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /company/products/{product_id}
Система MUST удалять операцию «Delete Product» по запросу `DELETE /company/products/{product_id}` (operationId `delete_product_company_products__product_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /company/products/{product_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /company/products/{product_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/products/{product_id}/restore
Система MUST выполнять операцию «Restore Product» по запросу `POST /company/products/{product_id}/restore` (operationId `restore_product_company_products__product_id__restore_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `product_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/products/{product_id}/restore` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProductResponse`
- AND тело MUST содержать поля `id`, `name`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/products/{product_id}/restore`
- THEN система MUST вернуть `422`

### Requirement: GET /company/projects
Система MUST возвращать операцию «List Projects» по запросу `GET /company/projects` (operationId `list_projects_company_projects_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `include_deleted` (query, boolean, необязательный)
- `sort_by` (query, string (created_at | updated_at), необязательный)
- `sort_order` (query, string (asc | desc), необязательный)
- `product_id` (query, string | null, необязательный)
- `status` (query, string (proposed | active | done | cancelled) | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/projects` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ProjectResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/projects`
- THEN система MUST вернуть `422`

### Requirement: POST /company/projects
Система MUST выполнять операцию «Create Project» по запросу `POST /company/projects` (operationId `create_project_company_projects_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `ProjectCreate`):
- `product_id`: string, обязательное
- `name`: string, обязательное
- `outcome`: string | null
- `target_date`: integer | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/projects` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `ProjectResponse`
- AND тело MUST содержать поля `product_id`, `name`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/projects`
- THEN система MUST вернуть `422`

### Requirement: GET /company/projects/{project_id}
Система MUST возвращать операцию «Get Project» по запросу `GET /company/projects/{project_id}` (operationId `get_project_company_projects__project_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `project_id` (path, string, обязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProjectResponse`
- AND тело MUST содержать поля `product_id`, `name`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/projects/{project_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /company/projects/{project_id}
Система MUST обновлять операцию «Update Project» по запросу `PATCH /company/projects/{project_id}` (operationId `update_project_company_projects__project_id__patch`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `project_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ProjectUpdate`):
- `name`: string | null
- `outcome`: string | null
- `target_date`: integer | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProjectResponse`
- AND тело MUST содержать поля `product_id`, `name`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /company/projects/{project_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /company/projects/{project_id}
Система MUST удалять операцию «Delete Project» по запросу `DELETE /company/projects/{project_id}` (operationId `delete_project_company_projects__project_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `project_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /company/projects/{project_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /company/projects/{project_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/projects/{project_id}/restore
Система MUST выполнять операцию «Restore Project» по запросу `POST /company/projects/{project_id}/restore` (operationId `restore_project_company_projects__project_id__restore_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `project_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/projects/{project_id}/restore` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProjectResponse`
- AND тело MUST содержать поля `product_id`, `name`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/projects/{project_id}/restore`
- THEN система MUST вернуть `422`

### Requirement: POST /company/projects/{project_id}/transitions
Система MUST выполнять операцию «Transition Project» по запросу `POST /company/projects/{project_id}/transitions` (operationId `transition_project_company_projects__project_id__transitions_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `project_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ProjectTransition`):
- `target`: string (proposed | active | done | cancelled), обязательное
- `reason`: string, обязательное

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/projects/{project_id}/transitions` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ProjectResponse`
- AND тело MUST содержать поля `product_id`, `name`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/projects/{project_id}/transitions`
- THEN система MUST вернуть `422`

### Requirement: GET /company/tasks
Система MUST возвращать операцию «List Tasks» по запросу `GET /company/tasks` (operationId `list_tasks_company_tasks_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)
- `include_deleted` (query, boolean, необязательный)
- `sort_by` (query, string (created_at | updated_at), необязательный)
- `sort_order` (query, string (asc | desc), необязательный)
- `product_id` (query, string | null, необязательный)
- `status` (query, string (backlog | ready | in_progress | in_review | done | cancelled) | null, необязательный)
- `project_id` (query, string | null, необязательный)
- `failed` (query, boolean | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/tasks` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_TaskResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/tasks`
- THEN система MUST вернуть `422`

### Requirement: POST /company/tasks
Система MUST выполнять операцию «Create Task» по запросу `POST /company/tasks` (operationId `create_task_company_tasks_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Тело запроса (`application/json`, схема `TaskCreate`):
- `executor_type`: string (agent | team | workflow) | null
- `executor_id`: string | null
- `product_id`: string, обязательное
- `title`: string, обязательное
- `brief`: string | null
- `project_id`: string, обязательное
- `evidence`: array[object] | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/tasks` с корректными параметрами
- THEN система MUST вернуть `201` с телом по схеме `TaskResponse`
- AND тело MUST содержать поля `product_id`, `title`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/tasks`
- THEN система MUST вернуть `422`

### Requirement: GET /company/tasks/{task_id}
Система MUST возвращать операцию «Get Task» по запросу `GET /company/tasks/{task_id}` (operationId `get_task_company_tasks__task_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)
- `include_deleted` (query, boolean, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `TaskResponse`
- AND тело MUST содержать поля `product_id`, `title`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /company/tasks/{task_id}`
- THEN система MUST вернуть `422`

### Requirement: PATCH /company/tasks/{task_id}
Система MUST обновлять операцию «Update Task» по запросу `PATCH /company/tasks/{task_id}` (operationId `update_task_company_tasks__task_id__patch`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `TaskUpdate`):
- `executor_type`: string (agent | team | workflow) | null
- `executor_id`: string | null
- `title`: string | null
- `brief`: string | null
- `project_id`: string | null
- `evidence`: array[object] | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `PATCH /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `TaskResponse`
- AND тело MUST содержать поля `product_id`, `title`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `PATCH /company/tasks/{task_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /company/tasks/{task_id}
Система MUST удалять операцию «Delete Task» по запросу `DELETE /company/tasks/{task_id}` (operationId `delete_task_company_tasks__task_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /company/tasks/{task_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /company/tasks/{task_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /company/tasks/{task_id}/restore
Система MUST выполнять операцию «Restore Task» по запросу `POST /company/tasks/{task_id}/restore` (operationId `restore_task_company_tasks__task_id__restore_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/tasks/{task_id}/restore` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `TaskResponse`
- AND тело MUST содержать поля `product_id`, `title`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/tasks/{task_id}/restore`
- THEN система MUST вернуть `422`

### Requirement: POST /company/tasks/{task_id}/transitions
Система MUST выполнять операцию «Transition Task» по запросу `POST /company/tasks/{task_id}/transitions` (operationId `transition_task_company_tasks__task_id__transitions_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `task_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `TaskTransition`):
- `target`: string (backlog | ready | in_progress | in_review | done | cancelled), обязательное
- `reason`: string, обязательное
- `executor_type`: string (agent | team | workflow) | null
- `executor_id`: string | null

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /company/tasks/{task_id}/transitions` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `TaskResponse`
- AND тело MUST содержать поля `product_id`, `title`, `id`, `status`, `created_at`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /company/tasks/{task_id}/transitions`
- THEN система MUST вернуть `422`

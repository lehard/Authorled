# API `approvals` Specification

## Purpose
Запросы на подтверждение действий человеком (human approval).

Эндпоинты этого домена не реализованы в коде репозитория: их предоставляет runtime `agno.os.AgentOS` (agno 3.1.10), создаваемый в `app/main.py`. Требования ниже восстановлены по OpenAPI-схеме работающего инстанса (`GET /openapi.json`, заголовок «Agno AgentOS», версия API `1.0.0`).

Общее требование: если `authorization` включена (в `app/main.py` это `RUNTIME_ENV != "dev"`), каждый эндпоинт домена MUST требовать заголовок `Authorization: Bearer <JWT>` (схема безопасности `HTTPBearer` в OpenAPI), а запрос без валидного токена MUST завершаться статусом `401`. В режиме `RUNTIME_ENV=dev` (compose.yaml) `GET /info` возвращает `auth_mode: "none"` и эндпоинты доступны без токена.

## Requirements

### Requirement: GET /approvals — List Approvals
Система MUST предоставлять эндпоинт `GET /approvals` (operationId `list_approvals_approvals_get`, раздел OpenAPI «Approvals»).

Query-параметры: `status`, `source_type`, `approval_type`, `pause_type`, `agent_id`, `team_id`, `workflow_id`, `user_id`, `schedule_id`, `run_id`, `limit`, `page`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /approvals` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /approvals/count — Get Approval Count
Система MUST предоставлять эндпоинт `GET /approvals/count` (operationId `get_approval_count_approvals_count_get`, раздел OpenAPI «Approvals»).

Query-параметры: `user_id`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /approvals/count` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /approvals/{approval_id}/status — Get Approval Status
Система MUST предоставлять эндпоинт `GET /approvals/{approval_id}/status` (operationId `get_approval_status_approvals__approval_id__status_get`, раздел OpenAPI «Approvals»).

Path-параметры: `approval_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /approvals/{approval_id}/status` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: GET /approvals/{approval_id} — Get Approval
Система MUST предоставлять эндпоинт `GET /approvals/{approval_id}` (operationId `get_approval_approvals__approval_id__get`, раздел OpenAPI «Approvals»).

Path-параметры: `approval_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `GET /approvals/{approval_id}` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: DELETE /approvals/{approval_id} — Delete Approval
Система MUST предоставлять эндпоинт `DELETE /approvals/{approval_id}` (operationId `delete_approval_approvals__approval_id__delete`, раздел OpenAPI «Approvals»).

Path-параметры: `approval_id` — MUST быть заданы (обязательные).

#### Scenario: Успешный ответ 204
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `DELETE /approvals/{approval_id}` с корректными параметрами
- THEN система MUST вернуть статус `204` («Successful Response»)
- AND формат содержимого ответа: без тела

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

### Requirement: POST /approvals/{approval_id}/resolve — Resolve Approval
Система MUST предоставлять эндпоинт `POST /approvals/{approval_id}/resolve` (operationId `resolve_approval_approvals__approval_id__resolve_post`, раздел OpenAPI «Approvals»).

Path-параметры: `approval_id` — MUST быть заданы (обязательные).

Тело запроса: `application/json`, схема `ApprovalResolve`, обязательное. Поля: `status` (обязательное), `resolved_by`, `resolution_data`.

#### Scenario: Успешный ответ 200
- GIVEN платформа запущена, а запрос аутентифицирован (если авторизация включена)
- WHEN клиент вызывает `POST /approvals/{approval_id}/resolve` с корректными параметрами
- THEN система MUST вернуть статус `200` («Successful Response»)
- AND формат содержимого ответа: `application/json`

#### Scenario: Ответ 422
- GIVEN платформа запущена
- WHEN параметры или тело запроса не проходят валидацию
- THEN система MUST вернуть статус `422` («Validation Error»)

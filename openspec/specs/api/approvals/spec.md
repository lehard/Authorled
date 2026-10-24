# Approvals API Specification

## Purpose
Запросы подтверждения человеком (human-in-the-loop) для приостановленных ходов.

Домен содержит 6 операций HTTP (теги OpenAPI: Approvals). Все они предоставляются runtime Agno `AgentOS`; в коде репозитория маршрутов нет.

## Requirements

### Requirement: Модель Approval
Approval MUST содержать `id`, `run_id`, `session_id`, `status` и `source_type`. Разрешение (`ApprovalResolve`) MUST принимать обязательный `status` со значением строго `approved` или `rejected` (регулярное выражение `^(approved|rejected)$`, регистр важен) и MAY принимать `resolved_by` (до 255 символов) и `resolution_data`. Фильтр `GET /approvals?status=` допускает `pending`, `approved`, `rejected`, `expired`, `cancelled`; `expired` и `cancelled` в resolve недопустимы.

#### Scenario: Пустой список
- GIVEN приостановленных ходов нет
- WHEN клиент выполняет `GET /approvals`
- THEN система MUST вернуть `200` с пустым `data` и `meta` пагинации

### Requirement: GET /approvals
Система MUST возвращать операцию «List Approvals» по запросу `GET /approvals` (operationId `list_approvals_approvals_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `status` (query, string (pending | approved | rejected | expired | cancelled) | null, необязательный)
- `source_type` (query, string | null, необязательный)
- `approval_type` (query, string (required | audit) | null, необязательный)
- `pause_type` (query, string | null, необязательный)
- `agent_id` (query, string | null, необязательный)
- `team_id` (query, string | null, необязательный)
- `workflow_id` (query, string | null, необязательный)
- `user_id` (query, string | null, необязательный)
- `schedule_id` (query, string | null, необязательный)
- `run_id` (query, string | null, необязательный)
- `limit` (query, integer, необязательный)
- `page` (query, integer, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /approvals` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `PaginatedResponse_ApprovalResponse_`
- AND тело MUST содержать поля `data`, `meta`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /approvals`
- THEN система MUST вернуть `422`

### Requirement: GET /approvals/count
Система MUST возвращать операцию «Get Approval Count» по запросу `GET /approvals/count` (operationId `get_approval_count_approvals_count_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `user_id` (query, string | null, необязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /approvals/count` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ApprovalCountResponse`
- AND тело MUST содержать поля `count`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /approvals/count`
- THEN система MUST вернуть `422`

### Requirement: GET /approvals/{approval_id}/status
Система MUST возвращать операцию «Get Approval Status» по запросу `GET /approvals/{approval_id}/status` (operationId `get_approval_status_approvals__approval_id__status_get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `approval_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /approvals/{approval_id}/status` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ApprovalStatusResponse`
- AND тело MUST содержать поля `approval_id`, `status`, `run_id`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /approvals/{approval_id}/status`
- THEN система MUST вернуть `422`

### Requirement: GET /approvals/{approval_id}
Система MUST возвращать операцию «Get Approval» по запросу `GET /approvals/{approval_id}` (operationId `get_approval_approvals__approval_id__get`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `approval_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `GET /approvals/{approval_id}` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ApprovalResponse`
- AND тело MUST содержать поля `id`, `run_id`, `session_id`, `status`, `source_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `GET /approvals/{approval_id}`
- THEN система MUST вернуть `422`

### Requirement: DELETE /approvals/{approval_id}
Система MUST удалять операцию «Delete Approval» по запросу `DELETE /approvals/{approval_id}` (operationId `delete_approval_approvals__approval_id__delete`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `approval_id` (path, string, обязательный)

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `DELETE /approvals/{approval_id}` с корректными параметрами
- THEN система MUST вернуть `204`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `DELETE /approvals/{approval_id}`
- THEN система MUST вернуть `422`

### Requirement: POST /approvals/{approval_id}/resolve
Система MUST выполнять операцию «Resolve Approval» по запросу `POST /approvals/{approval_id}/resolve` (operationId `resolve_approval_approvals__approval_id__resolve_post`).
Маршрут MUST требовать аутентификацию `HTTPBearer` при включённой авторизации.

Параметры:
- `approval_id` (path, string, обязательный)

Тело запроса (`application/json`, схема `ApprovalResolve`):
- `status`: string (`approved` | `rejected`, pattern `^(approved|rejected)$`), обязательное
- `resolved_by`: string | null
- `resolution_data`: object | null

Источник: `agno/os/routers/approvals/schema.py:10-15`, `router.py:164-210` (live OpenAPI содержит `pattern`, хотя тип — свободная строка).

#### Scenario: Успешный запрос
- GIVEN платформа запущена, а клиент имеет доступ к маршруту
- WHEN клиент выполняет `POST /approvals/{approval_id}/resolve` с корректными параметрами
- THEN система MUST вернуть `200` с телом по схеме `ApprovalResponse`
- AND тело MUST содержать поля `id`, `run_id`, `session_id`, `status`, `source_type`

#### Scenario: Ответ 422
- GIVEN выполняется условие ошибки «Validation Error»
- WHEN клиент выполняет `POST /approvals/{approval_id}/resolve`
- THEN система MUST вернуть `422`

#### Scenario: Недопустимый status
- GIVEN Approval существует
- WHEN клиент передаёт `status` `expired`, `cancelled`, `pending`, `APPROVED`, `foo` или пустую строку
- THEN система MUST вернуть `422` `String should match pattern '^(approved|rejected)$'` (live)
- AND тело без `status` MUST вернуть `422` `Field required` (live)

#### Scenario: Разрешение pending Approval
- GIVEN Approval в статусе `pending`
- WHEN клиент передаёт `status` `approved` (или `rejected`)
- THEN система MUST вернуть `200` со статусом из запроса и заполненными `resolved_by`, `resolved_at` (live)

#### Scenario: Повторное разрешение
- GIVEN Approval уже в статусе `approved` или `rejected`
- WHEN клиент повторно выполняет `POST /approvals/{approval_id}/resolve` с любым `status`
- THEN система MUST вернуть `409` `Approval is already 'approved' and cannot be resolved` (live; `router.py:199-210`: условное обновление `expected_status="pending"`)

#### Scenario: Неизвестный Approval
- WHEN клиент передаёт допустимый `status` для несуществующего `approval_id`
- THEN система MUST вернуть `404` `Approval not found` (live)

#### Scenario: Изоляция пользователей
- GIVEN включена `user_isolation`, а вызывающий — не администратор
- WHEN клиент выполняет resolve
- THEN система MUST вернуть `404` `Approval not found` (source: `router.py:172-173`; live не проверялось, в проверке авторизация выключена)

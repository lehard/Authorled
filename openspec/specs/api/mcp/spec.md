# MCP API Specification

## Purpose
MCP-endpoint `/mcp` (streamable HTTP) для подключения AI-приложений к AgentOS. Настраивается в `app/interfaces.py`; не входит в OpenAPI.

## Requirements

### Requirement: Набор инструментов
Система MUST публиковать MCP-сервер с инструментами по умолчанию (`MCPConfig(default_tools=True)`) и инструментом `agno`, созданным `manager.as_tool(name="agno", title="Agno")`. `tools/list` MUST возвращать 9 инструментов:

| Инструмент | Обязательные параметры | Прочие параметры |
| --- | --- | --- |
| `agno` | `message` | `user_id`, `session_id` |
| `get_agentos_config` | — | — |
| `run_agent` | `agent_id`, `message` | `user_id`, `session_id` |
| `run_team` | `team_id`, `message` | `user_id`, `session_id` |
| `run_workflow` | `workflow_id`, `message` | `user_id`, `session_id` |
| `continue_run` | `run_id`, `session_id` | `agent_id`, `team_id`, `workflow_id`, `requirements`, `user_id` |
| `cancel_run` | `run_id` | `session_id`, `agent_id`, `team_id`, `workflow_id` |
| `get_sessions` | — | `session_type`, `component_id`, `user_id`, `session_name`, `db_id`, `limit`, `page`, `sort_by`, `sort_order` |
| `get_session_runs` | `session_id` | `run_id`, `session_type`, `user_id`, `db_id` |

#### Scenario: Проверка без вызова модели
- GIVEN платформа запущена
- WHEN выполняется `./scripts/mcp_check.sh`
- THEN скрипт MUST выполнить handshake, получить все страницы `tools/list` и MUST сообщить `9 tools; required tools available`

#### Scenario: Нет обязательного инструмента
- GIVEN в `tools/list` отсутствует хотя бы один из 9 инструментов
- WHEN выполняется `./scripts/mcp_check.sh`
- THEN скрипт MUST завершиться кодом `1` с сообщением `missing required tools: ...`

### Requirement: Инструмент agno
Инструмент `agno` MUST передавать `message` команде OS Manager и MUST возвращать `session_id` для продолжения диалога.

#### Scenario: Вызов с промптом
- GIVEN платформа запущена и ключ модели задан
- WHEN выполняется `./scripts/mcp_check.sh --prompt "..."`
- THEN скрипт MUST вызвать `agno` с `{"message": prompt}` и вывести текст ответа
- AND при `is_error` скрипт MUST завершиться кодом `1`

### Requirement: Доступ к /mcp
Авторизация включена при любом `RUNTIME_ENV`, включая `dev`, поэтому запрос к `/mcp` без токена MUST отклоняться кодом `401`. Для `./scripts/mcp_check.sh` токен Authentik MUST передаваться в `MCP_CHECK_TOKEN`.

#### Scenario: prd без токена
- GIVEN `RUNTIME_ENV=prd` и задан `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /mcp` без токена
- THEN система MUST вернуть `401`

#### Scenario: dev без токена
- GIVEN `RUNTIME_ENV=dev` и задан `JWT_JWKS_FILE`
- WHEN клиент выполняет `GET /mcp` без токена
- THEN система MUST вернуть `401`

#### Scenario: Проверка MCP с токеном
- GIVEN платформа запущена и `MCP_CHECK_TOKEN` содержит действительный токен Authentik
- WHEN выполняется `./scripts/mcp_check.sh`
- THEN скрипт MUST выполнить handshake и получить `tools/list`

### Requirement: MCP OAuth
Если задан `MCP_CONNECT_SECRET`, система MUST включать `AgentOSBuiltinAuth(url=AGENTOS_URL, secret=...)`, превращая `/mcp` в собственный сервер авторизации OAuth 2.1; иначе MCP OAuth MUST быть выключен.

#### Scenario: Без секрета
- GIVEN `MCP_CONNECT_SECRET` не задан
- WHEN клиент выполняет `GET /info`
- THEN `mcp.oauth` MUST быть `null`

### Requirement: Порядок подключения
`attach_interfaces` MUST завершаться `RuntimeError("OS Manager must be configured before attaching interfaces.")`, если у `AgentOS` нет менеджера.

#### Scenario: Нет OS Manager
- GIVEN `agent_os.manager` равен `None`
- WHEN вызывается `attach_interfaces(agent_os)`
- THEN функция MUST завершиться `RuntimeError`

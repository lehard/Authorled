# API `mcp` Specification

## Purpose
MCP-endpoint AgentOS (`mcp=True` в `app/main.py`, путь `/mcp`). Конфигурация задаётся в `app/interfaces.py`: встроенные инструменты AgentOS плюс инструмент `agno`, проксирующий OS Manager. Протокол и транспорт реализует библиотека Agno; в OpenAPI эти маршруты не отражены (`GET /info` → `mcp: {enabled: true, path: "/mcp", oauth: null, tool_run_endpoint: true}`).

## Requirements

### Requirement: Включение MCP
Система MUST публиковать MCP-сервер по пути `/mcp`, а `GET /info` MUST сообщать `mcp.enabled: true` и `mcp.path: "/mcp"`.

#### Scenario: Обращение к корню MCP
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /mcp` без MCP-заголовков
- THEN система MUST ответить редиректом `302` на `/mcp/server-card` (наблюдаемое поведение)

#### Scenario: Некорректный MCP-запрос
- GIVEN платформа запущена
- WHEN клиент отправляет `POST /mcp/` JSON-RPC запрос `tools/list` без инициализации MCP-сессии
- THEN система MUST отклонить запрос статусом `400` (наблюдаемое поведение)

### Requirement: Инструмент `agno`
`attach_interfaces()` MUST регистрировать в `MCPConfig` инструмент с `name="agno"`, `title="Agno"` и описанием «Talk to OS Manager of this AgentOS. Pass session_id back to continue the conversation.», созданный через `manager.as_tool(...)`, а также MUST включить встроенные инструменты (`default_tools=True`).

#### Scenario: Продолжение диалога
- GIVEN MCP-клиент уже вызвал инструмент `agno` и получил `session_id`
- WHEN клиент вызывает `agno` повторно с тем же `session_id`
- THEN OS Manager MUST продолжить тот же диалог

#### Scenario: Менеджер не настроен
- GIVEN `agent_os.manager is None`
- WHEN вызывается `attach_interfaces(agent_os)`
- THEN система MUST выбросить `RuntimeError("OS Manager must be configured before attaching interfaces.")`

### Requirement: OAuth для MCP
Если задана переменная `MCP_CONNECT_SECRET`, `mcp_auth()` MUST вернуть `AgentOSBuiltinAuth(url=AGENTOS_URL, secret=MCP_CONNECT_SECRET)`, и `/mcp` MUST работать как собственный OAuth 2.1 authorization server. Если переменная пуста или не задана, `mcp_auth()` MUST вернуть `None` (OAuth отключён, `mcp.oauth: null`).

#### Scenario: Секрет не задан
- GIVEN `MCP_CONNECT_SECRET` отсутствует
- WHEN клиент вызывает `GET /info`
- THEN `mcp.oauth` MUST быть `null`

#### Scenario: Подключение чат-приложения
- GIVEN `MCP_CONNECT_SECRET` задан, `AGENTOS_URL` — публичный HTTPS-адрес
- WHEN claude.ai или ChatGPT (web) подключается к `/mcp`
- THEN система MUST запросить секрет на странице согласия (по описанию в `example.env`)

### Requirement: Проверка MCP-подключения
Репозиторий MUST содержать скрипт `scripts/mcp_check.sh` для проверки MCP-подключения, и он SHOULD использоваться для проверки доступности MCP; при запуске с `MCP_CHECK_HOST=1` он проверяет API, работающее на хосте.

#### Scenario: Локальная проверка
- GIVEN API запущено на хосте
- WHEN выполняется `MCP_CHECK_HOST=1 ./scripts/mcp_check.sh`
- THEN скрипт SHOULD сообщить о состоянии MCP-подключения (детали поведения скрипта не проверялись — см. `openspec/TODO.md`)

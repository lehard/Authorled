# Integrations Specification

## Purpose
Внешние сервисы, с которыми взаимодействует платформа (по коду `app/`, `agents/`, `db/`, `example.env`): LLM-провайдеры, Slack, Parallel, GitHub, Docker/AWS sandbox, внешний AgentOS UI.

## Requirements

### Requirement: Anthropic (Claude)
Система MUST использовать Anthropic API для `default_model()`, `manager_model()` и модели агента `company-manager-internal` через `agno.models.anthropic.Claude`; для `claude-engineer` — через `claude-agent-sdk`. Аутентификация MUST выполняться через `ANTHROPIC_API_KEY`; `claude-engineer` MAY использовать `CLAUDE_CODE_OAUTH_TOKEN`.

#### Scenario: Ключ задан
- GIVEN `ANTHROPIC_API_KEY` задан в `.env`
- WHEN OS Manager получает запрос
- THEN вызов модели `claude-opus-5-5` MUST выполняться в Anthropic API

### Requirement: OpenAI
Система MUST использовать `OPENAI_API_KEY` для эмбеддингов `text-embedding-3-small` базы знаний и для агента `codex-engineer` (`gpt-6.1-sol`).

#### Scenario: Поиск по знаниям
- GIVEN в базе знаний есть контент и задан `OPENAI_API_KEY`
- WHEN клиент вызывает `POST /knowledge/search`
- THEN система MUST получить эмбеддинг запроса у OpenAI и выполнить гибридный поиск в pgvector

### Requirement: Slack
Если заданы оба параметра `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`, `attach_interfaces()` MUST добавить в `agent_os.interfaces` интерфейс `Slack(team=manager, token, signing_secret, streaming=True, resolve_user_identity=True, loading_text="Pulling the thread...")`. Если задан только один из параметров или ни одного, Slack MUST NOT подключаться, и ошибка MUST NOT выбрасываться.

#### Scenario: Slack подключён
- GIVEN заданы оба параметра
- WHEN приложение стартует
- THEN в `GET /config` раздел `interfaces` MUST содержать Slack

#### Scenario: Задан только токен
- GIVEN задан `SLACK_BOT_TOKEN`, но нет `SLACK_SIGNING_SECRET`
- WHEN приложение стартует
- THEN интерфейс Slack MUST NOT быть подключён

### Requirement: Parallel (веб-поиск)
Система MUST выполнять веб-поиск через Parallel: SDK (`ParallelTools`) при заданном `PARALLEL_API_KEY`, иначе через `https://search.parallel.ai/mcp` по `streamable-http` с таймаутом 30 секунд.

#### Scenario: Недоступность MCP Parallel
- GIVEN `PARALLEL_API_KEY` не задан и сервис Parallel недоступен
- WHEN агент вызывает веб-инструмент
- THEN инструмент MUST вернуть ошибку вызова (поведение `MCPTools`)

### Requirement: GitHub и git-источники
CompanyOS MUST использовать источники Product `this-agentos`: `https://github.com/agno-agi/agno/releases` (`website`) и локальный git-репозиторий проекта (`git`). Sandbox MAY клонировать `REPOSITORY` (по умолчанию `None`).

#### Scenario: Репозиторий sandbox не задан
- GIVEN `REPOSITORY is None`
- WHEN формируется список источников
- THEN в нём MUST быть ровно два источника

### Requirement: Docker и AWS AgentCore sandbox
Docker sandbox MAY запускаться из образа `agno-sandbox:local` (target `sandbox` в `Dockerfile`); AgentCore sandbox MAY использоваться с `runtime_arn` и постоянным томом `/data`. По умолчанию `sandbox_provider()` MUST возвращать `None`.

#### Scenario: Поведение по умолчанию
- GIVEN конфигурация не изменялась
- WHEN запускаются агенты-инженеры
- THEN они MUST работать в каталоге проекта без sandbox

### Requirement: Внешний AgentOS UI
Система MUST предоставлять REST API для управляющего UI `os.agno.com` и SHOULD проверять JWT для авторизации (ключ `JWT_VERIFICATION_KEY` генерируется на `os.agno.com`, см. `example.env`).

#### Scenario: Подключение локального инстанса
- GIVEN платформа запущена на `http://localhost:8000`
- WHEN пользователь добавляет инстанс в AgentOS UI
- THEN UI MUST обращаться к `GET /config`, `GET /agents`, `GET /teams` и другим эндпоинтам, описанным в `openspec/specs/api/` (точный набор запросов UI не проверялся)

### Requirement: Документация Agno для coding-агентов
Файл `.mcp.json` MUST регистрировать HTTP MCP-сервер `agno-docs` по адресу `https://docs.agno.com/mcp` для coding-агентов.

#### Scenario: Открытие проекта в Claude Code
- GIVEN проект открыт в Claude Code
- WHEN читается `.mcp.json`
- THEN доступен MCP-сервер `agno-docs`

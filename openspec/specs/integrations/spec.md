# Integrations Specification

## Purpose
Внешние сервисы, с которыми работает текущий код. Ключи передаются через переменные окружения (`example.env`); значения MUST NOT храниться в коде.

## Requirements

### Requirement: Anthropic
Система MUST обращаться к Anthropic API за моделями `claude-sonnet-5-5` и `claude-opus-5-5` (`agno.models.anthropic.Claude`) и через `claude-agent-sdk` для `claude-engineer`. Аутентификация MUST идти через `ANTHROPIC_API_KEY` или `CLAUDE_CODE_OAUTH_TOKEN` (для Claude Code).

#### Scenario: Модели в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать модели `claude-opus-5-5` и `claude-sonnet-5-5`

### Requirement: OpenAI
Система MUST использовать OpenAI для эмбеддингов `text-embedding-3-small` (`OpenAIEmbedder`) и для `codex-engineer` (`gpt-6.1-sol`). Аутентификация MUST идти через `OPENAI_API_KEY`.

#### Scenario: Эмбеддинг знаний
- GIVEN в `shared-knowledge` загружается контент
- WHEN строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у OpenAI моделью `text-embedding-3-small`

### Requirement: Parallel
Веб-инструмент MUST быть `ParallelTools()` при заданном `PARALLEL_API_KEY`; иначе MUST использоваться бесключевой MCP-сервер `https://search.parallel.ai/mcp`.

#### Scenario: Без ключа
- GIVEN `PARALLEL_API_KEY` не задан
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать инструмент `parallel_tools`

### Requirement: Slack
При заданных `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET` система MUST подключать `Slack(team=manager, streaming=True, resolve_user_identity=True, loading_text="Pulling the thread...")`. Если задана только одна переменная, Slack MUST NOT подключаться.

#### Scenario: Одна переменная Slack
- GIVEN задан только `SLACK_BOT_TOKEN`
- WHEN вызывается `attach_interfaces`
- THEN `agent_os.interfaces` MUST остаться без Slack

### Requirement: GitHub releases Agno
Product `this-agentos` MUST содержать Source `website` `https://github.com/agno-agi/agno/releases`, который читает Routine `agentos-maintenance`.

#### Scenario: Source в списке
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /company/sources`
- THEN ответ MUST содержать этот Source

### Requirement: AgentOS UI и JWT
При включённой авторизации система MUST проверять JWT ключом из `JWT_VERIFICATION_KEY` (PEM) или `JWT_JWKS_FILE`. Ключ для AgentOS UI генерируется на `os.agno.com`.

#### Scenario: Токен не подписан ключом
- GIVEN `RUNTIME_ENV=prd` с заданным ключом
- WHEN клиент передаёт токен, подписанный другим ключом
- THEN система MUST вернуть `401`

### Requirement: AWS AgentCore
`agentcore_sandbox` MUST использовать `AgentCoreSandbox(runtime_arn=...)` с регионом из ARN и checkpoints в `/data/checkpoints`. Учётные данные AWS хоста MUST NOT передаваться в sandbox.

#### Scenario: Выбор провайдера
- GIVEN `sandbox_provider()` возвращает `None`
- WHEN платформа стартует
- THEN AgentCore MUST NOT использоваться

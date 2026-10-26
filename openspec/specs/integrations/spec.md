# Integrations Specification

## Purpose
Внешние сервисы, с которыми работает текущий код. Ключи передаются через переменные окружения (`example.env`); значения MUST NOT храниться в коде.

## Requirements

### Requirement: Parallel
Веб-инструмент MUST быть `ParallelTools()` при заданном `PARALLEL_API_KEY`; иначе MUST использоваться бесключевой MCP-сервер `https://search.parallel.ai/mcp`.

#### Scenario: Без ключа
- GIVEN `PARALLEL_API_KEY` не задан
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать инструмент `parallel_tools`

### Requirement: GitHub releases Agno
Product `this-agentos` MUST содержать Source `website` `https://github.com/agno-agi/agno/releases`, который читает Routine `agentos-maintenance`.

#### Scenario: Source в списке
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /company/sources`
- THEN ответ MUST содержать этот Source

### Requirement: AgentOS UI и JWT
При включённой авторизации система MUST проверять JWT ключами из файла `JWT_JWKS_FILE` (открытые ключи подписи Authentik, выгружаемые модулем `auth`); других источников ключей система MUST NOT принимать. Токены, принимаемые системой, MUST выпускаться Authentik (`openspec/specs/auth/spec.md`).

#### Scenario: Токен не подписан ключом
- GIVEN `RUNTIME_ENV=prd` с заданным ключом
- WHEN клиент передаёт токен, подписанный другим ключом
- THEN система MUST вернуть `401`

#### Scenario: Токен Authentik
- GIVEN ключи Authentik выгружены в `JWT_JWKS_FILE`
- WHEN клиент передаёт действительный Access Token Authentik
- THEN система MUST принять запрос и использовать `sub` токена как `user_id`

### Requirement: AWS AgentCore
`agentcore_sandbox` MUST использовать `AgentCoreSandbox(runtime_arn=...)` с регионом из ARN и checkpoints в `/data/checkpoints`. Учётные данные AWS хоста MUST NOT передаваться в sandbox.

#### Scenario: Выбор провайдера
- GIVEN `sandbox_provider()` возвращает `None`
- WHEN платформа стартует
- THEN AgentCore MUST NOT использоваться

### Requirement: DeepSeek
Система MUST использовать DeepSeek для всех чат-моделей через LiteLLM-прокси: псевдоним `deepseek-fast` для агентов по умолчанию и судьи evals, `deepseek-thinking` для OS Manager, Company Manager и `claude-engineer`. Ключ `DEEPSEEK_API_KEY` MUST задаваться только прокси.

#### Scenario: Модели в реестре
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /registry`
- THEN ответ MUST содержать модели `deepseek-fast` и `deepseek-thinking`

### Requirement: GigaChat
Система MUST получать эмбеддинги знаний у GigaChat `Embeddings-2` (1024 измерения) через псевдоним прокси `gigachat-embeddings`. Учётные данные `GIGACHAT_CREDENTIALS` и `GIGACHAT_SCOPE` MUST задаваться только прокси.

#### Scenario: Эмбеддинг знаний
- GIVEN в `shared-knowledge` загружается контент
- WHEN строится векторный индекс
- THEN эмбеддинги MUST запрашиваться у прокси псевдонимом `gigachat-embeddings` и иметь 1024 измерения

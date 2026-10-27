# Architecture Specification

## Purpose
Слои и связи текущего кода. Целевая архитектура Authorled (три сервиса, ядро, свои маршруты `/api/v1/`, Redis, LiteLLM) описана в `openspec/context/03-architecture.md` и ADR-001/002 и в коде не реализована.

```mermaid
graph LR
    UI["AgentOS UI os.agno.com"] -->|REST + SSE, JWT| API
    AIApps["AI-приложения (Claude, ChatGPT)"] -->|MCP /mcp| API
    subgraph API["agentos-api: AgentOS (app.main:app)"]
        OSM["OS Manager os-manager-internal"]
        CM["Company Manager"]
        ENG["claude-engineer (Claude Code)"]
        SCH["Scheduler"]
        Q["Durable queue"]
        REG["Registry"]
    end
    OSM --> CM
    SCH -->|POST /agents/company-manager-internal/runs| CM
    API --> DB[("agentos-db: PostgreSQL 18 + pgvector")]
    ENG -.->|при sandbox| SBX["Docker / AgentCore sandbox"]
    API -->|псевдонимы моделей| LLM["litellm: LiteLLM-прокси"]
    LLM --> DeepSeek["DeepSeek API"]
    LLM -->|TLS: Russian Trusted CA| GigaChat["GigaChat API (эмбеддинги)"]
    REG --> Parallel["Parallel web"]
```

## Requirements

### Requirement: Слои приложения
Код MUST разделяться так:
- `app/main.py` — сборка `AgentOS`;
- `app/interfaces.py` — MCP OAuth, MCP-инструменты;
- `app/auth/` — кодовая часть модуля `auth`: проверка JWT Authentik, сопоставление групп и scopes, `Principal`, доступ к проекту;
- `modules/auth/` — деплой-часть модуля `auth`: сервисы и blueprints Authentik, оформление, инициализация БД, выгрузка ключей;
- `app/company.py` — Products, Sources, Routines;
- `app/config.yaml` — манифест компонентов;
- `app/registry.py` — реестр Studio, shared knowledge/learning/notes;
- `app/settings.py` — фабрики моделей;
- `app/sandbox.py` — провайдеры sandbox и `REPOSITORY`;
- `agents/engineers.py` — инженеры;
- `db/` — подключение к PostgreSQL и знания;
- `evals/` — кейсы и CLI;
- `web/` — фронтенд (тонкий клиент без своей БД, ADR-001); `web/src/design-system/` — токены, темы, шрифты и базовые компоненты дизайн-системы.

#### Scenario: Порядок сборки
- GIVEN импортируется `app.main`
- WHEN создаётся `AgentOS`
- THEN `attach_interfaces(agent_os)` MUST вызываться после создания и до `agent_os.get_app()`

#### Scenario: Авторизация подключается модулем
- GIVEN импортируется `app.main`
- WHEN создаётся `AgentOS`
- THEN настройка авторизации и изоляции MUST браться из `app/auth/`, а `app/main.py` MUST NOT содержать разбора токенов и claims

#### Scenario: Фронтенд отделён от бэкенда
- GIVEN в репозитории есть `web/`
- WHEN собирается образ бэкенда по `Dockerfile`
- THEN образ MUST NOT зависеть от содержимого `web/`, а код `web/` MUST NOT импортировать модули бэкенда

### Requirement: Единая БД
OS, Company, queue, learning, notes, реестр и инженеры MUST использовать один `PostgresDb` с ID `agentos-db`, возвращаемый кэшированной `get_postgres_db()`. Content-адаптер знаний MUST иметь собственный ID `agentos-db-<table>_contents`.

#### Scenario: Одна БД в конфигурации
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /config`
- THEN `databases` MUST быть `["agentos-db"]`

### Requirement: Модели
`default_model()` MUST возвращать при каждом вызове новый экземпляр модели DeepSeek с псевдонимом прокси `deepseek-fast` без режима размышлений; `manager_model()` MUST возвращать модель с псевдонимом `deepseek-thinking` в режиме размышлений и MUST использоваться OS Manager и CompanyOS. Обе модели MUST обращаться к LiteLLM-прокси по `LITELLM_URL` с ключом `LITELLM_API_KEY`. Псевдонимы MUST объявляться только в `app/settings.py`; инженеры MUST брать их оттуда и MUST NOT задавать имена моделей сами.

#### Scenario: Модель менеджера
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /teams`
- THEN `os-manager-internal` MUST иметь модель `deepseek-thinking`

### Requirement: Sandbox
`sandbox_provider()` MUST возвращать `None`; тогда инженеры MUST исполняться на сервере AgentOS в корне репозитория. `docker_sandbox()` MUST создавать `DockerSandbox` (образ `agno-sandbox:local`, сеть `isolated`, `workspace_mb=2048`, checkpoints в `<root>/tmp/checkpoints`). `agentcore_sandbox(runtime_arn)` MUST требовать смонтированный том `/data`, иначе MUST завершаться `ValueError`.

#### Scenario: AgentCore без тома
- GIVEN `/data` не является точкой монтирования
- WHEN вызывается `agentcore_sandbox("arn")`
- THEN функция MUST завершиться `ValueError("Mount a persistent volume at /data before enabling AgentCore")`

### Requirement: Подключение к БД
URL БД MUST собираться из `DB_DRIVER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_DATABASE` (`db/url.py`). При отсутствии переменных код подставляет значения разработки (`postgresql+psycopg`, `ai`/`ai`, `localhost:5432`, `ai`).

#### Scenario: Compose
- GIVEN контейнер `agentos-api` запущен через `compose.yaml`
- WHEN строится URL
- THEN `DB_HOST` MUST быть `agentos-db`, `DB_PORT` `5432`

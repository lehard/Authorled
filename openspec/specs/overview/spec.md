# Overview Specification

## Purpose
Репозиторий `authorled` — бэкенд продукта Authorled (веб-сервис, который проводит писателя или сценариста через методологию из 22 документов; см. `openspec/context/01-product-context.md`). На текущий момент код репозитория — шаблон AgentOS (`agno-agi/agentos-docker`) на фреймворке Agno `3.1.10` с моделями по умолчанию, переключёнными на Claude. Продуктовое ядро Authorled (документы Д1–Д22, чек-листы, граф связей, утверждения, свои маршруты `/api/v1/`) в коде отсутствует.

Спецификация описывает поведение текущего кода. Целевая архитектура — в `openspec/context/03-architecture.md` и ADR; расхождения перечислены в `openspec/TODO.md`.

Стек (по `pyproject.toml`, `Dockerfile`, `compose.yaml`):
- Backend: Python `>=3.14,<4`; ASGI-приложение `app.main:app` из `AgentOS.get_app()` (FastAPI), сервер uvicorn.
- Хранилище: PostgreSQL 18 с pgvector (`agnohq/pgvector:18`), SQLAlchemy/psycopg.
- Модели: Anthropic Claude `claude-sonnet-5-5` и `claude-opus-5-5`; OpenAI `gpt-6.1-sol` (Codex Engineer) и `text-embedding-3-small` (эмбеддинги).
- Развёртывание: Docker Compose (`compose.yaml` — разработка, `compose.prod.yaml` — production-override).
- Frontend в репозитории отсутствует; каталог `ui/` не создаётся. Интерфейс управления — внешний AgentOS UI (`os.agno.com`).

## Requirements

### Requirement: Единая точка входа
Система MUST создавать один экземпляр `AgentOS` в `app/main.py` и экспортировать `app = agent_os.get_app()`. Контейнер MUST запускать `uvicorn app.main:app --host 0.0.0.0 --port 8000`; прямой запуск `python -m app.main` MUST слушать `127.0.0.1:8000` без reload.

#### Scenario: Запуск через Docker Compose
- GIVEN Docker запущен, а `.env` существует
- WHEN выполняется `docker compose up -d --build`
- THEN система MUST поднять контейнеры `agentos-db` и `agentos-api`
- AND `GET http://127.0.0.1:8000/health` MUST вернуть `200` с `status: "ok"` и `instantiated_at`

### Requirement: Возможности AgentOS
Система MUST включать в `AgentOS`: MCP (`mcp=True`), трассировку (`tracing=True`), планировщик (`scheduler=True`, `scheduler_base_url=AGENTOS_URL`), изоляцию пользователей (`user_isolation=True`), каталог пользователей (`user_directory=True`), долговечную очередь (`QueueConfig(durable=True, db=db)`), OS Manager, CompanyOS, знание `shared-knowledge`, реестр и манифест `app/config.yaml`. Авторизация MUST быть включена при любом `RUNTIME_ENV`, кроме `dev`; по умолчанию `RUNTIME_ENV` равен `prd`.

#### Scenario: Значения по умолчанию окружения
- GIVEN `RUNTIME_ENV` и `AGENTOS_URL` не заданы
- WHEN импортируется `app.main`
- THEN `runtime_env` MUST быть `prd`, а `agentos_url` MUST быть `http://127.0.0.1:8000`

### Requirement: Состав компонентов
Система MUST регистрировать агентов `claude-engineer`, `codex-engineer` (из `agents/engineers.py`) и встроенного `company-manager-internal`, а также встроенную команду `os-manager-internal`. Система MUST NOT регистрировать workflows.

#### Scenario: Счётчики инстанса
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /info`
- THEN ответ MUST содержать `agent_count: 3`, `team_count: 1`, `workflow_count: 0`

### Requirement: Каналы доступа
Система MUST предоставлять REST API (`openspec/specs/api/*`) и MCP-endpoint `/mcp` (`openspec/specs/api/mcp/spec.md`). Интерфейс Slack MUST подключаться только при заданных `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET` (`openspec/specs/integrations/spec.md`).

#### Scenario: Без Slack
- GIVEN переменные Slack не заданы
- WHEN клиент выполняет `GET /config`
- THEN `interfaces` MUST быть пустым списком

### Requirement: Отсутствие маршрутов в коде репозитория
Весь HTTP API MUST предоставляться runtime `AgentOS`: код репозитория MUST NOT объявлять маршруты FastAPI. Это состояние текущего кода, не запрет: продуктовые маршруты без LLM допускаются через `base_app` (ADR-002) и отложены до появления ядра продукта; очереди, lifecycle и конечные автоматы Company приложение по-прежнему не создаёт. OpenAPI MUST содержать 131 путь и 182 операции.

#### Scenario: Количество операций
- GIVEN платформа запущена
- WHEN клиент читает `GET /openapi.json`
- THEN схема MUST содержать 131 путь и 182 операции, сгруппированные по доменам `openspec/specs/api/`

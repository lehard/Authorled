# Overview Specification

## Purpose
Репозиторий `authorled` — бэкенд продукта Authorled (веб-сервис, который проводит писателя или сценариста через методологию из 22 документов; см. `openspec/context/01-product-context.md`). На текущий момент код репозитория — шаблон AgentOS (`agno-agi/agentos-docker`) на фреймворке Agno `3.1.10` с моделями по умолчанию, переключёнными на Claude. Продуктовое ядро Authorled (документы Д1–Д22, чек-листы, граф связей, утверждения, свои маршруты `/api/v1/`) в коде отсутствует.

Спецификация описывает поведение текущего кода. Целевая архитектура — в `openspec/context/03-architecture.md` и ADR; расхождения перечислены в `openspec/TODO.md`.

Стек (по `agno/pyproject.toml`, `agno/Dockerfile`, `compose.yaml` и фрагментам `agno/compose.yaml`, `auth/compose.yaml`; код бэкенда — в `agno/`):
- Backend: Python `>=3.14,<4`; ASGI-приложение `app.main:app` из `AgentOS.get_app()` (FastAPI), сервер uvicorn.
- Хранилище: PostgreSQL 18 с pgvector (`agnohq/pgvector:18`), SQLAlchemy/psycopg.
- Модели: DeepSeek через LiteLLM-прокси (`agno/litellm/config.yaml`) по псевдонимам `deepseek-fast` (агенты по умолчанию) и `deepseek-thinking` (OS Manager, Company Manager, Claude Engineer); эмбеддинги (1024 измерения) — один из псевдонимов `gigachat-embeddings`, `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`, выбранный переменной `EMBEDDINGS_MODEL` (ADR-003).
- Шлюз моделей: LiteLLM-прокси `ghcr.io/berriai/litellm:v1.104.2` (сервис `litellm` в compose).
- Развёртывание: Docker Compose (`compose.yaml` — разработка, `compose.prod.yaml` — production-override).
- Frontend: каталог `web/` (монорепозиторий, ADR-001): React + TypeScript на Vite, shadcn/ui на Tailwind CSS; пока содержит дизайн-систему и её витрину, продуктовых экранов нет (`openspec/specs/web/*`). Интерфейс управления платформой — внешний AgentOS UI (`os.agno.com`).

## Requirements

### Requirement: Единая точка входа
Система MUST создавать один экземпляр `AgentOS` в `app/main.py` и экспортировать `app = agent_os.get_app()`. Контейнер MUST запускать `uvicorn app.main:app --host 0.0.0.0 --port 8000`; прямой запуск `python -m app.main` MUST слушать `127.0.0.1:8000` без reload.

#### Scenario: Запуск через Docker Compose
- GIVEN Docker запущен, а `.env` существует
- WHEN выполняется `docker compose up -d --build`
- THEN система MUST поднять контейнеры `agentos-db` и `agentos-api`
- AND `GET http://127.0.0.1:8000/health` MUST вернуть `200` с `status: "ok"` и `instantiated_at`

### Requirement: Возможности AgentOS
Система MUST включать в `AgentOS`: MCP (`mcp=True`), трассировку (`tracing=True`), планировщик (`scheduler=True`, `scheduler_base_url=AGENTOS_URL`), изоляцию пользователей (`user_isolation=True`), каталог пользователей (`user_directory=True`), долговечную очередь (`QueueConfig(durable=True, db=db)`), OS Manager, CompanyOS, знание `shared-knowledge`, реестр и манифест `app/config.yaml`. Авторизация MUST быть включена при любом `RUNTIME_ENV`, включая `dev`; без ключа проверки JWT система MUST NOT запускаться. По умолчанию `RUNTIME_ENV` равен `prd`.

#### Scenario: Значения по умолчанию окружения
- GIVEN `RUNTIME_ENV` и `AGENTOS_URL` не заданы
- WHEN импортируется `app.main`
- THEN `runtime_env` MUST быть `prd`, а `agentos_url` MUST быть `http://127.0.0.1:8000`

#### Scenario: Авторизация в dev
- GIVEN `RUNTIME_ENV=dev` и ключ проверки JWT задан
- WHEN клиент вызывает защищённый маршрут без токена
- THEN система MUST вернуть `401`

#### Scenario: dev без ключа
- GIVEN `RUNTIME_ENV=dev` и `JWT_JWKS_FILE` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой

### Requirement: Состав компонентов
Система MUST регистрировать агента `claude-engineer` (из `agents/engineers.py`) и встроенного `company-manager-internal`, а также встроенную команду `os-manager-internal`. Система MUST NOT регистрировать `codex-engineer` и workflows.

#### Scenario: Счётчики инстанса
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /info`
- THEN ответ MUST содержать `agent_count: 2`, `team_count: 1`, `workflow_count: 0`

### Requirement: Каналы доступа
Система MUST предоставлять REST API (`openspec/specs/api/*`) и MCP-endpoint `/mcp` (`openspec/specs/api/mcp/spec.md`). Чат-интерфейсы сторонних мессенджеров (в том числе Slack) система MUST NOT подключать, даже если в окружении заданы переменные `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`.

#### Scenario: Без Slack
- GIVEN переменные Slack не заданы
- WHEN клиент выполняет `GET /config`
- THEN `interfaces` MUST быть пустым списком

#### Scenario: Переменные Slack в окружении
- GIVEN в окружении заданы `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`
- WHEN платформа запущена и клиент выполняет `GET /config`
- THEN `interfaces` MUST быть пустым списком

### Requirement: Отсутствие маршрутов в коде репозитория
Весь HTTP API MUST предоставляться runtime `AgentOS`: код репозитория MUST NOT объявлять маршруты FastAPI. Это состояние текущего кода, не запрет: продуктовые маршруты без LLM допускаются через `base_app` (ADR-002) и отложены до появления ядра продукта; очереди, lifecycle и конечные автоматы Company приложение по-прежнему не создаёт. OpenAPI MUST содержать 131 путь и 182 операции.

#### Scenario: Количество операций
- GIVEN платформа запущена
- WHEN клиент читает `GET /openapi.json`
- THEN схема MUST содержать 131 путь и 182 операции, сгруппированные по доменам `openspec/specs/api/`

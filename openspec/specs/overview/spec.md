# Overview Specification

## Purpose
Репозиторий `authorled` — монорепозиторий продукта «Соавтор», редактора сценариев с ИИ-соавтором (см. `openspec/context/01-product-context.md`). Бэкенд в `agno/` — приложение на фреймворке Agno `3.1.10`, выросшее из шаблона AgentOS (`agno-agi/agentos-docker`), с моделями DeepSeek через LiteLLM-прокси. Продуктовое ядро — `agno/core/` в схеме `authorled` (спеки `core/*`): пользователи и их настройки, истории, драфты, документы, тексты, заметки, снимки, рецензирование, файлы, импорт рукописей, подписки и журнал расхода соавтора; его свои маршруты — под `/api/v1/` (спеки `api/*`). Методологии из 22 документов (этапы Д1–Д22, чек-листы, граф связей, утверждения) в коде нет.

Спецификация описывает поведение текущего кода. Целевая архитектура — в `openspec/context/03-architecture.md` и ADR; расхождения перечислены в `openspec/TODO.md`.

Стек (по `agno/pyproject.toml`, `agno/Dockerfile`, `compose.yaml` и фрагментам `agno/compose.yaml`, `auth/compose.yaml`; код бэкенда — в `agno/`):
- Backend: Python `>=3.14,<4`; ASGI-приложение `app.main:app` из `AgentOS.get_app()` (FastAPI), сервер uvicorn.
- Хранилище: PostgreSQL 18 с pgvector (`agnohq/pgvector:18`), SQLAlchemy/psycopg.
- Модели: DeepSeek через LiteLLM-прокси (`agno/litellm/config.yaml`) по псевдонимам `deepseek-fast` (агенты по умолчанию) и `deepseek-thinking` (OS Manager, Company Manager, Claude Engineer); эмбеддинги (1024 измерения) — один из псевдонимов `gigachat-embeddings`, `giga-embeddings`, `bge-m3-embeddings`, `qwen3-embeddings`, выбранный переменной `EMBEDDINGS_MODEL` (ADR-003).
- Шлюз моделей: LiteLLM-прокси `ghcr.io/berriai/litellm:v1.104.2` (сервис `litellm` в compose).
- Развёртывание: Docker Compose (`compose.yaml` — разработка, `compose.prod.yaml` — production-override).
- Frontend: каталог `web/` (монорепозиторий, ADR-001): React + TypeScript на Vite, shadcn/ui на Tailwind CSS; дизайн-система, экраны входа, полки, окна истории с редактором сценария и чатом соавтора, личного кабинета (`openspec/specs/web/*`). Интерфейс управления платформой — внешний AgentOS UI (`os.agno.com`).

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
Система MUST регистрировать агентов `claude-engineer` (из `agents/engineers.py`) и `coauthor` (из `agents/coauthor.py`, спека `api/agents`) и встроенного `company-manager-internal`, а также встроенную команду `os-manager-internal`. Система MUST NOT регистрировать `codex-engineer` и workflows.

#### Scenario: Счётчики инстанса
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /info`
- THEN ответ MUST содержать `agent_count: 3`, `team_count: 1`, `workflow_count: 0`

### Requirement: Каналы доступа
Система MUST предоставлять REST API (`openspec/specs/api/*`) и MCP-endpoint `/mcp` (`openspec/specs/api/mcp/spec.md`). Единственный интерфейс MUST быть AG-UI соавтора с маршрутом `/agents/coauthor` (чат фронтенда, спека `api/agents`, «AG-UI соавтора»). Чат-интерфейсы сторонних мессенджеров (в том числе Slack) система MUST NOT подключать, даже если в окружении заданы переменные `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`.

#### Scenario: Без Slack
- GIVEN переменные Slack не заданы
- WHEN клиент выполняет `GET /config`
- THEN `interfaces` MUST содержать только `{type: "agui", route: "/agents/coauthor"}`

#### Scenario: Переменные Slack в окружении
- GIVEN в окружении заданы `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`
- WHEN платформа запущена и клиент выполняет `GET /config`
- THEN `interfaces` MUST содержать только `{type: "agui", route: "/agents/coauthor"}`

### Requirement: Свои маршруты в коде репозитория
HTTP API MUST предоставляться runtime `AgentOS`. Код репозитория MAY объявлять свои маршруты FastAPI только для продуктовых действий без LLM: роутером в приложении, которое возвращает AgentOS (ADR-002), под префиксом `/api/v1/`, не пересекаясь с маршрутами Agno. Параметр `base_app` MUST NOT использоваться: с ним Agno 3.1.10 не ставит свои обработчики ошибок на свои маршруты. Сейчас свои маршруты — `GET` и `PATCH /api/v1/me` (спека `api/me`) и маршруты историй, рецензирования, файлов и импорта (спеки `api/stories`, `api/review`, `api/files`, `api/story-import`): 22 пути и 32 операции. Очереди, lifecycle и конечные автоматы Company приложение по-прежнему не создаёт. OpenAPI MUST содержать 163 пути и 229 операций.

#### Scenario: Количество операций
- GIVEN платформа запущена
- WHEN клиент читает `GET /openapi.json`
- THEN схема MUST содержать 163 пути и 229 операций, сгруппированные по доменам `openspec/specs/api/`

#### Scenario: Маршруты Agno не перекрыты
- GIVEN платформа запущена со своими маршрутами
- WHEN клиент читает `GET /openapi.json`
- THEN все свои пути MUST начинаться с `/api/v1/`
- AND каждый путь Agno MUST обслуживаться Agno

# Overview Specification

## Purpose
Репозиторий `Authorled` — самостоятельный экземпляр платформы агентов **AgentOS** на базе фреймворка **Agno** (`agno==3.1.10`). Каркас получен из шаблона `agno-agi/agentos-docker` и затем изменён: модели по умолчанию переключены на Claude (`app/settings.py`), добавлен пакет `anthropic` (`pyproject.toml`, `requirements.txt`).

Назначение системы (по коду `app/main.py`): запускать AgentOS как HTTP-сервис (FastAPI/uvicorn), который предоставляет REST API управления агентами, MCP-endpoint, планировщик, долговечную очередь задач, трассировку, базу знаний и модуль CompanyOS; все данные хранятся в PostgreSQL.

Технологический стек (определён по `pyproject.toml`, `Dockerfile`, `compose.yaml`):
- Backend: Python `>=3.14,<4`, FastAPI-приложение `app.main:app`, создаваемое `AgentOS.get_app()`, сервер uvicorn.
- Хранилище: PostgreSQL 18 с pgvector (образ `agnohq/pgvector:18`), доступ через SQLAlchemy/psycopg.
- Модели: Anthropic Claude (`claude-sonnet-5-5`, `claude-opus-5-5`), OpenAI (`gpt-6.1-sol` для Codex Engineer, `text-embedding-3-small` для эмбеддингов).
- Развёртывание: Docker Compose (`compose.yaml` для разработки, `compose.prod.yaml` как production-override).

Собственного frontend в репозитории нет. Управление платформой выполняется во внешнем AgentOS UI (`os.agno.com`) через REST API, поэтому каталог `openspec/specs/ui/` не создаётся.

## Requirements

### Requirement: Единая точка входа приложения
Система MUST создавать один экземпляр `AgentOS` в модуле `app/main.py` и экспортировать ASGI-приложение как `app = agent_os.get_app()`. Процесс MUST запускаться командой `uvicorn app.main:app` (так определено в `Dockerfile` и `compose.yaml`).

#### Scenario: Запуск через Docker Compose
- GIVEN в `.env` заданы ключи моделей, а Docker запущен
- WHEN выполняется `docker compose up -d --build`
- THEN система MUST поднять контейнеры `agentos-db` и `agentos-api`
- AND `agentos-api` MUST быть доступен на `127.0.0.1:8000`

#### Scenario: Проверка работоспособности
- GIVEN контейнеры запущены и приложение завершило старт
- WHEN клиент вызывает `GET /health`
- THEN система MUST вернуть статус `200` и тело со `status: "ok"`

### Requirement: Состав зарегистрированных компонентов
Система MUST регистрировать в AgentOS следующие компоненты (наблюдается по `GET /agents`, `GET /teams`, `GET /config` работающего инстанса):
- агент `claude-engineer` (Claude Engineer, SDK `claude-agent-sdk`);
- агент `codex-engineer` (Codex Engineer, SDK `codex`);
- агент `company-manager-internal` (Company Manager, модель `claude-opus-5-5`);
- команду `os-manager-internal` (OS Manager, режим `coordinate`, модель `claude-opus-5-5`) с участниками `platform-builder-internal`, `platform-manager-internal`, `company-manager-internal`.

Система MUST NOT регистрировать workflows: `GET /workflows` MUST возвращать пустой список.

#### Scenario: Список агентов
- GIVEN платформа запущена с конфигурацией из репозитория
- WHEN клиент вызывает `GET /agents`
- THEN ответ MUST содержать агентов `claude-engineer`, `codex-engineer` и `company-manager-internal`

#### Scenario: Список команд
- GIVEN платформа запущена
- WHEN клиент вызывает `GET /teams`
- THEN ответ MUST содержать команду `os-manager-internal`

### Requirement: Способы использования платформы
Система MUST предоставлять три канала доступа к OS Manager и агентам: REST API (см. `openspec/specs/api/*`), MCP-endpoint `/mcp` (см. `openspec/specs/api/mcp/spec.md`) и, при заданных `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`, интерфейс Slack (см. `openspec/specs/integrations/spec.md`).

#### Scenario: Только REST и MCP
- GIVEN переменные Slack не заданы
- WHEN приложение стартует
- THEN `agent_os.interfaces` MUST остаться без Slack-интерфейса
- AND MCP-endpoint MUST быть включён (`GET /info` → `mcp.enabled: true`)

### Requirement: Отсутствие пользовательских REST-эндпоинтов в репозитории
Весь REST API MUST предоставляться runtime `agno.os.AgentOS`, а репозиторий SHOULD NOT определять собственные маршруты FastAPI. Новые возможности SHOULD добавляться как агенты, команды, инструменты, знания или конфигурация AgentOS.

#### Scenario: Количество операций API
- GIVEN платформа запущена
- WHEN читается `GET /openapi.json`
- THEN схема MUST содержать 131 путь и 182 операции, все описаны в `openspec/specs/api/`

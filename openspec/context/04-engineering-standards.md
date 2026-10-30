---
owner: lehard
updated: 2026-10-30
---
# Engineering Standards
Стек: Python `>=3.14`, Agno `3.1.10` (FastAPI/uvicorn), PostgreSQL 18 + pgvector, Alembic, pytest, Docker Compose. Линт/типы: ruff (line-length 120, E,F,I,UP), mypy + pydantic plugin.

## Общее
- Зависимости — в `agno/pyproject.toml`; `agno/requirements.txt` генерировать `./agno/scripts/generate_requirements.sh`; `uv.lock` не добавлять. После смены зависимостей пересобрать обе цели `agno/Dockerfile`. Окружение — `agno/.venv` (`./agno/scripts/venv_setup.sh`).
- Агент: стабильный ID, явные instructions/tools, `default_model()`, общая БД, history и datetime (скилл `create-agent`). Регистрация — `agno/app/main.py`, описания/промпты — `agno/app/config.yaml`.
- Минимум абстракций и инфраструктуры — только под конкретную потребность. Перед правкой — читать исходник и `git status`, держаться scope.
- Без fallback: отсутствующий/невалидный ввод, конфиг или env — явная ошибка с понятным сообщением.

## Миграции
- Схема ядра — Alembic. Только вперёд; применённые миграции не редактируются.
- В проде миграции — отдельный шаг перед деплоем, не при старте сервиса.
- Таблицы Agno мигрирует Agno, отдельной задачей при обновлении пина. Схемы ядра и Agno не смешивать.

## Стиль API (свои маршруты)
- Префикс `/api/v1/` — не пересекаться с маршрутами Agno.
- Запросы и ответы — модели Pydantic. OpenAPI — контракт для фронтенда, TS-клиент генерируется из него.
- Ошибки — `application/problem+json` (RFC 9457).
- Время — UTC, ISO 8601. Идентификаторы — UUID.
- `Idempotency-Key` обязателен для утверждения и загрузки файлов.
- Каждый маршрут проверяет доступ к проекту; маршрут без проверки не проходит ревью.

## Методология
- SKILL.md и JSON-схемы шаблонов проверяются в CI: схемы валидны, ссылки между документами существуют.
- Изменения методологии ревьюит методист, не только разработчик.

## Запуск проверок
- формат/линт/типы: `./scripts/validate.sh` (тот же гейт в CI), автоформат `./scripts/format.sh`; `git diff --check`
- тесты: `pytest` (на реальном PostgreSQL в контейнере)
- MCP без модели: `./scripts/mcp_check.sh`; поведение агента — `python -m evals`
- сборка: `docker compose up -d --build`; sandbox: `docker build --target sandbox --load -t agno-sandbox:local -f agno/Dockerfile .`
> TODO: точные команды pytest/Alembic и CI-проверки методологии появятся с кодом ядра.

## Готово, когда
`./scripts/validate.sh`, `git diff --check` и `pytest` проходят; миграции применяются на чистой базе; изменения OpenAPI отражены в контракте для фронтенда; проверки и их ограничения записаны в `tmp/VERIFY.md` (static, deterministic, model, container, hosted — раздельно).

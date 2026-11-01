# Proposal

## Why

У продукта пока нет своих таблиц: в общей базе `ai` есть только схема `ai` (Agno) и схема `authentik`. Истории, драфты, комментарии, роли в проекте и личный кабинет будут ссылаться на пользователя, поэтому первым нужен способ хранить данные продукта и сама запись пользователя. Миграций в проекте нет, хотя стандарт (`04-engineering-standards.md`, «Миграции») требует Alembic для схемы ядра. Основание — бизнес-интент `business-intents/core-users-table.md` (решения владельца 2026-11-01).

## What Changes

- **Схема `authorled`** в общей базе `ai` для данных продукта. Владелец — роль `agentos`; схему создаёт идемпотентный шаг инициализации `agno/db/init.sql`. Таблицы ядра не смешиваются с таблицами Agno и Authentik.
- **Миграции Alembic** для схемы `authorled`: только вперёд, одна голова, журнал версий внутри `authorled`, другие схемы не трогаются.
- **Шаг миграций** — одноразовый контейнер `agentos-migrate` под ролью `agentos` между `agentos-db-init` и `agentos-api`, в разработке и в production одинаково. API миграции не запускает и не стартует, если они упали.
- **Таблица `authorled.users`** только с основными полями: `id`, `auth_subject`, `email`, `display_name`, `created_at`, `updated_at`, `last_seen_at`, `deleted_at` (мягкое удаление).
- **Тесты ядра на pytest** с настоящим PostgreSQL: чистая база `ai_test`, миграции, ограничения таблицы, совпадение описания таблиц в коде со схемой в базе.
- **Команды** `./scripts/dev.sh migrate` и `./scripts/dev.sh test`; `./scripts/dev.sh api` применяет миграции до запуска API на хосте; `./scripts/validate.sh` проверяет, что у миграций одна голова.
- **`agno/db/init.sql`** перестаёт зависеть от имени базы `ai`: права выдаются на текущую базу подключения, чтобы тот же шаг готовил тестовую базу.

## Scope

- `agno/db/init.sql`: схема `authorled`, права на текущую базу вместо зашитого `ai`.
- `agno/db/url.py` → `agno/core/connection.py`: сборка URL переезжает в модуль без зависимостей от Agno и LiteLLM, `db/url.py` берёт её оттуда.
- `agno/core/`: описание таблиц ядра (одна таблица `users`).
- `agno/migrations/`, `agno/alembic.ini`: окружение Alembic и первая миграция.
- `agno/compose.yaml`, `compose.prod.yaml`: сервис `agentos-migrate`; `agentos-api` ждёт его успешного завершения.
- `scripts/dev.sh`, `scripts/validate.sh`.
- `agno/tests/`: pytest.
- `agno/pyproject.toml`, `agno/requirements.txt`: `alembic` (рантайм), `pytest` (dev).
- Спеки: новая `core/database`; дельты `architecture` и `runtime`.
- Документация: `AGENTS.md` («Where changes belong», «Verification»), README, `.agents/skills/deploy-platform/SKILL.md` (шаг миграций), `openspec/context/03-architecture.md` (схема `authorled` рядом с `ai` и `authentik`).

## Non-goals

- Создание и обновление записи пользователя и `GET /me` — следующий интент; там же расширение контракта токена claims `email` и `name` и первый свой маршрут через `base_app`.
- Таблица профиля и настройки пользователя (тема, чат, агент) — интент личного кабинета.
- Группы, роли и права в схеме `authorled`; роли в проекте и `can_access_project`.
- Поведение удаления аккаунта (есть только поле `deleted_at`).
- Свои маршруты API и изменения фронтенда; обновление пина Agno.
- Запуск pytest в CI: CI пока без PostgreSQL; добавляется отдельным решением.

## Capabilities

### New Capabilities
- `core/database`: хранение данных продукта: схема `authorled`, миграции как отдельный шаг, таблица пользователей.

### Modified Capabilities
- `architecture`: «Подключение к БД» — роль `agentos` владеет и схемой `authorled`; шаг инициализации готовит обе схемы для любой базы; путь поиска схем не используется для таблиц ядра.
- `runtime`: «Контейнеры разработки» — сервис `agentos-migrate` и порядок запуска; «Скрипт локальной разработки» — команды `migrate`, `test` и миграции в `api`; «Проверки кода» — одна голова миграций.

## Impact

- База: новая схема `authorled` с таблицами `users` и `alembic_version`; схемы `ai`, `authentik`, `public` не меняются. Существующие локальные базы получают схему при следующем `docker compose up`.
- Запуск: новый одноразовый контейнер перед API; при упавшей миграции API не стартует.
- Зависимости: `alembic`, `pytest`; пересборка обоих таргетов `agno/Dockerfile`.
- ПДн: email и имя — в пределах, разрешённых `05-security-and-compliance.md`; таблица пока пустая.

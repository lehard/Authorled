# Tasks

## 1. Зависимости и пакет ядра

- [x] 1.1 Добавить `alembic` в зависимости и `pytest` в `dev` в `agno/pyproject.toml`, пакет `core*` в `packages.find`; перегенерировать `agno/requirements.txt` через `./agno/scripts/generate_requirements.sh`, обновить `agno/.venv`
- [x] 1.2 Создать `agno/core/connection.py` с `build_db_url()` из `agno/db/url.py` без изменения поведения; `agno/db/url.py` берёт функцию оттуда и по-прежнему экспортирует `db_url`
- [x] 1.3 Создать `agno/core/tables.py`: `MetaData(schema="authorled")` с `naming_convention` и таблица `users` (поля, `CHECK` на непустые строки, `UNIQUE (auth_subject)`, значения по умолчанию)

## 2. База и миграции

- [x] 2.1 `agno/db/init.sql`: право `CREATE` на `current_database()` вместо зашитого `ai`; схема `authorled` с владельцем `agentos` (идемпотентно)
- [x] 2.2 Окружение Alembic: `agno/alembic.ini` (`script_location = migrations`, без URL), `agno/migrations/env.py` (URL из `core.connection`, `target_metadata`, `version_table_schema="authorled"`, `include_schemas` и фильтр только `authorled`), `script.py.mako`
- [x] 2.3 Миграция `agno/migrations/versions/0001_create_users.py` (ревизия `0001_create_users`), совпадающая с `core/tables.py`

## 3. Запуск

- [x] 3.1 Сервис `agentos-migrate` в `agno/compose.yaml` (та же сборка, что у `agentos-api`, `alembic upgrade head`, `WAIT_FOR_DB`, `DB_*` роли `agentos`, bind-mount в разработке, `depends_on` `agentos-db-init`); `agentos-api` ждёт успешного завершения `agentos-migrate`
- [x] 3.2 `compose.prod.yaml`: `agentos-migrate` без bind-mount, пароль из `.env`, тот же порядок
- [x] 3.3 `scripts/dev.sh`: команды `migrate` и `test` (пересоздание `ai_test` под загрузочным пользователем, `agentos-db-init` с `PGDATABASE=ai_test`, `alembic upgrade head` и `pytest tests` на хосте под `agentos`); `api` запускает `agentos-migrate` до API; справка и `usage`
- [x] 3.4 `scripts/validate.sh`: проверка одной головы миграций (`alembic heads`), ошибка с перечнем голов

## 4. Тесты

- [x] 4.1 `agno/tests/conftest.py`: подключение к `ai_test` через `core.connection`, откат транзакции после каждого теста
- [x] 4.2 `agno/tests/test_migrations.py`: повторный `upgrade head` без изменений, одна голова, `compare_metadata` пуст, таблиц продукта нет в `ai` и `public`, схема `authorled` принадлежит `agentos`
- [x] 4.3 `agno/tests/test_users.py`: уникальный `auth_subject`, отказ на `NULL` и пустые строки, значения по умолчанию, точный состав колонок

## 5. Документация

- [x] 5.1 `AGENTS.md`: где лежат `agno/core/`, `agno/migrations/`, `agno/tests/`; команды `dev.sh migrate` и `dev.sh test` в «Local development» и «Verification»
- [x] 5.2 README: шаг миграций и команды; `.agents/skills/deploy-platform/SKILL.md`: миграции на деплое и бэкап перед первым деплоем
- [x] 5.3 `openspec/context/03-architecture.md`: схема `authorled` рядом с `ai` и `authentik` в модуле `auth` и инварианте 4

## 6. Проверка

- [x] 6.1 `./scripts/format.sh`, `./scripts/validate.sh` (с активным `agno/.venv`), `git diff --check`
- [x] 6.2 `./scripts/dev.sh test` проходит; основная база `ai` не изменилась
- [x] 6.3 `docker compose up -d --build` на существующей базе: схема `authorled` и `users` появились, вход и список историй работают, данные Agno и Authentik на месте
- [x] 6.4 Миграция с ошибкой (временная правка вне коммита): `agentos-migrate` завершается ненулевым кодом, `agentos-api` не стартует; правку убрать
- [x] 6.5 Две головы (временная ревизия вне коммита): `./scripts/validate.sh` падает и называет головы; ревизию убрать
- [x] 6.6 Сборка `docker compose -f compose.yaml -f compose.prod.yaml config` без ошибок; итоги и ограничения в `tmp/VERIFY.md`

## Workflow follow-up

- Обновить статус в `business-intents/core-users-table.md` и строку в `openspec/TODO.md` после архивации.

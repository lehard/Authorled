# Design

## Context

См. proposal.md — Why. Что есть сейчас:

- Одна база `ai` в контейнере `agentos-db`. Схема `ai` принадлежит роли `agentos` (Agno), схема `authentik` — роли Authentik; `public` держит расширение `vector`.
- `agno/db/init.sql` выполняется сервисом `agentos-db-init` под загрузочным пользователем `ai` на каждом `up`. В нём зашито `GRANT CREATE ON DATABASE ai TO agentos`; роль `agentos` создаётся с `NOCREATEDB` и `search_path = ai, public`.
- `agno/db/url.py` собирает URL из `DB_*`, но импорт `db.url` сначала выполняет `agno/db/__init__.py`, а тот тянет Agno knowledge и `app.settings` (обязательные `LITELLM_URL`, `LITELLM_API_KEY`, `EMBEDDINGS_MODEL`).
- Alembic, pytest и папки тестов в коде нет. `sqlalchemy` 2.1 и `psycopg` 3 уже стоят как зависимости Agno.
- `agentos-api` собирается из `agno/Dockerfile` (цель `agentos`), в разработке монтирует корень репозитория в `/app`; entrypoint ждёт базу при `WAIT_FOR_DB`.

## Goals / Non-Goals

**Goals:**
- Раскладка, по которой будут добавляться все следующие таблицы ядра: где описание таблиц, где миграции, как их проверять.
- Миграции зависят только от переменных `DB_*`, а не от настроек моделей и Agno.
- Тесты хранения не трогают рабочую базу разработки.

**Non-Goals:**
- Слой доступа к данным (репозитории, сессии ORM) — появится с первым кодом, который читает и пишет `users`.
- Триггеры базы (например, для `updated_at`): время обновляет код ядра, когда он появится.
- pytest в CI.

## Decisions

1. **Раскладка.** `agno/core/` — пакет ядра без зависимостей от Agno: `connection.py` (URL базы), `tables.py` (`MetaData(schema="authorled")` и `Table("users", …)`). `agno/migrations/` — окружение Alembic (`env.py`, `script.py.mako`, `versions/`), `agno/alembic.ini` указывает `script_location = migrations`. Пакет `core*` добавляется в `[tool.setuptools.packages.find]`.
   - Альтернатива: миграции внутри `agno/db/`. Отклонена: `db/` — адаптеры Agno, а схемы ядра и Agno не смешиваются.

2. **Сборка URL переезжает в `core/connection.py`.** Функция `build_db_url()` переносится без изменений поведения; `db/url.py` импортирует её и по-прежнему экспортирует `db_url`. Так `migrations/env.py` и тесты получают URL, не импортируя пакет `db` и не требуя переменных LiteLLM.
   - Альтернатива: читать `DB_*` заново в `env.py`. Отклонена: две копии правил подключения разъедутся.
   - Альтернатива: импорт `db/url.py` по пути файла. Отклонена как обход структуры пакетов.

3. **SQLAlchemy Core, а не ORM.** Таблица описывается `Table` в общем `MetaData` схемы `authorled`. Этого хватает для миграций и сравнения со схемой; ORM-классы можно добавить поверх того же `MetaData`, когда появится код доступа к данным.

4. **Первая миграция пишется вручную**, автогенерация используется только для проверки. Ревизии получают читаемые id (`0001_create_users`), файл `versions/0001_create_users.py`. Миграция создаёт `authorled.users`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (встроена в PostgreSQL 13+, расширение не нужно);
   - `auth_subject`, `email`, `display_name` — `text NOT NULL` с `CHECK (<поле> <> '')` и именованными ограничениями;
   - `UNIQUE (auth_subject)`;
   - `created_at`, `updated_at`, `last_seen_at` — `timestamptz NOT NULL DEFAULT now()`; `deleted_at timestamptz` без значения по умолчанию.
   Имена ограничений задаются `naming_convention` в `MetaData`, чтобы описание в коде и база совпадали при сравнении.

5. **Alembic ограничен схемой `authorled`.** В `env.py`: `version_table_schema="authorled"`, `include_schemas=True` и `include_name`, пропускающий только схему `authorled`. URL — `core.connection.build_db_url()`, без значения в `alembic.ini`. Ошибка подключения или миграции не перехватывается: Alembic завершается ненулевым кодом и называет ревизию.

6. **`init.sql` без зашитого имени базы.** `GRANT CREATE ON DATABASE ai` заменяется блоком, который выдаёт право на `current_database()` через `format('%I', …)`. Добавляется `CREATE SCHEMA IF NOT EXISTS authorled AUTHORIZATION agentos` и `ALTER SCHEMA authorled OWNER TO agentos`. `search_path` роли не меняется (`ai, public`): код ядра всегда пишет схему явно, через `MetaData(schema=…)`.
   - Альтернатива: параметр `-v db_name=…`. Отклонена: лишний аргумент у каждого вызова, тогда как подключение и так задаёт базу.

7. **Сервис `agentos-migrate`** в `agno/compose.yaml`: та же `build` (контекст `..`, `agno/Dockerfile`, цель `agentos`), что у `agentos-api`, без `image:` (кэш сборки общий; переменная `IMAGE_NAME` с подстановкой по умолчанию не расширяется на новый сервис). `restart: "no"`, `working_dir` `/app/agno`, команда `alembic upgrade head`, `WAIT_FOR_DB=True`, `DB_*` как у API (`DB_USER=agentos`, `DB_PASS=${AGENTOS_DB_PASSWORD:?…}`), без `env_file`: шагу не нужны ключи моделей. В разработке монтирует корень репозитория, как API, поэтому новая миграция применяется без пересборки. `depends_on`: `agentos-db-init` (успешное завершение); у `agentos-api` добавляется `agentos-migrate` (успешное завершение). `compose.prod.yaml` убирает bind-mount и сохраняет порядок.
   - Альтернатива: `alembic upgrade` в entrypoint API. Отклонена стандартом (миграции не при старте сервиса).

8. **`./scripts/dev.sh migrate`** — `docker compose up -d --wait agentos-db`, `docker compose run --rm agentos-db-init`, `docker compose run --rm agentos-migrate`. **`./scripts/dev.sh api`** вызывает `agentos-migrate` после `agentos-db-init` и до запуска API на хосте.

9. **`./scripts/dev.sh test`.** Под загрузочным пользователем через `docker compose exec agentos-db psql`: `DROP DATABASE IF EXISTS ai_test WITH (FORCE)` и `CREATE DATABASE ai_test`; затем `docker compose run --rm -e PGDATABASE=ai_test agentos-db-init`. Миграции и тесты — на хосте из `agno/` в окружении `agno/.venv` (`uv run --no-project`, как `api`), с `DB_HOST=127.0.0.1`, `DB_DATABASE=ai_test`, `DB_USER=agentos`: `alembic upgrade head`, затем `pytest tests`. Тестовая база остаётся после прогона для разбора; следующий прогон пересоздаёт её.
   - Альтернатива: отдельный контейнер PostgreSQL для тестов. Отклонена: лишняя инфраструктура, а версия и расширения должны совпадать с `agentos-db`.

10. **Тесты** (`agno/tests/`), все на `ai_test`:
    - `test_migrations.py`: повторный `upgrade head` ничего не меняет; голова ровно одна; `compare_metadata` между `core.tables.metadata` и базой пуст; в схемах `ai` и `public` нет таблиц продукта;
    - `test_users.py`: уникальность `auth_subject`, отказ на `NULL` и пустые строки, значения по умолчанию, точный состав колонок.
    Каждый тест вставляет данные в транзакции и откатывает её, чтобы тесты не зависели друг от друга.

11. **Проверка голов в `validate.sh`**: `(cd agno && alembic heads)` без подключения к базе; больше одной строки — ошибка с выводом голов. `alembic` ставится из `agno/requirements.txt`, поэтому проверка работает и в CI.

## Risks / Trade-offs

- [Импорт `db.url` меняет место определения функции] → поведение и сообщения об ошибках не меняются; `mypy` и запуск API подтверждают, что `db_url` по-прежнему строится при импорте.
- [Две сборки одного образа в compose] → общий кэш слоёв; при расхождении зависимостей оба сервиса пересобираются одной командой `up --build`.
- [Долгая миграция задерживает старт API на деплое] → для MVP приемлемо; большие миграции данных — отдельным решением.
- [Тесты зависят от запущенного `agentos-db`] → `dev.sh test` сам поднимает базу и падает с понятной ошибкой, если Docker недоступен.
- [`DROP DATABASE … WITH (FORCE)` в скрипте разработки] → имя `ai_test` зашито в скрипте; команда никогда не трогает базу `ai`.
- [Копии email и имени отстают от Authentik] → заполнение и обновление — следующий интент; источник правды остаётся Authentik.

## Migration Plan

1. Существующая база разработки: `docker compose up -d --build` — `agentos-db-init` создаёт схему `authorled`, `agentos-migrate` применяет `0001_create_users`, API стартует как раньше.
2. Production: тот же `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`; бэкап базы перед первым деплоем с миграциями.
3. Откат: миграции только вперёд. Откатить код можно прежней версией образа; схема `authorled` и таблица `users` старому коду не мешают, так как он их не читает.

# Design

## Context

Мотивация — в `proposal.md`, требования — в `specs/`. Опора: ADR-001 (модульный монолит, модуль `auth` — `modules/auth/` + `app/auth/`, связь только через OIDC/JWT) и инварианты `03-architecture.md` (одна БД через `get_postgres_db()`, одна инстанция API, без fallback).

Состояние на 2026-10-28:
- Четыре сервиса модуля объявлены в корневом `compose.yaml`; их файлы (`blueprints/`, `db/init.sql`, `jwks/`) уже лежат в `modules/auth/`. Решение D1 архивного change `auth-module` отказалось от отдельного compose-файла, ADR-001 и `03-architecture.md` при этом описывают «compose-фрагмент».
- `agentos-db` создаёт суперпользователя `ai` (`POSTGRES_USER`); API (`compose.yaml`, `scripts/dev.sh api`) подключается им же. В prod его пароль — `DB_PASS` из `.env`, он же `POSTGRES_PASSWORD` и `PGPASSWORD` у `authentik-db-init`.
- Agno сам выполняет `CREATE SCHEMA` для `ai` и `CREATE EXTENSION IF NOT EXISTS vector` (`agno/vectordb/pgvector/pgvector.py`). У суперпользователя `ai` `search_path` = `"$user", public`, поэтому на существующей базе расширение `vector` могло встать в схему `ai`. Docker при подготовке change не был запущен, фактическое размещение не проверено (задача 3.1).
- Agno 3.1.10 `Authorization` берёт ключи только из `jwks_file` или `verification_keys`; загрузки JWKS по URL нет.
- Перечень групп продублирован: `modules/auth/blueprints/10-groups.yaml` и `GROUP_SCOPES` в `app/auth/authorization.py`.

## Goals / Non-Goals

**Goals:**
- После change вынос Authentik сводится к переносу каталога `modules/auth/` (с фрагментом compose) и дампа схемы `authentik`; бэкенду остаются `app/auth/`, контракт токена и файл ключей.
- Поведение API, проверки токенов и Authentik не меняется.

**Non-Goals:**
- Prod-переопределения Authentik (`authentik-db-init` пароль, порты `authentik-server`) остаются в корневом `compose.prod.yaml`: их перенос потребовал бы второго `include` в override-файле без выгоды до самого выноса.
- `scripts/auth_check.sh` остаётся в `scripts/`: он проверяет API-сторону (потребителя токенов) и после выноса останется в бэкенде.

## Decisions

**D1. Фрагмент `modules/auth/compose.yaml` и `include` без `project_directory`.** Корневой `compose.yaml` получает `include: [modules/auth/compose.yaml]`. Пути томов во фрагменте записываются относительно `modules/auth/` (`./blueprints`, `./db/init.sql`, `./jwks`), как будут выглядеть в отдельном репозитории. Проверено на Docker Compose v2.39.4 (черновые файлы в scratchpad): относительные пути включаемого файла разрешаются от его каталога; переменные интерполируются из корневого `.env` и без явного `env_file`; `depends_on` включаемого сервиса на сервис корня (`agentos-db`) и обратная зависимость (`agentos-api` → `authentik-jwks-export`) работают; override через `-f compose.prod.yaml` перекрывает поля включённых сервисов. Сеть `agentos` объявлена в корне; фрагмент ссылается на неё. Якорь `&authentik-env` переезжает во фрагмент вместе с обоими потребителями. *Альтернативы:* `project_directory: .` — пути остались бы от корня и сломались бы при переносе; `-f modules/auth/compose.yaml` в каждой команде — меняет все команды и документацию, легко забыть.

**D2. Контракт токена — требование спеки `auth` плюс проверка групп в `check_auth_boundary.sh`.** Отдельный файл контракта (JSON/YAML) не вводится: потребитель один, источник истины — спека. Проверка групп: имена из `identifiers.name` записей `authentik_core.group` в `modules/auth/blueprints/*.yaml` (извлекаются `grep`/`sed`, потому что blueprints используют теги `!Env`/`!Find`, которые не читает `yaml.safe_load`) сравниваются с ключами `GROUP_SCOPES`, полученными `python -c "from app.auth.authorization import GROUP_SCOPES"` в активном окружении. Если импорт не удался, проверка падает с сообщением, а не пропускается. *Альтернатива:* общий модуль констант, который читают blueprints и Python, — blueprints не умеют импортировать Python, получился бы генератор файлов.

**D3. Роль `agentos` и сервис `agentos-db-init` в корневом compose.** Роль Agno — не часть модуля `auth`, поэтому SQL лежит в `db/init.sql` (каталог `db/` уже отвечает за подключение к БД), сервис `agentos-db-init` — в корневом `compose.yaml`, по образцу `authentik-db-init` (образ `agnohq/pgvector:18`, `psql -v ON_ERROR_STOP=1`, загрузочный пользователь). Скрипт идемпотентен и выполняется на каждом `up`:
1. создаёт роль `agentos LOGIN` без `SUPERUSER`/`CREATEDB`/`CREATEROLE` или обновляет её пароль из `AGENTOS_DB_PASSWORD`, и выдаёт ей `CREATE` на базу `ai`: Agno выполняет `CREATE SCHEMA IF NOT EXISTS ai`, а PostgreSQL проверяет это право раньше, чем существование схемы (проверено: без права — `permission denied for database ai`);
2. `CREATE SCHEMA IF NOT EXISTS ai AUTHORIZATION agentos` и `ALTER SCHEMA ai OWNER TO agentos`;
3. `CREATE EXTENSION IF NOT EXISTS vector SCHEMA public` — на новой базе расширение ставится в `public`; на существующей остаётся там, где есть (`IF NOT EXISTS` не перемещает);
4. передаёт `agentos` владение всеми таблицами, последовательностями, представлениями и функциями схемы `ai`, владелец которых не `agentos` (блок `DO` по `pg_class`/`pg_proc`);
5. `ALTER ROLE agentos SET search_path = ai, public` — тип `vector` находится и в `ai`, и в `public`, где бы ни стояло расширение;
6. права на схему `authentik` роли не выдаются (у `PUBLIC` их нет: схема принадлежит `authentik`).

`agentos-db-init` ждёт `authentik-db-init`: оба скрипта выдают `CREATE` на базу, и на пустой базе параллельный запуск падает с `tuple concurrently updated` (найдено при проверке). Зависимость идёт от бэкенда к модулю `auth`, обратной нет; при выносе Authentik со своей базой она удаляется. `agentos-api` получает `DB_USER: agentos`, `DB_PASS: ${AGENTOS_DB_PASSWORD:?…}` и `depends_on: agentos-db-init: service_completed_successfully`. Строка `DB_PASS: ${DB_PASS:?…}` у `agentos-api` в `compose.prod.yaml` удаляется; `DB_PASS` в `.env` остаётся паролем загрузочного суперпользователя (prod) — ни существующий `.env`, ни том базы не нужно перенастраивать, кроме новой переменной. *Альтернативы:* переименовать `DB_PASS` в `.env` в `DB_BOOTSTRAP_PASSWORD` — ломает существующие prod `.env` без выгоды; `REASSIGN OWNED BY ai TO agentos` — затронул бы объекты всей базы, включая принадлежащие суперпользователю системные; оставить API суперпользователем и проверять «не обращается к `authentik`» только grep-ом — проверка кода не защищает от запросов, построенных моделью или инструментами.

**D4. `scripts/dev.sh api` на хосте.** Экспортирует `DB_USER=agentos`; `DB_PASS` берёт из `AGENTOS_DB_PASSWORD` в `.env` (читает файл и завершается ошибкой, если переменной нет), запускает `docker compose up --wait` для `agentos-db-init` вместе с базой. `dev.sh psql` остаётся под загрузочным пользователем: это инструмент администрирования.

**D5. Граница фрагмента проверяется скриптом.** `check_auth_boundary.sh` дополнительно ищет `goauthentik/server` в `compose*.yaml` вне `modules/auth/` и падает при находке.

## Risks / Trade-offs

- [На существующей базе в схеме `ai` есть объекты, которые нельзя передать (например, принадлежащие расширению)] → блок `DO` пропускает объекты, зависящие от расширения (`pg_depend.deptype = 'e'`), и передаёт остальные; задача 3.3 проверяет на копии рабочей базы, что API читает сохранённые сессии.
- [Agno на новой версии потребует прав, которых нет у несуперпользователя (новое расширение, `CREATE` на базу)] → API упадёт при старте с ошибкой прав; это явный отказ, а не тихая деградация. Права добавляются осознанно в `db/init.sql` отдельным change.
- [Роль `agentos` может создавать схемы в базе `ai` (право `CREATE` на базу)] → право нужно Agno; доступ к чужим схемам оно не даёт. Убрать его можно, только если Agno перестанет выполнять `CREATE SCHEMA` при старте.
- [Сервис инициализации на каждом `up` меняет пароль роли] → значение берётся из `.env`, как у `authentik-db-init`; смена пароля в `.env` вступает в силу на следующем `up`.
- [Загрузочный суперпользователь `ai` по-прежнему читает схему `authentik`] → принимается: он нужен для инициализации и администрирования, API им не пользуется. При выносе Authentik получит свою базу, и вопрос исчезнет.
- [`include` требует Docker Compose v2.20+] → `compose.prod.yaml` уже требует v2.24+ для `!reset`/`!override`; новых требований к версии нет.

## Migration Plan

1. Добавить `AGENTOS_DB_PASSWORD` в `.env` (локально и на prod-хосте).
2. `docker compose up -d --build` (prod: с `-f compose.prod.yaml`): `agentos-db-init` создаёт роль и передаёт владение, затем стартует API под `agentos`.
3. Проверить: `/config`, чтение сохранённых сессий, `./scripts/auth_check.sh`.

Откат: вернуть предыдущий коммит и перезапустить. API снова подключится суперпользователем, которому владение не нужно; роль `agentos` и смена владельца объектов останутся, но не мешают. Удалять роль при откате не требуется.

## Open Questions

- Размещение `vector` и владельцы таблиц на prod-базе, если она есть (локально проверено 2026-10-28: `vector` в `public`, схема `ai` и 27 таблиц принадлежали `ai`). Подход D3 работает при любом размещении.

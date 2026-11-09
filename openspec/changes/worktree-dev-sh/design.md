# Design

## Context

Почему — в `proposal.md`. Что важно для решения:

- Стенд запущен из основной папки, проект Compose `authorled` получил имя по папке `Authorled`; в `compose.yaml` нет `name:`, у всех сервисов фиксированный `container_name`.
- Пути bind-монтирований берутся из той папки, откуда вызван compose: `litellm` (`agno/litellm/...`), `authentik-server` и `authentik-worker` (`auth/blueprints`, `auth/templates`), `agentos-db-init` и `authentik-db-init` (`init.sql`), `authentik-jwks-export` (`auth/jwks`), `agentos-migrate` (весь репозиторий `..:/app`). Поэтому `up` из worktree с проектом `authorled` пересоздаёт сервисы, а `run` без `--no-deps` поднимает их зависимости. У `agentos-db`, `clamav`, `mailpit` bind-монтирований из checkout нет.
- `dev.sh test` уже мигрирует на хосте (`uv run alembic`), `migrate` и `api` — контейнером `agentos-migrate`, образ которого собирается из checkout.
- `scripts/hook_session_start.sh` уже отличает основную папку от worktree через `git rev-parse --git-dir` и `--git-common-dir`.
- `agno/db/init.sql` подключается к той базе, которую ему передали (`current_database()`), и подходит для любой базы; роль `agentos` общая для кластера.

## Goals / Non-Goals

**Goals:**
- Один вызов compose на весь скрипт и одна функция подготовки базы для `test`, `migrate` и `api`.
- Каждый отказ называет причину и что сделать; ни одного автоматического «обхода».

**Non-Goals:**
- Блокировки и очереди между сессиями: изоляция даётся отдельными базами, а не координацией.
- Изменения compose-файлов и `init.sql`.

## Decisions

### 1. Основная папка или worktree — по `git`

`git rev-parse --path-format=absolute --git-dir` и `--git-common-dir`: равны — основная папка, иначе worktree; путь основной папки — каталог над `--git-common-dir`, имя worktree — последний компонент `git rev-parse --show-toplevel`. Сбой `git` — отказ с его ошибкой. Так же уже работает хук сессии, второго способа не заводим.

Отклонено: признак по пути `.claude/worktrees/` — ломается для worktree в другом месте и дублирует то, что знает `git`.

### 2. Явный проект `authorled`, без `name:` в `compose.yaml`

Все вызовы compose в скрипте идут через одну функцию `docker compose -p authorled …`. В основной папке это то же имя, что и сейчас. Из worktree `ps`, `exec` и разовые `run --rm --no-deps` попадают в стенд, но не трогают его сервисы. Ручной `docker compose up` в worktree по-прежнему уходит в проект по имени папки и падает на занятых `container_name` — громко, а не тихим пересозданием.

Отклонено: `name: authorled` в `compose.yaml` — ручной `up` из worktree пересоздавал бы стенд молча (решение 2026-11-08). `--project-directory <основная папка>` — worktree терял бы свой `init.sql` и свой `auth/jwks`.

### 3. Команды проверяют стенд, а не поднимают его

`require_running` превращается в `require_healthy <сервис>`: `ps -q --status running`, затем статус здоровья контейнера (`docker inspect`) должен быть `healthy`. Сбой самой команды compose — прежнее сообщение о сбое compose. Сервис не запущен или не `healthy` — отказ с именем сервиса, проектом `authorled` и `./scripts/dev.sh up` в основной папке.

Какие сервисы требуются: `test` — `agentos-db`, `clamav`; `migrate` и `psql` — `agentos-db`; `api` — `agentos-db`, `litellm`, `clamav`, `authentik-server`, `authentik-worker`; `seed` — `agentos-db`, `authentik-worker`; `auth-users` — `mailpit`, `authentik-worker`.

Запуск стенда — новая команда `up` (только основная папка): `up -d --wait agentos-db litellm clamav authentik-server authentik-worker mailpit`; разовые зависимости (`authentik-db-init`) compose поднимает сам. `agentos-api` в список не входит, чтобы порт 8000 оставался для API на хосте.

Отклонено: оставить `up` внутри `api` и `test` только для основной папки — два поведения у одной команды и тот же риск, если кто-то вызовет её с `COMPOSE_PROJECT_NAME`. Печатать в сообщении длинный `docker compose up …` вместо команды `up` — неудобно и легко ошибиться в списке.

### 4. Одна функция подготовки базы, миграции на хосте

`prepare_db <имя> recreate|ensure`:
1. `exec agentos-db psql -U ai -d ai`: для `recreate` — `DROP DATABASE IF EXISTS … WITH (FORCE)` и `CREATE DATABASE`; для `ensure` — `CREATE DATABASE`, только если базы нет (`SELECT … WHERE NOT EXISTS … \gexec`).
2. `run --rm --no-deps -e PGDATABASE=<имя> agentos-db-init` — `init.sql` этой рабочей копии.
3. На хосте под ролью `agentos`: `uv run alembic upgrade head`, затем `alembic -c billing/alembic.ini upgrade head`.

`test` вызывает `recreate`, `migrate` и `api` — `ensure`. Так основная папка и worktree идут одним путём, а образ `agentos-migrate` больше не собирается из worktree. Сервис `agentos-migrate` остаётся в compose для `docker compose up` и production.

Отклонено: `run --rm --no-deps -e DB_DATABASE=… agentos-migrate` — собирает и использует образ `authorled-agentos-migrate` из кода worktree, общий с основной папкой.

### 5. Имена баз

Основная папка: `ai` и `ai_test`. Worktree: `ai_dev_<имя>` и `ai_test_<имя>`, `<имя>` — имя worktree в нижнем регистре, всё кроме `[a-z0-9_]` заменено на `_` (`focused-pare-a6fd10` → `ai_test_focused_pare_a6fd10`). Длиннее 63 байт — отказ с именем, без обрезки. Имя всегда подставляется в SQL как идентификатор (`format('%I', …)` / `"…"`), не строкой.

`conftest.py`: допустимы `ai_test` и `ai_test_<[a-z0-9_]+>`; иначе прежняя ошибка, называющая допустимые имена и `./scripts/dev.sh test`.

### 6. `seed` и `psql` в worktree

`seed` проверяет, что база разработки существует (`SELECT 1 FROM pg_database …` через `exec`), иначе отказ «выполните `./scripts/dev.sh migrate`»; отставание схемы уже ловит `demo/load.py` (`SchemaBehind`). `psql` открывает базу разработки рабочей копии.

### 7. Порт 8000

`api` перед подготовкой базы:
1. если в проекте `authorled` запущен `agentos-api` — отказ: «контейнер agentos-api держит порт 8000; остановить его — `docker compose stop agentos-api` в основной папке, с согласия владельца»;
2. иначе `lsof -nP -t -iTCP:8000 -sTCP:LISTEN`; если есть PID — отказ с PID и именем процесса (`ps -o comm=`).
`lsof` не найден — отказ. Если `lsof` ничего не нашёл, а порт всё же занят, uvicorn сам падает с «Address already in use» — это не подмена ошибки.

### 8. `.env` в worktree

Первая проверка после разбора аргументов, до Docker: в worktree `.env` должен быть ссылкой (`-L`), `readlink .env` должен равняться `<основная папка>/.env`, а цель — существовать. Иначе отказ с готовой командой `ln -sf <основная папка>/.env .env`. В основной папке — прежняя проверка `-f .env`. `AGENTOS_DB_PASSWORD` по-прежнему читается из `.env` (через ссылку).

### 9. Управление стендом из worktree

`up`, `db`, `stop`, `reset-db` в worktree отказывают сразу после проверки `.env`, до Docker, с путём основной папки.

## Risks / Trade-offs

- [Две сессии одновременно запускают `agentos-db-init`: `ALTER ROLE agentos` в обоих, PostgreSQL может ответить «tuple concurrently updated»] → Окно — доли секунды, отказ громкий, повторный запуск проходит. Блокировку не добавляем: на macOS нет `flock`, а advisory-блокировки PostgreSQL действуют в пределах одной базы. Если станет мешать — отдельное изменение `init.sql`.
- [Базы `ai_dev_*` и `ai_test_*` удалённых worktree копятся] → Владелец удаляет их по `\l` в `dev.sh psql`; автоматической уборки нет (Non-goal).
- [Разные имена worktree дают одно имя базы (`a-b` и `a_b`)] → Имена worktree создаёт приложение и они уникальны; принимаем.
- [Имя проекта `authorled` зашито в скрипт, а ручной `docker compose` в основной папке берёт имя по папке] → Совпадают, пока папка называется `Authorled`; при переименовании папки ручные команды и `dev.sh` разойдутся — это видно сразу по «сервис не запущен в проекте authorled».
- [Владелец привык, что `dev.sh api` всё поднимает и останавливает `agentos-api`] → Сообщения называют `./scripts/dev.sh up` и `docker compose stop agentos-api`; README и AGENTS.md обновляются.
- [Ветка меняет определение сервиса стенда в compose] → Из worktree это не применить, только после слияния, из основной папки. Так и задумано.
- [Coauthor-eval (`python -m evals.coauthor`) берёт `DB_*`, как `dev.sh api`] → В worktree это `ai_dev_<имя>`; README eval обновляется, код eval не меняется.

## Migration Plan

1. После слияния владелец делает `git pull` в основной папке; стенд не перезапускается, данные `ai` и `ai_test` не меняются.
2. В действующих worktree копию `.env` заменяют ссылкой (команду печатает `dev.sh`).
3. Перед `dev.sh api` в основной папке: `./scripts/dev.sh up`; если работает контейнер `agentos-api` — остановить его (решение владельца).
4. Откат — revert PR; базы `ai_dev_*` и `ai_test_*` остаются и ничему не мешают.

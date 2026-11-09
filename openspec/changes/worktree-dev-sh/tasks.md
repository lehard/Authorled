# Tasks

Проверки двух видов. На копии: `scripts/dev.sh` и compose-файлы в scratchpad сессии, во временном git-репозитории с основной папкой и worktree, с заглушкой `docker` в `PATH`, которая пишет вызовы в журнал и отвечает заданным выводом. На стенде: только из worktree этой ветки (и временного второго worktree от неё), только свои базы `ai_test_<имя>` и `ai_dev_<имя>`; контейнеры стенда не запускаются, не останавливаются и не пересоздаются, `ai` и `ai_test` не меняются, `auth-users` и `seed` на стенде не запускаются. Перед проверками на стенде и после них записывать время создания, время запуска и `com.docker.compose.project.working_dir` контейнеров стенда и ревизии Alembic в `ai`.

## 1. Основная папка, worktree и `.env`

- [x] 1.1 Добавить в `scripts/dev.sh` определение основной папки и worktree через `git rev-parse --git-dir`/`--git-common-dir`, путь основной папки и имя worktree (design, решение 1); сбой `git` — отказ с его ошибкой; проверить на копии: в основной папке и в worktree скрипт печатает в отладочном прогоне верные путь и имя, без `git` — код 1
- [x] 1.2 Проверка `.env` в worktree (design, решение 8): ссылка на `<основная папка>/.env`, иначе код 1 с командой `ln -sf …`, до любого вызова `docker`; в основной папке — прежняя проверка; проверить на копии: обычный файл, ссылка на другой файл, ссылка на несуществующий основной `.env` — код 1, журнал заглушки `docker` пуст; верная ссылка — проверка проходит
- [x] 1.3 Отказ `up`, `db`, `stop`, `reset-db` в worktree с путём основной папки, до Docker (design, решение 9); проверить на копии: код 1, журнал `docker` пуст; в основной папке эти команды доходят до `docker compose -p authorled …`

## 2. Проект `authorled` и проверка стенда

- [x] 2.1 Свести все вызовы compose к одной функции с `-p authorled` (design, решение 2); заменить `require_running` на `require_healthy` с прежним сообщением о сбое compose и новым сообщением «сервис, проект `authorled`, `./scripts/dev.sh up` в основной папке» (решение 3); поставить проверки в `test`, `migrate`, `api`, `seed`, `psql`, `auth-users` по списку решения 3 и убрать из них `up`, `stop agentos-api` и `run` без `--no-deps`; проверить на копии: сервис не запущен, запущен без `healthy`, сбой `compose ps` — по коду 1 и нужному сообщению; в журнале `docker` нет `up`, `stop`, `restart`, `run` без `--no-deps`
- [x] 2.2 Команда `up` (только основная папка): `up -d --wait agentos-db litellm clamav authentik-server authentik-worker mailpit`; справка и шапка скрипта перечисляют `up` и новое поведение команд; проверить на копии: в основной папке в журнале ровно этот вызов, `agentos-api` в нём нет; `./scripts/dev.sh` без аргумента печатает справку с `up` и выходит с кодом 2

## 3. Базы рабочей копии

- [x] 3.1 Имена баз (design, решение 5): `ai`/`ai_test` в основной папке, `ai_dev_<имя>`/`ai_test_<имя>` в worktree, замена символов, отказ при длине больше 63 байт до обращения к базе; проверить на копии: worktree `Focused-Pare.a6fd10` даёт `ai_test_focused_pare_a6fd10`, worktree с длинным именем — код 1 с именем базы, журнал `docker` пуст
- [x] 3.2 Функция `prepare_db <имя> recreate|ensure` (design, решение 4): создание через `exec agentos-db psql -U ai -d ai` с именем как идентификатором, `run --rm --no-deps -e PGDATABASE=<имя> agentos-db-init`, миграции ядра и биллинга на хосте через `uv`; `test` — `recreate`, `migrate` и `api` — `ensure`; `migrate` проверяет `uv`; вызовов `agentos-migrate` в скрипте не остаётся; проверить на копии: последовательность вызовов в журнале для каждой команды и рабочей копии, `ensure` не содержит `DROP DATABASE`
- [x] 3.3 `seed`: отказ «выполните `./scripts/dev.sh migrate`», если базы разработки нет; `seed` и `psql` работают с базой разработки рабочей копии (design, решение 6); проверить на копии: заглушка отвечает «базы нет» — код 1 с этим сообщением, без вызова `uv`; `psql` в worktree открывает `ai_dev_<имя>`
- [x] 3.4 `agno/tests/conftest.py`: допустимы `ai_test` и `ai_test_<[a-z0-9_]+>`, ошибка называет допустимые имена и `./scripts/dev.sh test`; обновить строку модуля; проверить: pytest с `DB_DATABASE=ai` (остальные `DB_*` — заглушки, соединения нет) падает с этой ошибкой

## 4. Порт API

- [x] 4.1 В `api` до подготовки базы: отказ, если в проекте `authorled` запущен `agentos-api` (сообщение с `docker compose stop agentos-api` в основной папке и согласием владельца), иначе отказ по `lsof -nP -t -iTCP:8000 -sTCP:LISTEN` с PID и именем процесса; без `lsof` — отказ (design, решение 7); проверить на стенде из этого worktree: пока работает контейнер `agentos-api`, `./scripts/dev.sh api` выходит с кодом 1 до миграций, время запуска `agentos-api` не изменилось, базы `ai_dev_<имя>` не появилось; на копии: заглушка `lsof` с PID — код 1 с PID

## 5. Проверка на стенде из worktree

- [ ] 5.1 В этом worktree `.env` — ссылка на `.env` основной папки; `./scripts/dev.sh test` проходит в `ai_test_<имя>`; после прогона у контейнеров стенда то же время создания, запуска и тот же рабочий каталог, ревизии `ai` прежние
- [ ] 5.2 `./scripts/dev.sh migrate` из этого worktree создаёт и мигрирует `ai_dev_<имя>`; повторный `migrate` проходит без пересоздания базы (данные строки, вставленной между запусками, на месте); ревизии `ai` прежние
- [ ] 5.3 Параллельные прогоны: временный второй worktree от этой ветки (со ссылкой `.env`), `./scripts/dev.sh test` в обоих одновременно — оба проходят в своих базах; затем удалить временный worktree и его базы `ai_test_<имя>` и `ai_dev_<имя>`
- [ ] 5.4 Отказы на стенде из worktree: `./scripts/dev.sh up`, `db`, `stop`, `reset-db --yes` — код 1 с путём основной папки, контейнеры стенда без изменений

## 6. Документы

- [x] 6.1 `AGENTS.md` (через него `CLAUDE.md`): «Parallel sessions» — стенд основной папки, свои базы worktree, ссылка `.env`; «Local development» — `up`, базы, порт 8000, `migrate` на хосте; строки про `test`, `seed`, `api` в «Where changes belong» и «Verification», если перестают быть верными; проверить чтением и `grep "dev.sh"` по файлу
- [x] 6.2 `README.md` (локальная разработка, `migrate`, `test`, `seed`, `JWT_JWKS_FILE`, `DB_*`), `agno/docs/sandboxes.md` (что делает `dev.sh api`), `agno/evals/coauthor/README.md` (`DB_*` как у `dev.sh api`, в worktree — `ai_dev_<имя>`), `openspec/context/04-engineering-standards.md` (команды тестов и миграций), строки модулей `agno/tests/test_clamav.py` и `agno/tests/test_file_routes.py` («сервис, который запускает `dev.sh test`»); проверить `grep -rn "dev.sh \(api\|test\|migrate\|db\|seed\|psql\)\|ai_test"` по этим файлам — нет устаревших утверждений

## 7. Завершающие проверки

- [ ] 7.1 Перенести дельты в мастер-спеки при архивации и пройти `openspec validate worktree-dev-sh --strict`
- [ ] 7.2 `bash -n scripts/dev.sh`, `./scripts/validate.sh` в `agno/.venv` (с `env -u BASH_ENV`), `git diff --check`; записать в `tmp/VERIFY.md` прогоны на копии как детерминированные, прогоны 4.1 и 5.x как проверки на контейнерах стенда из worktree, а поведение из основной папки на стенде — как не проверенное (его запускает владелец)

## Workflow follow-up

- После слияния владелец в основной папке: `git pull`, `./scripts/dev.sh up`, `./scripts/dev.sh test` (база `ai_test`); перед `./scripts/dev.sh api` сам останавливает контейнер `agentos-api`, если он работает.
- В действующих worktree копию `.env` заменяют ссылкой (команду печатает `dev.sh`).
- Уборка `story-materials-test-db` и томов `*_pgdata` других стендов — отдельно, с согласия владельца.

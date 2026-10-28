# Tasks

## 1. Healthcheck базы

- [x] 1.1 Добавить в `agentos-db` в `compose.yaml` healthcheck `pg_isready -U ai -d ai` (interval 5s, retries 12, start_period 10s), не трогая другие строки файла; проверить `git diff compose.yaml` (только этот блок) и `docker compose config -q` с заполненным `.env`
- [x] 1.2 Проверить статусы: `docker compose up -d agentos-db`, затем `docker inspect -f '{{.State.Health.Status}}' agentos-db` проходит `starting` → `healthy`

## 2. Скрипт `scripts/dev.sh`

- [x] 2.1 Создать `scripts/dev.sh` (`set -euo pipefail`, `cd` в корень, `usage()`, коды 1/2, проверки `docker`, `.env`, для `api` — `uv`) с командами `db` и `stop`; проверить: `./scripts/dev.sh db` возвращает 0 при `healthy`, `./scripts/dev.sh stop` останавливает сервисы без потери тома, повторный `db` видит те же данные
- [x] 2.2 Добавить `api`: поднять `agentos-db` и `litellm` с `--wait`, остановить `agentos-api`, запустить `uv run --no-project --env-file .env --with-requirements requirements.txt uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir agents --reload-dir app --reload-dir db --reload-dir evals` с переменными хоста; проверить: `curl http://127.0.0.1:8000/health` отвечает, правка файла в `app/` перезапускает сервер
- [x] 2.3 Добавить `psql` и `reset-db` (отказ без `--yes`, удаление контейнера и тома по меткам Compose, ошибка при ненайденном томе); проверить: без `--yes` том цел, с `--yes` следующий `db` создаёт пустую базу
- [x] 2.4 Проверить отказы: без `.env`, без `docker`/`uv` (подмена `PATH`), без аргумента и с неизвестной командой — коды 1/1/2/2 и осмысленные сообщения; `git diff --check` чисто

## 3. Документация и спека

- [x] 3.1 Обновить `README.md` (Run locally), `AGENTS.md` (Local development) и `docs/sandboxes.md`: заменить ручную команду на `./scripts/dev.sh api`, описать команды скрипта и требование `.env`; проверить, что команды из текста выполняются как написано
- [x] 3.2 Прогнать `./scripts/validate.sh` и `openspec validate add-local-dev-postgres --strict`; записать результаты (container: healthcheck, `dev.sh`; что не проверено) в `tmp/VERIFY.md`

## 4. Интеграционная проверка

- [x] 4.1 С чистого состояния (`reset-db --yes`) выполнить `./scripts/dev.sh api`, убедиться, что API подключился к базе (в логах нет ошибок БД, `psql` показывает таблицы Agno), выполнить `/opsx:verify`

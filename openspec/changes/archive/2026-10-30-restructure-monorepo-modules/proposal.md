# Proposal

## Why

Репозиторий состоит из трёх модулей: бэкенд на Agno, фронтенд и авторизация. По структуре папок это не видно:
- бэкенд лежит в корне вперемешку с общими файлами (наследие шаблона Agno);
- фронтенд лежит в `web/`;
- авторизация разнесена: деплой-часть в `modules/auth/`, а `modules/` содержит единственный модуль.

Владелец решил, что у каждого модуля должна быть своя папка верхнего уровня: `agno/`, `web/`, `auth/`, а в корне — только общее. Делаем это сейчас, пока продуктового ядра нет и переносить почти нечего. Источник — `business-intents/monorepo-three-modules.md`.

Архитектура не меняется. Проект остаётся модульным монолитом (ADR-001): один репозиторий, один релиз бэкенда и авторизации, одна PostgreSQL со схемами `ai` и `authentik`.

## What Changes

- **`agno/` — модуль бэкенда.** Сюда переезжают:
  - код: `app/` (включая `app/auth/`), `agents/`, `db/` (вместе с `db/init.sql`), `evals/`;
  - сборка и зависимости: `pyproject.toml`, `requirements.txt`, `Dockerfile`;
  - `litellm/`, `docs/`;
  - скрипты только бэкенда, в `agno/scripts/`: `entrypoint.sh`, `venv_setup.sh`, `generate_requirements.sh`, `build_image.sh`, `build_ca_bundle.sh`.
  - Новый compose-фрагмент `agno/compose.yaml` содержит сервисы `agentos-db-init`, `litellm`, `agentos-api`.
- **`auth/` — модуль авторизации.** Содержимое `modules/auth/` переезжает в `auth/`, папка `modules/` удаляется. Кодовая часть модуля остаётся в бэкенде: `agno/app/auth/`.
- **`web/`** остаётся на месте. `scripts/check_web_tokens.sh` переезжает в `web/scripts/`.
- **Корень — общее для всех модулей:**
  - `compose.yaml` подключает `agno/compose.yaml` и `auth/compose.yaml` через `include` и объявляет общую PostgreSQL (`agentos-db`) и её том;
  - `compose.prod.yaml`, `example.env`, `.env`;
  - `openspec/`, `business-intents/`, `.agents/`, `.github/`, `AGENTS.md`/`CLAUDE.md`, `README.md`, `LICENSE`, `tmp/`;
  - `scripts/` — скрипты всего стека: `dev.sh`, `validate.sh`, `format.sh`, `auth_check.sh`, `mcp_check.sh`, `check_auth_boundary.sh`.
- **Корень репозитория в коде** задаётся одной константой. От неё по-прежнему зависят:
  - корень OS Manager;
  - рабочая папка `claude-engineer`;
  - локальный Git Source компании;
  - `.env` для evals;
  - каталог checkpoints.

  Все эти места продолжают указывать на корень репозитория, а не на `agno/`.
- **Образ API** собирается по `agno/Dockerfile` с контекстом сборки — корнем репозитория. Состав образа не меняется: код бэкенда, `.agents/skills/`, `AGENTS.md`, `openspec/`; без `web/`.
- **Пути обновляются в остальных местах:** CI, `.dockerignore`, скиллы `.agents/skills/`, `AGENTS.md`, README, `docs/`, контекст-пак, мастер-спеки.
- **BREAKING (для разработчиков, не для данных):**
  - команды сборки образа песочницы и Python-окружения меняют пути (`-f agno/Dockerfile`, `agno/scripts/…`);
  - `.venv` создаётся в `agno/.venv`, существующий корневой `.venv` нужно пересоздать;
  - на сервере после выкатки обновляются рабочая копия и команды деплоя.

  Имена сервисов, контейнеров, томов, переменных окружения и compose-проекта не меняются.

## Scope

- Перенос файлов через `git mv` по списку выше.
- Новый `agno/compose.yaml`. В корневом `compose.yaml` остаются `include`, `agentos-db`, том и сеть.
- `agno/Dockerfile` (пути внутри образа), `.dockerignore`, `pyproject.toml` (поиск пакетов и настройки ruff/mypy от нового расположения).
- Константа корня репозитория и её использование в `app/main.py`, `app/company.py`, `app/sandbox.py`, `agents/engineers.py`, `evals/__main__.py`.
- Скрипты: `dev.sh`, `validate.sh`, `format.sh`, `check_auth_boundary.sh`, `auth_check.sh`, `mcp_check.sh`, перенесённые скрипты бэкенда и фронтенда.
- `.github/workflows/validate.yml`.
- Документация:
  - `AGENTS.md`, `README.md`, `web/README.md`, `docs/`, `.agents/skills/*`;
  - `openspec/context/` (ADR-001, `00-start-here.md`, `03-architecture.md`, `04-engineering-standards.md`), `openspec/config.yaml`, `openspec/TODO.md`;
  - Purpose-разделы мастер-спек `overview` и `architecture`.
- Дельты мастер-спек `architecture`, `auth`, `runtime`.
- Проверки:
  - `docker compose config` до и после;
  - стек на пустой и на существующей базе;
  - состав образа до и после;
  - `validate.sh`, `auth_check.sh`, `mcp_check.sh`, `./scripts/dev.sh api`;
  - поиск старых путей;
  - запись в `tmp/VERIFY.md`.

## Non-goals

- Изменение логики, API, агентов, промптов, схем БД, blueprints.
- Переименование сервисов, контейнеров, томов, сетей, переменных окружения, compose-проекта.
- Вынос какого-либо модуля в отдельный репозиторий, отдельную базу или отдельный релиз.
- Обновление пинов Agno, Authentik, LiteLLM или зависимостей фронтенда.
- Запуск фронтенда в Docker.
- Правка архива `openspec/changes/archive/`: это история, старые пути в нём остаются.
- Исправление найденных расхождений спек и кода, не связанных с путями (см. Impact).

## Capabilities

### New Capabilities

(нет)

### Modified Capabilities

- `architecture`:
  - новое требование «Раскладка монорепозитория» (три модуля, общий корень, пути кода бэкенда в спеках — относительно `agno/`, константа корня репозитория);
  - «Слои приложения» — пути `agno/…` и `auth/`; образ собирается по `agno/Dockerfile`.
- `auth`:
  - «Состав и границы модуля» — деплой-часть `auth/`, фрагмент `auth/compose.yaml`, кодовая часть `agno/app/auth/`;
  - «Конфигурация из blueprints» — blueprints в `auth/`.
- `runtime`:
  - «Контейнеры разработки» — фрагмент `agno/compose.yaml`, bind-mount и каталоги reload;
  - «Образы» — `agno/Dockerfile`, контекст сборки, entrypoint, команда сборки песочницы;
  - «Публикация образа» — `agno/scripts/build_image.sh`;
  - «Проверки кода» — Python-проверки по `agno/`, `web/scripts/check_web_tokens.sh`;
  - «Окружение Python» — `agno/scripts/…`, `agno/.venv`;
  - «Скрипт локальной разработки» — запуск API на хосте из `agno/`.

## Impact

- **Перенос файлов:** около 40 отслеживаемых файлов бэкенда и 8 файлов модуля `auth`. Логика кода не меняется, правятся только вычисляемые пути.
- **Данные:** не затрагиваются. Compose-проект `authorled` и том `authorled_pgdata` остаются, потому что `compose.yaml` остаётся в корне.
- **Разработчики:** пересоздать `.venv` (`agno/scripts/venv_setup.sh`); новые команды сборки песочницы и генерации requirements.
- **Сервер:** после выкатки обновить рабочую копию; команда `docker compose -f compose.yaml -f compose.prod.yaml up -d --build` не меняется.
- **Обновления шаблона Agno:** изменения из `agentos-docker` придётся переносить с поправкой на `agno/`.
- **Расхождения спек и кода, найденные при подготовке.** Они не про пути и вне scope, поэтому выносятся владельцу:
  - спека `overview`, «Возможности AgentOS»: `RUNTIME_ENV` по умолчанию `prd` и `AGENTOS_URL` по умолчанию `http://127.0.0.1:8000`, тогда как `app/main.py` требует обе переменные (`_required_env`);
  - Purpose спеки `overview` говорит, что модели переключены на Claude, а в коде DeepSeek через LiteLLM.

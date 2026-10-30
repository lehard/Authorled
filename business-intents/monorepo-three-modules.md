# Бизнес-интент: монорепозиторий из трёх модулей — `agno/`, `web/`, `auth/`

Статус: change `restructure-monorepo-modules` реализован и архивирован 2026-10-30 (`openspec/changes/archive/2026-10-30-restructure-monorepo-modules/`). Открытые вопросы ниже решены в его design (D3, D5, D6). Владелец: lehard. Обновлено: 2026-10-30.
Рамки: `openspec/context/ADR/ADR-001-three-services.md` (модульный монолит, монорепозиторий), `openspec/context/03-architecture.md`, `openspec/specs/auth`, `openspec/specs/architecture`.

## Why

Репозиторий состоит из трёх модулей: бэкенд на Agno, фронтенд и авторизация. Сейчас это не видно по его структуре:
- бэкенд лежит прямо в корне вперемешку с общими файлами (наследие шаблона Agno);
- фронтенд лежит в `web/`;
- авторизация разнесена: деплой-часть в `modules/auth/`, а `modules/` содержит единственный модуль.

Нужна структура, где каждый модуль — своя папка верхнего уровня, а в корне лежит только общее. Так проще понять проект, держать границы модулей и при необходимости вынести модуль в отдельный репозиторий целиком.

Архитектура при этом не меняется. Проект остаётся модульным монолитом (ADR-001): один репозиторий, один релиз бэкенда и авторизации, одна база со схемами `ai` и `authentik`. Меняется только расположение файлов.

## What Changes

1. **`agno/` — модуль бэкенда.** Сюда переезжают:
   - `app/` (включая `app/auth/`), `agents/`, `db/`, `evals/`;
   - `pyproject.toml`, `requirements.txt`, `Dockerfile`;
   - `litellm/` (прокси моделей использует только бэкенд);
   - `docs/` (документы про песочницы и обновление Agno);
   - скрипты, нужные только бэкенду: форматирование, venv, генерация requirements, сборка образа, entrypoint, CA bundle;
   - compose-фрагмент `agno/compose.yaml` с сервисами `agentos-db-init`, `litellm`, `agentos-api` (по образцу `modules/auth/compose.yaml`).
2. **`auth/` — модуль авторизации.**
   - Содержимое `modules/auth/` переезжает в `auth/`, папка `modules/` исчезает.
   - Код проверки токена `app/auth/` остаётся в `agno/app/auth/`. Он работает в процессе бэкенда и при выносе `auth/` остаётся в бэкенде, как и сейчас.
3. **`web/` — модуль фронтенда.** Остаётся на месте; правятся только ссылки на пути.
4. **Корень — общее для всех модулей:**
   - `compose.yaml` подключает `agno/compose.yaml` и `auth/compose.yaml` и объявляет общую PostgreSQL (`agentos-db`), сеть и том; `compose.prod.yaml` — там же;
   - `example.env` и `.env` — один файл на весь стек;
   - `openspec/`, `business-intents/`, `.agents/`, `.github/`, `AGENTS.md`/`CLAUDE.md`, `README.md`, `LICENSE`;
   - `scripts/` — только скрипты всего стека: `dev.sh`, `validate.sh`, `auth_check.sh`, `mcp_check.sh`, `check_auth_boundary.sh`.
5. **Правка путей** во всех местах, которые на них ссылаются: compose-файлы, `.dockerignore`, CI (`.github/workflows/validate.yml`), скрипты, `AGENTS.md`, README, скиллы в `.agents/skills/`, контекст-пак, мастер-спеки, `openspec/config.yaml`.

## Scope

- Перенос файлов через `git mv`, чтобы история файлов сохранилась.
- Compose-фрагмент бэкенда `agno/compose.yaml`; корневой `compose.yaml` только подключает фрагменты и держит общие сервисы.
- Поведение кода, зависящее от расположения, сохраняется явно (см. Constraints): корень проекта для OS Manager, папка работы инженера, Git Source компании, путь к `.env` для evals, путь к checkpoints.
- Обновление проверки границ `check_auth_boundary.sh` под новые пути.
- Обновление ADR-001, `03-architecture.md`, мастер-спек `auth` и `architecture`, `AGENTS.md`, README, скиллов.
- Проверка: стек поднимается с нуля и на существующих данных, `validate.sh`, CI, `auth_check.sh`, `mcp_check.sh`; запись в `tmp/VERIFY.md`.

## Non-goals

- Изменение логики, API, агентов, промптов, схем БД.
- Переименование сервисов, контейнеров, томов, сетей и переменных окружения.
- Разделение на несколько репозиториев: структура только готовит к этому.
- Отдельная база или отдельный релиз для какого-либо модуля.
- Обновление пина Agno, Authentik или зависимостей фронтенда.
- Запуск фронтенда в Docker.

## Constraints (из контекст-пака)

- Модульный монолит (ADR-001): один релиз бэкенда и авторизации, общая PostgreSQL, схемы `ai` и `authentik`.
- Сохранённые данные не теряются. Имя compose-проекта (`authorled`, по имени корневой папки) и имена томов (`authorled_pgdata`) не меняются, поэтому `compose.yaml` остаётся в корне.
- Конфигурация стека не меняется по смыслу: `docker compose config` до и после отличается только путями.
- Состав образа API не теряет того, что читает OS Manager: `.agents/skills/`, `AGENTS.md`, `openspec/` и код бэкенда остаются в образе; `web/` по-прежнему не попадает.
- OS Manager, инженер и локальный Git Source компании по-прежнему видят весь репозиторий, а не только `agno/`: им нужны `.git`, `openspec/` и остальные модули. Корень вычисляется явно, без подстановок по умолчанию.
- Без fallback: старые пути не поддерживаются параллельно, не нашлось файла — явная ошибка.
- Граница `auth` сохраняется: вне `agno/app/auth/` нет чтения JWT и claims, вне `auth/` нет blueprints и сервисов Authentik.
- Секреты не попадают в код и коммиты.

## Acceptance criteria

- В корне репозитория из модулей только `agno/`, `web/`, `auth/`; папок `modules/`, `app/`, `agents/`, `db/`, `evals/` в корне нет.
- `docker compose config` (dev и prod) до и после совпадает, кроме путей к файлам.
- `docker compose up -d --build` на пустой базе поднимает весь стек; `auth_check.sh` и `mcp_check.sh` проходят.
- На существующем томе `authorled_pgdata` стек поднимается, старые данные (сессии, Company, заметки) на месте.
- `./scripts/validate.sh` и CI проходят; `git diff --check` чист.
- `./scripts/dev.sh api` запускает API на хосте из нового расположения.
- `check_auth_boundary.sh` проверяет новые пути и падает, если blueprints или сервисы Authentik появились вне `auth/`.
- Поиск по репозиторию не находит ссылок на старые пути (`modules/auth`, корневые `app/`, `agents/` и т. п.) вне архива `openspec/changes/archive/`.
- Корень проекта для OS Manager, папка работы инженера и локальный Git Source указывают на корень репозитория, как сейчас.
- `git log --follow` показывает историю перенесённых файлов.

## Risks

- **Обновления шаблона Agno.** Бэкенд перестаёт совпадать с раскладкой шаблона `agentos-docker`; изменения из него придётся переносить с поправкой на `agno/`. Касается раздела «Upgrade from an older template» в `docs/upgrading.md`.
- **Пути, вычисляемые в коде.** `app/main.py`, `app/company.py`, `app/sandbox.py`, `agents/engineers.py`, `evals/__main__.py` получают корень через `Path(__file__).parents[...]`; после переноса без правки они молча станут указывать на `agno/`, а не на корень. Каждое место проверяется отдельно.
- **Сохранённый Git Source компании.** Объявления не перезаписывают сохранённые записи в БД; если путь Source изменится, в базе останется старая запись. Цель — путь не менять (корень репозитория).
- **Контекст сборки образа.** При переносе `Dockerfile` в `agno/` контекст сборки должен остаться корнем репозитория, иначе из образа пропадут скиллы, `AGENTS.md` и `openspec/`. Состав образа сравнивается до и после.
- **Рабочая папка команд.** Python-команды (`ruff`, `mypy`, `python -m evals`, импорт `app.*`) сейчас запускаются из корня; после переноса им нужна рабочая папка `agno/` или явная настройка путей. Влияет на скрипты, CI и инструкции.
- **Много ссылок в документации и скиллах.** Пропущенная ссылка не ломает запуск, но вводит агентов в заблуждение; закрывается поиском по старым путям в критериях приёмки.
- **Архив OpenSpec** ссылается на старые пути; архив не правим, это история.

## Open Questions

- Где лежит `.venv` и откуда запускаются Python-команды? Рекомендация: `.venv` в `agno/`, корневые скрипты сами переходят в `agno/`, пользователь продолжает запускать всё из корня.
- Где лежит `Dockerfile`? Рекомендация: `agno/Dockerfile`, контекст сборки — корень репозитория, `.dockerignore` в корне.
- Куда отнести `scripts/check_web_tokens.sh`? Рекомендация: `web/scripts/`, вызывается из корневого `validate.sh`.
- Имя модуля бэкенда: `agno/` (по фреймворку) или `backend/` (по роли)? Рекомендация владельца — `agno/`; принято, если не решено иначе.

## Capabilities

### Modified Capabilities
- `architecture`: состав репозитория — три модуля верхнего уровня и общий корень; расположение compose-фрагментов.
- `auth`: путь деплой-части `auth/` вместо `modules/auth/`; формулировки границы модуля и проверки.
- `runtime`: пути к compose-фрагментам, скриптам и `.env`, если они упомянуты в требованиях.

## Impact

- Переезжают: `app/`, `agents/`, `db/`, `evals/`, `docs/`, `litellm/`, `pyproject.toml`, `requirements.txt`, `Dockerfile`, часть `scripts/` → `agno/`; `modules/auth/` → `auth/`.
- Новый: `agno/compose.yaml`.
- Изменяются: `compose.yaml`, `compose.prod.yaml`, `.dockerignore`, `.github/workflows/validate.yml`, `scripts/*`, `AGENTS.md`, `README.md`, `.agents/skills/*`, `openspec/config.yaml`.
- Код с вычисляемыми путями: `app/main.py`, `app/company.py`, `app/sandbox.py`, `agents/engineers.py`, `evals/__main__.py`.
- Контекст-пак: ADR-001 (раскладка репозитория), `03-architecture.md`, `openspec/TODO.md`.
- Сервер: после выкатки обновить рабочую копию и команду деплоя, если она ссылается на пути.

## References

- `openspec/context/ADR/ADR-001-three-services.md`
- `openspec/changes/archive/2026-10-28-prepare-auth-module-extraction/` — предыдущий шаг: модуль `auth` как compose-фрагмент
- Docker Compose `include`: https://docs.docker.com/compose/how-tos/multiple-compose-files/include/

# Design

## Context

Мотивация — в `proposal.md`, требования — в `specs/`. Опора: ADR-001 (модульный монолит, модуль `auth` из двух частей, один релиз) и инварианты `03-architecture.md` (одна БД через `get_postgres_db()`, одна инстанция API, без fallback).

Состояние на 2026-10-30:
- **Бэкенд в корне.** `app/`, `agents/`, `db/` (с `db/init.sql`), `evals/`, `litellm/`, `docs/`, `Dockerfile`, `pyproject.toml`, `requirements.txt`. Модуль `auth` — в `modules/auth/` (8 отслеживаемых файлов); `web/` уже отдельно.
- **Корневой `compose.yaml`** объявляет `agentos-db`, `agentos-db-init`, `litellm`, `agentos-api` и подключает `modules/auth/compose.yaml`. Проверено в change `prepare-auth-module-extraction`:
  - пути в подключённом файле считаются от его каталога;
  - переменные берутся из корневого `.env`;
  - `depends_on` между файлами работает в обе стороны;
  - `compose.prod.yaml` переопределяет подключённые сервисы.
- **Образ API.** Контекст сборки — корень, `COPY . .` в `/app`, `PYTHONPATH=/app`. В образ попадают `.agents/skills/`, `AGENTS.md`, `openspec/` (OS Manager читает их на сервере); `web/` исключён `.dockerignore`. В dev корень репозитория монтируется в `/app`.
- **Корень репозитория в коде** вычисляется от расположения файла в пяти местах:
  - `app/main.py`: `agentos_root` — корень OS Manager и путь к `app/config.yaml`;
  - `app/company.py`: локальный Git Source;
  - `app/sandbox.py`: `tmp/checkpoints`;
  - `agents/engineers.py`: рабочая папка инженера;
  - `evals/__main__.py`: `.env`.

  После переноса на один уровень глубже все они без правки молча укажут на `agno/`.
- **Скрипты** находят корень как `$(dirname "$0")/..`. Python-проверки (`ruff`, `mypy`) идут по корню с настройками корневого `pyproject.toml`; `check_auth_boundary.sh` импортирует `app.auth.authorization`.
- **Сохранённый Git Source компании** хранит путь корня репозитория. Объявления не перезаписывают сохранённые записи.

## Goals / Non-Goals

**Goals:**
- После переноса внутри контейнера и на хосте видно то же, что сейчас: OS Manager и инженер работают от корня репозитория, compose-проект и том те же, образ содержит те же файлы.
- Перенос виден в истории git как переименования.

**Non-Goals:**
- Prod-переопределения сервисов модулей остаются в корневом `compose.prod.yaml`, как и сейчас.
- Существующие значения по умолчанию в перемещаемых файлах (`${IMAGE_NAME:-agentos}:${IMAGE_TAG:-latest}` у `agentos-api`, `IMAGE_TAG:-latest` в `build_image.sh`) переносятся как есть. Это существующие fallback-и; они выносятся владельцу, а не исправляются в этом change.

## Decisions

### D1. Перенос через `git mv`, одним change

Файлы переносятся `git mv` по списку из proposal, затем правятся пути.

Правки в перемещённых файлах малы (пути), поэтому git распознаёт переименования и `git log --follow` сохраняет историю. Неотслеживаемые локальные файлы (`modules/auth/jwks/jwks.json`, корневой `.venv`, `agentos_docker.egg-info`) `git mv` не переносит:
- выгруженные ключи пересоздаёт `authentik-jwks-export`, старый файл удаляется вместе с пустым `modules/`;
- окружение пересоздаётся (D5).

Альтернатива — переносить по модулям отдельными change. Отклонена: промежуточные состояния (бэкенд в корне, `auth/` уже отдельно) так же ломают пути, а проверять стек пришлось бы дважды.

### D2. Compose: фрагмент бэкенда `agno/compose.yaml`

`agentos-db-init`, `litellm`, `agentos-api` переезжают в `agno/compose.yaml` с якорями и комментариями. Пути в фрагменте задаются относительно `agno/`:
- `build.context: ..`, `build.dockerfile: agno/Dockerfile`;
- bind-mount `..:/app`;
- `./litellm/...`, `./db/init.sql`;
- `env_file: ../.env`.

Корневой `compose.yaml` содержит `include` двух фрагментов, `agentos-db`, сеть `agentos` и том `pgdata`.

`agentos-db` остаётся в корне, потому что это общая база двух модулей. Имя проекта задаёт каталог первого compose-файла, то есть корень, поэтому `authorled` и `authorled_pgdata` сохраняются.

`JWT_JWKS_FILE` у `agentos-api` — `/app/auth/jwks/jwks.json`: в контейнере `/app` — корень репозитория.

Альтернатива — оставить сервисы бэкенда в корневом `compose.yaml`. Отклонена: корень перестал бы быть «только общим», и модуль бэкенда не был бы симметричен `auth/`.

### D3. Образ: контекст — корень репозитория, рабочий каталог — `/app/agno`

`agno/Dockerfile`:
- база копирует `agno/requirements.txt`;
- цель `agentos` копирует весь контекст в `/app`, задаёт `WORKDIR /app/agno` и `PYTHONPATH=/app/agno`;
- entrypoint — `/app/agno/scripts/entrypoint.sh`;
- `CMD` не меняется (`uvicorn app.main:app` из рабочего каталога).

В dev команда `agentos-api` — `uvicorn ... --reload-dir /app/agno/agents ... /app/agno/evals`. `.dockerignore` остаётся в корне; правило ключей меняется на `auth/jwks/jwks.json*`.

Внутри контейнера раскладка совпадает с репозиторием. Поэтому одна и та же константа корня (D4) работает на хосте, в dev-контейнере и в образе.

Отклонённые альтернативы:
- Контекст `agno/`: из образа пропали бы `.agents/skills/`, `AGENTS.md`, `openspec/`, которые читает OS Manager.
- Плоское копирование `agno/*` в `/app`: раскладка в образе разошлась бы с dev bind-mount, и корень пришлось бы вычислять по-разному.

### D4. Одна константа корня репозитория

Новый модуль `agno/app/paths.py` объявляет `REPO_ROOT = Path(__file__).resolve().parents[2]`. Если в этом каталоге нет файла `AGENTS.md`, импорт падает с `RuntimeError`, называющей путь.

Пять мест из Context берут корень из неё:
- `app/main.py`: `OSManager(root=REPO_ROOT)`; манифест — `REPO_ROOT / "agno" / "app" / "config.yaml"`;
- `app/company.py`: Git Source — `str(REPO_ROOT)`, путь тот же, что сохранён в БД;
- `app/sandbox.py`: `REPO_ROOT / "tmp" / "checkpoints"`;
- `agents/engineers.py`: `cwd = str(REPO_ROOT)`;
- `evals/__main__.py`: `.env` — `REPO_ROOT / ".env"`. `app.paths` не читает окружение, поэтому его можно импортировать до `load_dotenv`.

Проверка `AGENTS.md` — не fallback, а явный отказ. Она ловит ошибку уровня `parents[...]` при будущих переносах, которая иначе молча сузила бы то, что видят OS Manager и инженер.

Отклонённые альтернативы:
- Переменная окружения `REPO_ROOT`: ещё одна обязательная переменная без выгоды, раскладка известна коду.
- Оставить `parents[N]` в пяти местах: правки легко разойтись, что и показал этот перенос.

### D5. Python-инструменты работают в `agno/`

`pyproject.toml` лежит в `agno/`. Секция `tool.setuptools.packages.find` не меняется: пути в ней относительны каталогу файла.

Окружение — `agno/.venv`. `agno/scripts/venv_setup.sh` ставит `-e agno[dev]` с ограничениями `agno/requirements.txt`.

Корневые скрипты запускают Python-проверки из `agno/`:
- `validate.sh`: `ruff format --check`, `ruff check`, `mypy .` с `--config-file pyproject.toml`;
- `format.sh`: `ruff` по `agno/`;
- `check_auth_boundary.sh`: импорт `GROUP_SCOPES`.

Подсказка про окружение — `source agno/.venv/bin/activate`. CI ставит `agno/requirements.txt` и `-e agno[dev]`.

Альтернатива — `pyproject.toml` в корне с `package-dir`, указывающим на `agno/`. Отклонена: файлы бэкенда остались бы вне его модуля.

### D6. Где какие скрипты

- **Корень `scripts/`** — работают со всем стеком или с несколькими модулями: `dev.sh`, `validate.sh`, `format.sh` (форматирует и бэкенд, и `web/`), `auth_check.sh`, `mcp_check.sh`, `check_auth_boundary.sh`.
- **`agno/scripts/`**: `entrypoint.sh`, `venv_setup.sh`, `generate_requirements.sh`, `build_image.sh` (`-f agno/Dockerfile`, контекст — корень), `build_ca_bundle.sh` (пишет `agno/litellm/certs/ca-bundle.pem`).
- **`web/scripts/`** (каталог уже есть): `check_web_tokens.sh`.

Это отступление от интента: там `format.sh` относили к бэкенду, но он форматирует и фронтенд.

### D7. `dev.sh api` запускает API из `agno/`

Скрипт по-прежнему стартует из корня и проверяет `.env` в корне. Для команды `api` он:
- вычисляет абсолютные пути `.env` и `auth/jwks/jwks.json`;
- запускает `uv run --no-project --env-file <корень>/.env --with-requirements requirements.txt uvicorn app.main:app ... --reload-dir agents --reload-dir app --reload-dir db --reload-dir evals` с рабочим каталогом `agno/`.

`agentos-db-init` вызывается через `docker compose run`, как сейчас. Сервис найдётся во фрагменте, потому что compose читает корневой файл.

### D8. Проверка границ модуля `auth`

`check_auth_boundary.sh`:
- **Python-код:** ищет обращения к JWT, claims и Authentik в `agno/{agents,app,db,evals}` и исключает только `agno/app/auth/`, сравнивая путь, а не имя каталога. Исключение `--exclude-dir=auth` по имени после переноса совпало бы и с корневым `auth/`.
- **Blueprints:** ищет `blueprints.goauthentik.io` вне `./auth/`.
- **Сервисы:** ищет `goauthentik/server` в `compose*.yaml` вне `./auth/compose.yaml`.
- **Группы:** берёт их из `auth/blueprints/*.yaml`, `GROUP_SCOPES` импортирует из `agno/`.

Проверка не ослабевает: каждое правило проверяется на временно добавленном нарушении.

### D9. Документация и контекст-пак

- **Обновляются:** `AGENTS.md` (разделы «Where changes belong», «Local development», «Verification», «Engineers and sandboxes»), `README.md`, `web/README.md`, `agno/docs/*.md`, `.agents/skills/*/SKILL.md`, `example.env` (комментарии с путями), `.claude/launch.json` (не меняется: ссылается только на `web/` и `openspec/`).
- **Контекст-пак и OpenSpec:**
  - ADR-001: раскладка `agno/`, `web/`, `auth/`; строка статуса «изменён 2026-10-30»;
  - `00-start-here.md`, `03-architecture.md` (таблица частей, раздел модуля `auth`, «Где что лежит»), `04-engineering-standards.md` (команды);
  - `openspec/config.yaml` (строка «бэкенд … в корне»);
  - Purpose-разделы спек `overview` и `architecture` — правятся напрямую, дельты Purpose не переносят.

Архив `openspec/changes/archive/` не правится.

## Risks / Trade-offs

- **Пропущенный путь.** Ошибка не всегда падает сразу: например, неверный `--reload-dir` или ссылка в скилле. → Поиск старых путей по всему репозиторию, кроме архива; сравнение `docker compose config`, состава образа и вывода `GET /config` до и после.
- **Корень вычислен неверно.** OS Manager и инженер молча увидели бы только `agno/`. → D4: явная проверка `AGENTS.md` и сценарий спеки «OS Manager видит весь репозиторий»; проверить на хосте и в контейнере.
- **Сохранённые записи Company ссылаются на корень.** → Путь не меняется (D4); проверить, что Git Source в `GET` продукта совпадает с прежним.
- **Расхождение с шаблоном `agentos-docker`.** → Записать в `agno/docs/upgrading.md`, что файлы шаблона теперь лежат в `agno/`.
- **Старое окружение у разработчиков.** Корневой `.venv` и `agentos_docker.egg-info` перестанут подходить. → README: пересоздать окружение; `validate.sh` подсказывает новый путь.
- **Временная неработоспособность ветки.** Между `git mv` и правкой путей стек не поднимается. → Коммит делается только после всех правок и проверок.

## Migration Plan

1. **Эталоны до переноса** — в `tmp/`, удаляются после сравнения, потому что в них раскрыты секреты:
   - `docker compose config` (dev и prod);
   - список файлов образа `agentos`;
   - `GET /config` и Git Source продукта `this-agentos`.
2. **Перенос и правки** (D1–D9).
3. **Проверки:** сравнение с эталонами; `up` на существующем томе и на пустой базе (отдельный compose-проект, чтобы не стирать рабочий том); `validate.sh`, `auth_check.sh`, `mcp_check.sh`, `./scripts/dev.sh api`; поиск старых путей.
4. **Разработчикам:** удалить корневой `.venv`, выполнить `./agno/scripts/venv_setup.sh`; `docker compose up -d --build` работает как раньше.
5. **Сервер:** `git pull` и та же команда `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`; данные в том же томе.

**Откат:** `git revert` коммита change. Том и схемы БД не затрагиваются, поэтому откат кода достаточен.

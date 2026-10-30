# Tasks

## 1. Эталоны до переноса

- [x] 1.1 С текущим `.env` сохранить в `tmp/`:
  - `docker compose config`;
  - `docker compose -f compose.yaml -f compose.prod.yaml config`;
  - список файлов образа `agentos`: `docker run --rm --entrypoint find <образ> /app -maxdepth 2 -not -path '*/.git*'`;
  - при запущенном стеке — `GET /config` и Git Source продукта `this-agentos` (с токеном из `auth_check.sh`).

  Проверить, что все файлы непустые.

## 2. Модуль `auth/`

- [x] 2.1 `git mv modules/auth auth`. Удалить неотслеживаемый `modules/auth/jwks/jwks.json` и пустой `modules/`. В корневом `compose.yaml` поменять `include` на `auth/compose.yaml`. В `.dockerignore` поменять правило ключей на `auth/jwks/jwks.json*`.

  Проверить: `docker compose config` по сервисам Authentik совпадает с эталоном, кроме путей на хосте.
- [x] 2.2 Обновить ссылки на `modules/auth`:
  - комментарии `auth/compose.yaml`, `auth/jwks/export.sh`, `compose.prod.yaml`, `app/auth/authorization.py`;
  - `scripts/dev.sh` (`JWT_JWKS_FILE`, комментарии), `scripts/auth_check.sh`.

  Проверить: `grep -rn "modules/auth" --exclude-dir=archive --exclude-dir=.git .` находит только ещё не обновлённые документы (их правит 6.x) и не находит ничего в коде, скриптах и compose.

## 3. Модуль `agno/`

- [x] 3.1 Перенести в `agno/` через `git mv`:
  - `app`, `agents`, `db`, `evals`, `litellm`, `docs`, `pyproject.toml`, `requirements.txt`, `Dockerfile`;
  - в `agno/scripts/`: `entrypoint.sh`, `venv_setup.sh`, `generate_requirements.sh`, `build_image.sh`, `build_ca_bundle.sh`.

  Скрипт `scripts/check_web_tokens.sh` перенести в `web/scripts/` (D6).

  Проверить: `git status` показывает переименования (`R`), а не удаление и добавление.
- [x] 3.2 Добавить `agno/app/paths.py` с `REPO_ROOT` и проверкой `AGENTS.md` (D4). Перевести на `REPO_ROOT` `app/main.py` (корень OS Manager и путь манифеста), `app/company.py`, `app/sandbox.py`, `agents/engineers.py`, `evals/__main__.py`.

  Проверить из `agno/`:
  - `python -c 'from app.paths import REPO_ROOT; print(REPO_ROOT)'` печатает корень репозитория;
  - при временно переименованном `AGENTS.md` импорт падает с `RuntimeError`, называющей путь.
- [x] 3.3 Создать `agno/compose.yaml` (D2): перенести из корневого `compose.yaml` `agentos-db-init`, `litellm`, `agentos-api` с комментариями и путями относительно `agno/`:
  - `build.context: ..`, `dockerfile: agno/Dockerfile`;
  - bind-mount `..:/app`, `env_file: ../.env`;
  - `JWT_JWKS_FILE: /app/auth/jwks/jwks.json`;
  - каталоги reload `/app/agno/...`.

  В корневом `compose.yaml` оставить `include` двух фрагментов, `agentos-db`, сеть и том; поправить комментарии в `compose.prod.yaml`.

  Проверить: оба `docker compose config` совпадают с эталонами из 1.1, кроме допустимых в спеке `runtime` отличий; имя проекта `authorled`, том `authorled_pgdata`.
- [x] 3.4 Обновить `agno/Dockerfile` (D3): `COPY agno/requirements.txt`, `WORKDIR /app/agno`, `PYTHONPATH=/app/agno`, entrypoint `/app/agno/scripts/entrypoint.sh`.

  Проверить:
  - `docker compose build agentos-api`; список файлов образа совпадает с эталоном с поправкой на `agno/`; есть `/app/AGENTS.md`, `/app/.agents/skills`, `/app/openspec`; нет `/app/web`, `/app/.env`;
  - `docker build --target sandbox --load -t agno-sandbox:local -f agno/Dockerfile .` собирается.
- [x] 3.5 Обновить скрипты бэкенда:
  - `agno/scripts/venv_setup.sh`: `agno/.venv`, `-e agno[dev]`;
  - `generate_requirements.sh`: пути `agno/`;
  - `build_image.sh`: `-f agno/Dockerfile`, контекст — корень;
  - `build_ca_bundle.sh`: `agno/litellm/certs`.

  Проверить:
  - `./agno/scripts/venv_setup.sh` создаёт `agno/.venv`;
  - `./agno/scripts/generate_requirements.sh` не меняет `agno/requirements.txt` (`git diff --exit-code`);
  - `IMAGE_NAME=agentos ./agno/scripts/build_image.sh` завершается кодом 1 до сборки.
- [x] 3.6 Обновить корневые скрипты (D5–D8):
  - `validate.sh`: Python-проверки из `agno/`, `web/scripts/check_web_tokens.sh`, подсказка `source agno/.venv/bin/activate`;
  - `format.sh`: `ruff` по `agno/`;
  - `check_auth_boundary.sh`: пути из D8, исключение `agno/app/auth/` по пути;
  - `dev.sh`: `api` из `agno/` с абсолютными `.env` и `JWT_JWKS_FILE`;
  - `mcp_check.sh` и `auth_check.sh`: проверить и поправить пути, если есть;
  - `web/scripts/check_web_tokens.sh`: корень репозитория на два уровня выше.

  Проверить:
  - `./scripts/validate.sh` проходит;
  - `check_auth_boundary.sh` падает на каждом временном нарушении: чтение `jwt` в `agno/app/main.py`, blueprint вне `auth/`, образ Authentik в `agno/compose.yaml`, лишняя группа в `GROUP_SCOPES`;
  - `check_web_tokens.sh` падает на временном сыром цвете в `web/src`.
- [x] 3.7 Обновить CI `.github/workflows/validate.yml`: `cache-dependency-glob: agno/requirements.txt`, установка `agno/requirements.txt` и `-e 'agno[dev]'`.

  Проверить: `act` не используется; шаги CI повторить локально в чистом venv теми же командами, затем `./scripts/validate.sh` проходит.

## 4. Стек целиком

- [x] 4.1 На существующем томе: `docker compose up -d --build --wait`.

  Проверить:
  - `./scripts/auth_check.sh` и `./scripts/mcp_check.sh` проходят;
  - `GET /config` совпадает с эталоном;
  - Git Source продукта `this-agentos` тот же;
  - сохранённые записи Company доступны;
  - в контейнере `python -c 'from app.paths import REPO_ROOT; print(REPO_ROOT)'` печатает `/app`.
- [x] 4.2 На пустой базе: отдельный проект `docker compose -p authorled-verify ...` с другими портами или на остановленном основном стеке, как в прошлом change; рабочий том не трогать.

  Проверить: стек поднимается, `auth_check.sh` проходит. Затем удалить проект и его том.
- [x] 4.3 `./scripts/dev.sh api` при остановленном `agentos-api`.

  Проверить:
  - API на хосте отвечает `GET /health`;
  - правка файла в `agno/app/` перезапускает сервер;
  - `MCP_CHECK_HOST=1 ./scripts/mcp_check.sh` проходит.

## 5. Спеки и контекст-пак

- [x] 5.1 Обновить контекст-пак и конфиг OpenSpec:
  - ADR-001: раскладка `agno/`, `web/`, `auth/`, строка статуса;
  - `00-start-here.md`, `03-architecture.md` (таблица частей, модуль `auth`, «Где что лежит»), `04-engineering-standards.md` (команды);
  - `openspec/config.yaml`;
  - Purpose спек `overview` и `architecture` — напрямую в `openspec/specs/`;
  - `openspec/TODO.md`: строка change.

  Проверить: `grep -rn "в корне\|modules/auth" openspec/context openspec/config.yaml openspec/specs` не находит устаревших утверждений.

## 6. Документация

- [x] 6.1 Обновить пути и команды:
  - `AGENTS.md` (CLAUDE.md — симлинк), `README.md`, `web/README.md`;
  - `agno/docs/sandboxes.md`, `agno/docs/upgrading.md` (заметка: файлы шаблона `agentos-docker` теперь в `agno/`);
  - `.agents/skills/*/SKILL.md`, комментарии в `example.env`.

  В README и `setup-platform` описать переход для разработчиков: пересоздать окружение `./agno/scripts/venv_setup.sh`, удалить корневой `.venv`.

  Проверить: поиск старых путей (`modules/auth`, `scripts/venv_setup`, `scripts/build_image`, `scripts/generate_requirements`, `scripts/build_ca_bundle`, `scripts/entrypoint`, `scripts/check_web_tokens`, `source .venv`, `litellm/config.yaml` без `agno/`, ` -t agno-sandbox:local .` без `-f`) вне `openspec/changes/archive/` и `agno/` ничего не находит.

## 7. Итоговые проверки

- [x] 7.1 `./scripts/validate.sh` и `git diff --check` проходят.

  Проверить:
  - `git ls-tree -d --name-only HEAD` после коммита (или `git ls-files | cut -d/ -f1 | sort -u` до него) соответствует сценарию «Состав верхнего уровня»;
  - `git log --follow agno/app/main.py` показывает историю до переноса.

  Удалить эталоны из `tmp/`. Записать результаты в `tmp/VERIFY.md` раздельно: static, deterministic, container.
- [x] 7.2 `openspec validate restructure-monorepo-modules --strict` проходит.

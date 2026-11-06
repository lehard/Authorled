# Design

## Context

Мотивация в `proposal.md`, требования в `specs/runtime/spec.md`.

Что есть сейчас:

- `compose.yaml` с `compose.prod.yaml` поднимают весь стек. Порты контейнеров на loopback. Миграции применяет `agentos-migrate` перед API.
- `web/` не входит в compose и `.dockerignore` исключает его из образа. Настройки `AUTH_*` попадают во фронтенд при сборке (`web/vite.config.ts`), `VITE_DATA_SOURCE` тоже. Быстрые кнопки входа есть только в режиме разработки.
- Фронтенд ходит к API через `/os/`, а к Authentik через три пути на своём домене. В разработке это делает прокси Vite, для продакшена настройки нет.
- `validate.yml` запускает `./scripts/validate.sh` на каждый пуш.
- База одна, `ai`, суперпользователь тоже `ai`. Схемы `ai`, `authorled` и `authentik` лежат в ней, поэтому одна копия покрывает всё.
- Сервер уже подготовлен: файрвол, вход только по ключу, Docker, Caddy, git, файл настроек `/etc/authorled/authorled.env`.
- Репозиторий публичный.

## Goals / Non-Goals

**Goals:**

- Один путь выкладки для первого релиза, обновления и отката.
- Сбой любого шага виден красным запуском и не оставляет запасных путей.
- На сервере нет Node и нет секретов GitHub.

**Non-Goals:**

- Переход на образы в реестре.
- Управление сервером как кодом: разовая подготовка описана в README.

## Decisions

**Workflow `.github/workflows/deploy.yml`.** Триггеры: `release: published` и `workflow_dispatch` с обязательным `tag`. `concurrency` с группой `production` и `cancel-in-progress: false`. Три шага-задачи:

1. `resolve`: определяет тег и проверяет `git merge-base --is-ancestor <tag> origin/main`.
2. `validate`: вызывает `validate.yml` через `workflow_call` с входом `ref`. Альтернатива, копия шагов проверки, разошлась бы с CI.
3. `deploy`: в GitHub Environment `production`, собирает фронтенд, отправляет его и запускает шаги на сервере, затем проверяет публичные адреса.

Сторонние actions не добавляются: SSH и rsync вызываются напрямую. Это меньше доверия чужому коду в задаче с ключом от сервера.

**Настройки GitHub.** Environment `production` разрешён только для тегов `v*` и ветки `main`. Секреты: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`. Переменные сборки: `AUTH_ISSUER`, `AUTH_FRONTEND_CLIENT_ID`, `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI`, `VITE_DATA_SOURCE`, `PUBLIC_URL`. Первый шаг задачи `deploy` падает с именем настройки, если её нет. `StrictHostKeyChecking=yes` с `DEPLOY_KNOWN_HOSTS`.

**Сборка фронтенда в Actions.** Альтернатива, Node на сервере, добавила бы рантайм и нагрузку на сервер. После сборки шаг проверяет, что в `web/dist` нет текстов быстрых кнопок и что `VITE_DATA_SOURCE=api`.

**Скрипт `deploy/deploy.sh <tag>`.** Запускается как `ssh deploy@host bash -s -- "$TAG" < deploy/deploy.sh`, поэтому всегда той версии, что выкладывается. Работает с `set -euo pipefail`. Порядок:

1. Проверяет каталоги, `.env` и загруженный фронтенд `/srv/authorled/web/incoming/<tag>`.
2. Копия базы, если том `authorled_pgdata` существует.
3. `git fetch --tags --force` и `git checkout --detach <tag>` в `/srv/authorled/app`.
4. `docker compose -p authorled -f compose.yaml -f compose.prod.yaml up -d --build`.
5. Переносит фронтенд в `/srv/authorled/web/<tag>` и переключает симлинк `current`. Старые каталоги удаляются.
6. `caddy validate` и `sudo systemctl reload caddy`.
7. Чистит кэш сборки старше недели и неиспользуемые образы.

Каталог проекта зафиксирован именем `-p authorled`, чтобы том и контейнеры не зависели от имени папки.

**Копия базы.** `docker compose exec -T agentos-db pg_dump -U ai -d ai -Fc` в файл `.part`, затем проверка `pg_restore --list` и переименование в `/srv/authorled/backups/<время>-<тег>.dump`. Если база не запущена, сначала поднимается только `agentos-db`. Каталог закрыт для других пользователей. Лишние копии старше десятой удаляются после успешной копии.

**Caddy.** `deploy/Caddyfile` хранится в репозитории, `/etc/caddy/Caddyfile` только импортирует его. Домен продукта: `handle_path /os/*` на `127.0.0.1:8000`, три пути на `127.0.0.1:9000`, остальное `file_server` с `try_files {path} /index.html`. Домены публичны, поэтому их можно коммитить. Альтернатива, контейнер с nginx в compose, потребовала бы менять `.dockerignore` и добавила бы сервис.

**Настройки на сервере.** `/srv/authorled/app/.env` является симлинком на `/etc/authorled/authorled.env`, владелец `root`, группа `deploy`, права `640`. Git его не видит.

**Пользователь `deploy`.** Группа `docker`, отдельный ключ только для GitHub, sudo только на `systemctl reload caddy`. Без группы `docker` пришлось бы давать sudo на compose, что не лучше.

**Доверенный прокси.** `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS` передаётся в `authentik-server` и `authentik-worker` из `compose.prod.yaml` как обязательная. Значение `172.16.0.0/12`: Caddy идёт через опубликованный порт, и Authentik видит адрес шлюза сети Docker.

**Проверка после деплоя.** Из Actions: запросы к `$PUBLIC_URL/os/health` раз в 10 секунд до 10 минут, потому что ClamAV на первом старте качает базу. Затем `$PUBLIC_URL/os/agents` без токена должен дать `401`. Ожидание с пределом здесь не запасной путь: по истечении запуск падает.

**Чистые данные.** Скрипт не вызывает `dev.sh`. В настройках сервера нет `AUTH_DEV_USER_PASSWORD`. Демо-контент и так запускается только командой.

## Risks / Trade-offs

- [Ключ `deploy` почти равен root] → отдельный ключ, только секрет Environment, ограничение на теги и `main`, публикует релизы только владелец.
- [Сайт недоступен во время пересборки] → принято на время тестирования.
- [Сервер упал посередине: новый код, старый фронтенд] → запуск красный, повторный запуск того же тега доводит версию.
- [Копия на том же диске] → принято; копии вне сервера вне scope.
- [`AGENTOS_URL` с путём `/os` может не подойти входу MCP для внешних приложений] → проверяется на первом деплое. Продукт от этого не зависит, вход идёт через Authentik.
- [SSH-порт открыт миру] → вход только по ключу.

## Migration Plan

1. Реализовать change и влить в `main` вместе с остальным кодом.
2. Разово подготовить сервер и GitHub Environment по README.
3. Дополнить настройки сервера: SMTP, белый список (другой change), доверенный прокси.
4. Опубликовать первый релиз. Копии нет, потому что нет тома.
5. Откат: ручной запуск с прошлым тегом. При новых миграциях владелец восстанавливает базу из копии по README.

## Open Questions

- Подходит ли `AGENTOS_URL` с путём для MCP. Ответ появится на первом деплое и не меняет задачи: при отказе нужен отдельный поддомен.

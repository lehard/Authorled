# Proposal

## Why

Продукт называется «Соавтор», а репозиторий `lehard/Authorled` и рабочая папка `/Users/Shared/Workspace/Authorled` — по старому имени. Владелец решил 2026-11-10 переименовать их в `coauthor`, оставив внутренние технические имена `authorled`. Бизнес-интент: `business-intents/rename-repo-coauthor.md`.

## What Changes

- Ручные команды Docker Compose в документах называют проект явно: `docker compose -p authorled …`. Без этого после переименования папки ручной `docker compose` в основной папке ушёл бы в проект `coauthor` (имя берётся из папки), а на сервере, где клон лежит в `/srv/authorled/app`, — в проект `app`. `scripts/dev.sh` и `deploy/deploy.sh` уже передают `-p authorled`; подсказка в `dev.sh` про остановку `agentos-api` тоже называет проект.
- `compose.yaml` не меняется: `name:` не добавляется (решение владельца 2026-11-08, `dev-sh-compose-errors`, подтверждено 2026-11-10).
- Адрес клона в README: `https://github.com/lehard/coauthor.git`.
- В `business-intents/rename-soavtor.md` (п. 7) пометка, что репозиторий переименован этим интентом.
- Операции после влития в `main`, по шагам `tasks.md` и с подтверждением владельца: переименование репозитория на GitHub, `origin` на Mac и на сервере, переименование папки, `git worktree repair`, ссылки `.env` в worktree, пересборка `agno/.venv`, перенос памяти Claude Code и правка глобального `~/.claude/CLAUDE.md`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет. Поведение системы не меняется: спека `runtime` уже требует проект Compose `authorled` и для `scripts/dev.sh`, и для имён томов. Change помечен `skip_specs: true`.

## Scope

- `AGENTS.md` (на него ссылается `CLAUDE.md`), `README.md`, `openspec/context/04-engineering-standards.md`: `-p authorled` в ручных командах compose, адрес клона.
- `scripts/dev.sh`: только текст подсказки `docker compose -p authorled stop agentos-api`.
- `business-intents/rename-soavtor.md`: пометка.
- Переименование репозитория и папки и всё, что от них зависит (см. What Changes), с записью проверок в `tmp/VERIFY.md`.

## Non-goals

- `name:` в `compose.yaml`, `COMPOSE_PROJECT_NAME` в `.env`.
- Технические имена `authorled`: схема БД, `/srv/authorled`, `/etc/authorled`, проект Compose, SSH-алиасы, клиент и slug Authentik, ключи браузера, тестовые адреса.
- Массовая замена слова `authorled` в коде и документах.
- Исторические материалы: архив changes, `openspec/context/_raw/`, закрытые интенты (кроме пометки в `rename-soavtor`); ссылки `lehard/Authorled#NN` GitHub перенаправляет.
- Перенос старых сессий Claude Code на новый путь.
- Релиз: этому изменению он не нужен (код сервера не меняется).

## Impact

- Документы и одна строка подсказки в `scripts/dev.sh`; код приложения, compose-файлы и deploy-скрипты не меняются.
- GitHub: новое имя репозитория; Actions, окружение `production`, релизы и PR переезжают вместе с ним, старый адрес перенаправляется.
- Сервер: только `git remote set-url` в `/srv/authorled/app`, с подтверждением владельца.
- Mac: новая папка `/Users/Shared/Workspace/coauthor`; стенд на время переименования останавливается (`./scripts/dev.sh stop`, с подтверждением владельца), открытые сессии в старой папке перестают работать.

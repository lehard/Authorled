# Design

## Context

Почему — в `proposal.md`. Что важно для решения:

- В `compose.yaml` нет `name:`, у сервисов фиксированный `container_name`. `scripts/dev.sh` вызывает compose только через `docker compose -p authorled` (`STAND_PROJECT`), `deploy/deploy.sh` — через `docker compose -p authorled -f compose.yaml -f compose.prod.yaml`. Тома стенда: `authorled_pgdata`, `authorled_clamav-db`.
- Ручные команды без `-p` в документах: `AGENTS.md` («Local development», `docker compose up -d --build`), `README.md` (локальный запуск, логи `agentos-migrate`, `stop agentos-api`, `up -d` после правки `.env`, `run --rm authentik-jwks-export`, раздел «Deploy in production»: `up`, `logs`, `down`), `openspec/context/04-engineering-standards.md`, подсказка `docker compose stop agentos-api` в `scripts/dev.sh`. На сервере клон лежит в `/srv/authorled/app`, так что ручные команды из README там уже сейчас попадают в проект `app`, а не в `authorled`.
- Хуки в `.claude/settings.json` идут через `$CLAUDE_PROJECT_DIR`, `dev.sh` находит основную папку через `git rev-parse --git-common-dir`: абсолютных путей к папке в коде нет. Абсолютные пути есть в файлах `.git` worktree, в ссылках `.env` worktree и в `agno/.venv`.
- Claude Code хранит память по пути папки: `~/.claude/projects/-Users-Shared-Workspace-Authorled/memory/`. Новой папке соответствует `~/.claude/projects/-Users-Shared-Workspace-coauthor/`.
- Эта сессия сама работает в worktree под старой папкой: после её переименования сессия теряет рабочий каталог.

## Goals / Non-Goals

**Goals:**
- После переименования стенд, сервер и релизы работают с теми же данными без правки compose-файлов.
- Ручные команды из документов попадают в проект `authorled` из любой папки.

**Non-Goals:**
- Автоматизировать переименование папки скриптом: это разовая операция владельца.

## Decisions

### 1. Явный `-p authorled` в документах, без `name:` в `compose.yaml`

Каждая ручная команда compose в документах и подсказках пишется как `docker compose -p authorled …` (на сервере — `docker compose -p authorled -f compose.yaml -f compose.prod.yaml …`, как в `deploy.sh`). Запрет из AGENTS.md запускать `docker compose up` для стенда из worktree остаётся.

Отклонено: `name: authorled` в `compose.yaml` и `COMPOSE_PROJECT_NAME` в `.env` (у worktree это ссылка на тот же `.env`) — ручной `up` из worktree молча пересоздавал бы общий стенд с путями ветки (решение владельца 2026-11-08, подтверждено 2026-11-10).

### 2. Порядок: документы → GitHub → подготовка Mac → папка

1. PR с документами вливается в `main`, основная папка делает `git pull`.
2. Репозиторий на GitHub переименовывается (`gh repo rename coauthor`), `origin` меняется в основной папке (worktree делят её `.git/config`) и на сервере (`git remote set-url`, без `git pull`).
3. Память Claude Code копируется в каталог нового пути заранее, глобальный `~/.claude/CLAUDE.md` правится заранее: новая сессия в новой папке сразу видит память.
4. Владелец закрывает сессии, останавливает стенд и переименовывает папку сам (Workflow follow-up в `tasks.md`), потому что сессии, которые работают в старой папке, при этом ломаются.

Отклонено: переименовать папку из этой сессии — она работает в worktree под старой папкой и потеряет рабочий каталог посреди шага.

### 3. Старая память копируется, а не переносится

Каталог памяти копируется (`cp -R`), старый остаётся до проверки, что новая сессия видит память. Удаляет его владелец.

## Risks / Trade-offs

- [Ручной `docker compose` без `-p authorled` в новой папке уходит в проект `coauthor`] → документы называют проект; при работающем стенде команда падает на занятых `container_name`, при удалённых контейнерах заводит пустые тома `coauthor_*`, старые не теряются.
- [Открытые сессии и процессы в старой папке ломаются] → папку переименовывает владелец, когда сессии закрыты и стенд остановлен.
- [GitHub-ссылки и интеграции на старый адрес] → GitHub перенаправляет; `origin` меняется явно, проверка `gh repo view` и `git ls-remote`.
- [Worktree не находят репозиторий] → `git worktree repair` из новой папки; проверка `git worktree list` без `prunable`.

## Migration Plan

Шаги — в `tasks.md`. Откат: `gh repo rename Authorled`, `git remote set-url` обратно, `mv` папки обратно и `git worktree repair`. Данные стенда и сервера при этом не затрагиваются.

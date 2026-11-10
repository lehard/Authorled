# Бизнес-интент: репозиторий и рабочая папка называются coauthor

Статус: решение согласовано с владельцем 2026-11-10 (переименовать репозиторий GitHub и папку на диске в `coauthor`, внутренние технические имена `authorled` оставить); change `rename-repo-coauthor` реализован и архивирован 2026-11-10 (`openspec/changes/archive/2026-11-10-rename-repo-coauthor/`): документы с `-p authorled`, репозиторий переименован в `lehard/coauthor`, `origin` на Mac и сервере, память Claude Code скопирована, глобальный `CLAUDE.md` поправлен. Переименование папки — за владельцем (Workflow follow-up в `tasks.md`). Владелец: lehard. Обновлено: 2026-11-10.
Рамки: интенты `dev-sh-compose-errors` и `worktree-dev-sh` (решение не добавлять `name:` в `compose.yaml` остаётся), `rename-soavtor` (п. 7 «Технические имена не меняются» — для репозитория заменяется этим), `main-only-session-flow` (основная папка и worktree), `deploy-on-release`; `compose.yaml`, README («Deploy in production»).

## Why

Продукт называется «Соавтор» (`rename-soavtor`), а репозиторий `lehard/Authorled` и папка `/Users/Shared/Workspace/Authorled` — по старому имени. Владелец хочет, чтобы они назывались `coauthor`. Внутренние имена (`authorled` в схеме БД, путях сервера, Authentik) люди не видят, а их смена разлогинила бы всех и сломала бы миграции, поэтому они остаются.

## What Changes

1. **Имя проекта Compose остаётся `authorled` без правки `compose.yaml`.** В `compose.yaml` нет `name:`, и ручной `docker compose` берёт имя проекта из имени папки; `name:` не добавляется (решение владельца 2026-11-08, `dev-sh-compose-errors`, подтверждено 2026-11-10): иначе ручной `up` из worktree молча пересоздавал бы общий стенд. `scripts/dev.sh` уже вызывает `docker compose -p authorled`, `deploy/deploy.sh` — тоже, поэтому после переименования папки стенд и сервер видят те же тома (`authorled_pgdata`, `authorled_clamav-db`). Ручные команды в документах называют проект явно: `docker compose -p authorled …` (локально в AGENTS.md, README, `openspec/context/04-engineering-standards.md`, подсказка в `scripts/dev.sh`; на сервере в README, где папка клона `app` и без `-p` получился бы проект `app`). Эта правка выходит в `main` до переименования папки.
2. **Репозиторий GitHub** `lehard/Authorled` переименовывается в `lehard/coauthor` (делает владелец или агент с его подтверждением). GitHub перенаправляет со старого адреса, но ссылки обновляются явно:
   - `origin` в основной папке на Mac;
   - `origin` клона на сервере `/srv/authorled/app` (с подтверждением владельца, только `git remote set-url`, без `git pull`);
   - адрес клона в README (`git clone https://github.com/lehard/coauthor.git /srv/authorled/app`).
   Переменные и секреты окружения `production`, Actions и релизы переезжают вместе с репозиторием; проверить после переименования.
3. **Папка на диске** `/Users/Shared/Workspace/Authorled` переименовывается в `/Users/Shared/Workspace/coauthor`, когда стенд остановлен и других сессий нет. После этого:
   - `git worktree repair` из новой папки, чтобы worktree в `.claude/worktrees/` нашли основной репозиторий;
   - ссылки `.env` в worktree пересоздаются на новый путь (`ln -sf /Users/Shared/Workspace/coauthor/.env .env`);
   - `agno/.venv` пересобирается (`./agno/scripts/venv_setup.sh`): в нём абсолютные пути;
   - стенд поднимается `./scripts/dev.sh up`; проверяется, что данные и пользователи на месте.
4. **Окружение Claude Code на Mac** (вне репозитория, делает владелец или агент с его подтверждением):
   - память проекта переносится из `~/.claude/projects/-Users-Shared-Workspace-Authorled/memory/` в каталог нового пути;
   - глобальный `~/.claude/CLAUDE.md` называет репозиторий `/Users/Shared/Workspace/coauthor` и `lehard/coauthor`.
5. **Документы.** В `rename-soavtor` (п. 7) дописывается, что репозиторий переименован этим интентом. Исторические записи (`lehard/Authorled#NN` в закрытых интентах и архиве changes) не правятся: GitHub перенаправляет эти ссылки.

## Scope

- Явный `-p authorled` в ручных командах compose: AGENTS.md, README, `openspec/context/04-engineering-standards.md`, подсказка в `scripts/dev.sh`; README (адрес клона), пометка в `business-intents/rename-soavtor.md`. `compose.yaml` не меняется.
- Переименование репозитория на GitHub, `origin` на Mac и на сервере.
- Переименование папки, `git worktree repair`, ссылки `.env`, `agno/.venv`.
- Память Claude Code и глобальный `CLAUDE.md`.
- Проверка, запись в `tmp/VERIFY.md`.

## Non-goals

- Технические имена `authorled`: схема БД, `/srv/authorled`, `/etc/authorled`, compose-проект, SSH-алиасы `authorled`, клиент и slug Authentik, ключи браузера, тестовые адреса (`rename-soavtor`, п. 7).
- Массовая замена слова `authorled` в коде и документах (около 1300 вхождений).
- Исторические материалы: архив changes, `_raw/`, закрытые интенты (кроме пометки в `rename-soavtor`).
- Старые сессии Claude Code: они останутся привязаны к старому пути.

## Constraints (из контекст-пака)

- Код выкатывается только релизом из `main`; на сервере вручную `git pull` не делается; любое изменение на сервере — с подтверждением владельца.
- `docker compose down`, рестарты контейнеров и остановка стенда — только с подтверждением владельца (`AGENTS.md`, «Parallel sessions»).
- Основная папка только для чтения и `git pull`; правка `compose.yaml` идёт через worktree и PR.

## Acceptance criteria

- После переименования папки `docker compose ls` показывает проект `authorled`, `docker volume ls` — те же `authorled_pgdata` и `authorled_clamav-db`, новых томов `coauthor_*` нет; демо-истории и пользователи на месте.
- `git worktree list` из новой папки показывает все worktree без пометки `prunable`.
- `git remote -v` на Mac и на сервере показывает `https://github.com/lehard/coauthor.git`.
- Следующий релиз из `main` разворачивается на сервере как раньше, `deploy/check_site.sh` проходит.
- `./scripts/validate.sh` проходит из новой папки.
- Новая сессия Claude Code в новой папке видит память проекта.

## Risks

- **Ручной `docker compose up` без `-p authorled`** в новой папке уходит в проект `coauthor`: при работающем стенде падает на занятых `container_name`, при удалённых контейнерах заводит пустые тома `coauthor_*` (старые не теряются). Поэтому документы называют проект явно, а стенд запускается `./scripts/dev.sh up`.
- **Открытые сессии и процессы** (API на хосте, `npm run dev`, редакторы) в старой папке сломаются. Переименовывать, когда всё остановлено.
- **Ссылки в других местах** (закладки, скрипты владельца, настройки приложения Claude) на старый путь. Найти по ходу; GitHub-ссылки перенаправляются.

## Open Questions

- Регистр имени: принято по умолчанию `coauthor` строчными и для папки, и для репозитория.

## References

- `business-intents/rename-soavtor.md` — имя продукта и список технических имён.
- `business-intents/main-only-session-flow.md` — основная папка и worktree.
- `scripts/dev.sh` (`STAND_PROJECT=authorled`), `deploy/deploy.sh` (`COMPOSE=(docker compose -p authorled …)`).
- `business-intents/dev-sh-compose-errors.md`, `business-intents/worktree-dev-sh.md` — решение без `name:` в `compose.yaml`.

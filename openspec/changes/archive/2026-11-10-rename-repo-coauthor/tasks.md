# Tasks

## 1. Документы и подсказка

- [x] 1.1 Дописать `-p authorled` во все ручные команды Docker Compose для локального стенда: `AGENTS.md` («Local development»), `README.md` (локальный запуск, `logs agentos-migrate`, `stop agentos-api`, `up -d` после правки `.env`, `run --rm authentik-jwks-export`), `openspec/context/04-engineering-standards.md`, подсказка `stop agentos-api` в `scripts/dev.sh`. Проверка: `grep -rn "docker compose " AGENTS.md README.md openspec/context/04-engineering-standards.md scripts/dev.sh | grep -v -- "-p "` находит только строки, где проект указывать не нужно (описания, не команды).
- [x] 1.2 В разделе README «Deploy in production» писать команды как `docker compose -p authorled -f compose.yaml -f compose.prod.yaml …`, как в `deploy/deploy.sh`. Проверка: тот же `grep` по README.
- [x] 1.3 Адрес клона в README заменить на `https://github.com/lehard/coauthor.git`; в `business-intents/rename-soavtor.md` (п. 7) дописать, что репозиторий переименован интентом `rename-repo-coauthor`. Проверка: `grep -rn "lehard/Authorled" README.md AGENTS.md` пусто.
- [x] 1.4 `./scripts/validate.sh` (через `env -u BASH_ENV`) и `git diff --check` проходят.

## 2. GitHub и `origin`

- [x] 2.1 С подтверждением владельца в чате переименовать репозиторий: `gh repo rename coauthor --repo lehard/Authorled`. Проверка: `gh repo view lehard/coauthor --json name,defaultBranchRef` и `gh api repos/lehard/coauthor/environments/production/variables` показывают ветку `main` и прежние переменные.
- [x] 2.2 В основной папке `git remote set-url origin https://github.com/lehard/coauthor.git` (worktree делят этот `origin`). Проверка: `git remote -v` и `git ls-remote origin main` из основной папки и из этого worktree.
- [x] 2.3 С подтверждением владельца на сервере: `ssh authorled-deploy 'git -C /srv/authorled/app remote set-url origin https://github.com/lehard/coauthor.git'`, без `git pull`. Проверка: `git -C /srv/authorled/app remote -v` и `git -C /srv/authorled/app ls-remote origin main` на сервере.

## 3. Подготовка Mac

- [x] 3.1 С подтверждением владельца скопировать память: `cp -R ~/.claude/projects/-Users-Shared-Workspace-Authorled/memory ~/.claude/projects/-Users-Shared-Workspace-coauthor/memory`, старый каталог оставить. Проверка: `diff -r` двух каталогов пуст.
- [x] 3.2 С подтверждением владельца в `~/.claude/CLAUDE.md` заменить путь репозитория на `/Users/Shared/Workspace/coauthor` и GitHub на `lehard/coauthor` (имена `authorled` сервера не трогать). Проверка: `grep -n "Workspace/Authorled\|lehard/Authorled" ~/.claude/CLAUDE.md` пусто.
- [x] 3.3 Записать в `tmp/VERIFY.md` результаты групп 1–3 и шаги Workflow follow-up для владельца.

## Workflow follow-up

Делает владелец после влития PR в `main`, когда все сессии в старой папке закрыты (они при этом ломаются):

- В основной папке: `git pull`, затем `./scripts/dev.sh stop`; остановить API на хосте и `npm run dev`, если запущены.
- `mv /Users/Shared/Workspace/Authorled /Users/Shared/Workspace/coauthor`.
- В новой папке: `git worktree repair`; проверить `git worktree list` (нет `prunable`).
- В каждом нужном worktree: `ln -sf /Users/Shared/Workspace/coauthor/.env .env`.
- `./agno/scripts/venv_setup.sh`.
- `./scripts/dev.sh up`; проверить `docker compose ls` (проект `authorled`), `docker volume ls` (нет `coauthor_*`), демо-истории и вход.
- Открыть новую сессию Claude Code в `/Users/Shared/Workspace/coauthor` и проверить, что память на месте; после этого старый каталог памяти можно удалить.

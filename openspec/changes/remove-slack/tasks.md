# Tasks

## 1. Код и зависимости

- [x] 1.1 Удалить из `app/interfaces.py` ветку Slack (чтение `SLACK_*`, импорт и добавление `Slack`) и обновить docstring модуля и `attach_interfaces`; проверить `grep -n -i slack app/interfaces.py` (пусто), `./scripts/validate.sh` проходит
- [x] 1.2 Убрать extra `slack` из `agno[...]` в `pyproject.toml` и выполнить `./scripts/generate_requirements.sh` (без `upgrade`); проверить `git diff requirements.txt` относительно состояния до задачи: удалены только `slack-sdk` (и пакеты, у которых «via» был только Slack-extra), версии остальных пакетов не изменились, `grep -i slack requirements.txt` пусто
- [x] 1.3 Пересобрать обе цели Dockerfile (`docker compose build`, `docker build --target sandbox --load -t agno-sandbox:local .`); проверить, что сборки завершаются без ошибок

## 2. Документация

- [x] 2.1 Убрать Slack из `example.env` (блок переменных), `README.md` (вводный абзац, список «ways to use your agents» — два пункта вместо трёх, строка таблицы настроек), `AGENTS.md` (строка про `app/interfaces.py`) и `.agents/skills/setup-platform/SKILL.md` (перечень клиентов OS Manager); проверить `grep -rniI slack README.md AGENTS.md example.env .agents` (пусто) и что нумерация списка в README согласована
- [x] 2.2 Обновить `openspec/context/03-architecture.md` (строка про `app/interfaces.py`) и перевести пункт про Slack в `openspec/TODO.md` в «Снято» со ссылкой на change `remove-slack`; проверить `grep -n -i slack openspec/context/*.md openspec/TODO.md` — остаётся только пометка «Снято»

## 3. Спеки

- [x] 3.1 Проверить дельты: `openspec validate remove-slack --strict` проходит
- [x] 3.2 Убедиться, что `switch-models-to-deepseek-litellm` завершён и архивируется раньше; проверить `openspec list`: порядок архивации учтён перед `/opsx:archive` этого change
- [x] 3.3 Убрать узел `Slack` и связь `-->|events| API` из диаграммы в `Purpose` мастер-спеки `openspec/specs/architecture/spec.md`; проверить `grep -n -i slack openspec/specs/architecture/spec.md` (пусто) и что диаграмма остаётся корректной mermaid-схемой

## 4. Интеграционная проверка

- [x] 4.1 Запустить стек (`docker compose up -d --build`) и проверить: `GET /config` даёт `interfaces: []`, `GET /info` — прежние счётчики, `./scripts/mcp_check.sh` проходит
- [x] 4.2 Запустить API с фиктивными `SLACK_BOT_TOKEN=x` и `SLACK_SIGNING_SECRET=y` в окружении процесса (не в `.env`): старт без ошибок, `GET /config` по-прежнему `interfaces: []`
- [x] 4.3 Выполнить `grep -rniI slack . --exclude-dir=.git --exclude-dir=.venv --exclude-dir=tmp --exclude-dir=archive`: остаются только пометка «Снято» в `openspec/TODO.md`, REMOVED-требование и Migration в дельтах этого change, non-goal в `switch-models-to-deepseek-litellm/proposal.md`; `git diff --check` чисто
- [x] 4.4 Записать результаты (static, deterministic, container; что не проверялось — реальная работа Slack) в `tmp/VERIFY.md` и выполнить `/opsx:verify`

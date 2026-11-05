# Tasks

## 1. Базовая линия

- [x] 1.1 До изменений прогнать `python -m evals --tag coauthor` (с активным `agno/.venv`, запущенными PostgreSQL и LiteLLM) и записать результат и ответ в `tmp/VERIFY.md` как базу для сравнения

## 2. Навык и загрузка промпта

- [x] 2.1 Создать `agno/skills/coauthor/SKILL.md`: заголовок `name: coauthor` и `description` (по смыслу описания из манифеста `config.yaml`), тело — текст `INSTRUCTIONS` из `agno/agents/coauthor.py` без изменений; проверить, что тело совпадает с константой посимвольно (без учёта завершающего перевода строки)
- [x] 2.2 Добавить в `agno/agents/` общую функцию загрузки промпта агента (design, решение 2): `LocalSkills(REPO_ROOT / "agno" / "skills" / agent_id, validate=True).load()`, ровно один навык с `name == agent_id` и непустым телом, иначе ошибка с путём и причиной; без своего разбора YAML и без запасного промпта
- [x] 2.3 `agno/agents/coauthor.py`: удалить `INSTRUCTIONS`, передавать в `instructions` результат загрузки для `coauthor`; обновить docstring модуля (промпт — `agno/skills/coauthor/SKILL.md`); проверить, что `python -c "import agents.coauthor"` из `agno/` проходит и `coauthor.instructions` равен телу `SKILL.md`, а `coauthor.tools` пуст

## 3. Документация

- [x] 3.1 `.agents/skills/create-agent/SKILL.md`: промпт нового агента пишется в `agno/skills/<agent_id>/SKILL.md` (заголовок `name`/`description`, тело — промпт) и загружается общей функцией; пример с константой `INSTRUCTIONS` заменить; правка `SKILL.md` требует перезапуска API; проверить, что в скилле не осталось указаний писать промпт строкой в коде
- [x] 3.2 `AGENTS.md` («Where changes belong», «Agents and storage»): папка `agno/skills/`, промпт агента — его `SKILL.md`; исправить «descriptions/prompts in `agno/app/config.yaml`» — в манифесте описания и быстрые подсказки, промпт в `SKILL.md`; проверить `git diff AGENTS.md`
- [x] 3.3 `openspec/context/04-engineering-standards.md` («Общее», пункт «Агент»): промпт — `agno/skills/<agent_id>/SKILL.md`, в `config.yaml` — описания и быстрые подсказки

## 4. Проверка

- [x] 4.1 `./scripts/format.sh`, `./scripts/validate.sh` (с активным `agno/.venv`), `git diff --check` — без ошибок
- [x] 4.2 Отказ старта (временные правки вне коммита, каждую вернуть): без `agno/skills/coauthor/SKILL.md`; без `description`; с `name: co-author`; с пустым телом — импорт `app.main` (`./scripts/dev.sh api` или `python -c "import app.main"` из `agno/`) падает с ошибкой, называющей путь и причину; записать сообщения в `tmp/VERIFY.md`
- [x] 4.3 `docker compose up -d --build`: в контейнере `agentos-api` есть `/app/agno/skills/coauthor/SKILL.md`, API стартует; автор в чате получает ответ соавтора по открытому документу
- [x] 4.4 `python -m evals --tag coauthor` после изменений проходит; сравнить ответ с базой из 1.1 и записать в `tmp/VERIFY.md` раздельно static, deterministic, model, container результаты и ограничения (hosted не проверялся)

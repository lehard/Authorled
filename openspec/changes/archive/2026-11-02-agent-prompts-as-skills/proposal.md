# Proposal

## Why

Промпт продуктового агента «Соавтор» — строка `INSTRUCTIONS` в Python (`agno/agents/coauthor.py`): правка формулировки — это правка кода, а у промпта нет описания, по которому другой агент или будущий планировщик понял бы, что агент умеет. Владелец выбрал стандарт Anthropic Agent Skills: агент описывается навыком — папкой с `SKILL.md` (имя и описание в заголовке, инструкция в теле). Agno 3.1.10 поддерживает стандарт встроенным модулем `agno.skills`. Основание — бизнес-интент `business-intents/agent-prompts-as-skills.md` (решения владельца 2026-11-02).

## What Changes

- **Папка `agno/skills/`**: у каждого агента со своим промптом — `agno/skills/<agent_id>/SKILL.md`; `name` совпадает с id агента и именем папки, `description` говорит, что агент умеет, тело — промпт.
- **Промпт соавтора** переезжает в `agno/skills/coauthor/SKILL.md` без изменения текста; строка `INSTRUCTIONS` из `agno/agents/coauthor.py` удаляется.
- **Загрузка встроенным загрузчиком Agno** `LocalSkills(<папка агента>)` с проверкой по стандарту; тело `SKILL.md` передаётся агенту в `instructions` целиком, как сейчас. Инструментов навыков (`get_skill_instructions` и др.) у агента нет.
- **Без fallback:** нет папки или `SKILL.md`, заголовок не проходит проверку Agno, `name` не совпадает с id агента — API не стартует, ошибка называет файл и причину.
- **Документация:** `create-agent`, `AGENTS.md`/`CLAUDE.md` и `openspec/context/04-engineering-standards.md` описывают промпт агента как его `SKILL.md`.

## Scope

- `agno/skills/coauthor/SKILL.md` — новый файл.
- `agno/agents/`: общая загрузка промпта агента из его `SKILL.md`; `coauthor.py` использует её вместо строки.
- Образ API: `agno/skills/` попадает в `/app/agno/skills/` (`agno/Dockerfile` копирует контекст целиком, `.dockerignore` папку не исключает — проверить сборкой).
- Спеки: дельты `api/agents` («Соавтор»), `architecture` («Слои приложения»), `runtime` («Образы»).
- Документация: `.agents/skills/create-agent/SKILL.md`, `AGENTS.md` («Where changes belong», «Agents and storage»), `openspec/context/04-engineering-standards.md` («Общее»).
- Проверка: старт API, ответ чата, отказ старта при отсутствующем или неверном `SKILL.md`, smoke-евалы, образ; запись в `tmp/VERIFY.md`.

## Non-goals

- Модель и настройки модели в базе — решено не делать (2026-11-02); остаются в `agno/app/settings.py`.
- Навыки доменов, подгружаемые моделью по запросу (`skills=Skills(...)`), справочные материалы и скрипты навыков.
- Универсальный агент, планировщик, Workflow.
- Пресет `claude-engineer` и инструкция Routine `agentos-maintenance` (`agno/app/company.py`): это не промпты продуктовых агентов.
- Манифест `agno/app/config.yaml` (описания и быстрые подсказки) — без изменений.
- Изменение текста промпта и поведения соавтора; изменения фронтенда; обновление пина Agno.

## Capabilities

### New Capabilities
<!-- нет -->

### Modified Capabilities
- `api/agents`: «Соавтор» — промпт берётся из `agno/skills/coauthor/SKILL.md`; без файла или с неверным файлом API не стартует; у агента нет инструментов навыков.
- `architecture`: «Слои приложения» — папка `skills/` для навыков агентов.
- `runtime`: «Образы» — образ API содержит `/app/agno/skills/`.

## Impact

- Код: `agno/agents/coauthor.py` и новый модуль загрузки промпта в `agno/agents/`; новых зависимостей нет (`agno.skills` входит в пин `agno==3.1.10`).
- Запуск: API падает на старте при отсутствующем или неверном `SKILL.md`, вместо того чтобы работать без промпта.
- Поведение соавтора, API, фронтенд, база — без изменений.
- Риск: `description` в `SKILL.md` и в манифесте `config.yaml` могут разойтись (открытый вопрос интента; в этом change не решается).

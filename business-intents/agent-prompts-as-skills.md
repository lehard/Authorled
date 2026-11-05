# Бизнес-интент: промпты агентов в файлах по стандарту Anthropic Agent Skills

Статус: решения согласованы с владельцем 2026-11-02; change `agent-prompts-as-skills` реализован и архивирован 2026-11-02 (`openspec/changes/archive/2026-11-02-agent-prompts-as-skills/`); production не проверялся. Владелец: lehard. Обновлено: 2026-11-02.
Рамки: `openspec/context/03-architecture.md`, `openspec/context/07-anti-patterns.md` (п. 18, 26, 27), мастер-спека `api/agents` («Зарегистрированные агенты»), скилл `.agents/skills/create-agent`.

## Why

Промпт продуктового агента «Соавтор» сейчас — строка `INSTRUCTIONS` в Python (`agno/agents/coauthor.py`). Чтобы поправить формулировку, приходится менять код, а у промпта нет описания, по которому другой агент или будущий планировщик мог бы понять, что этот агент умеет.

Владелец выбрал стандарт Anthropic Agent Skills: каждый агент описывается навыком — папкой с `SKILL.md`, где в заголовке имя и описание, а в теле — инструкция. Agno 3.1.10 поддерживает этот стандарт встроенным модулем `agno.skills`, поэтому своё чтение и проверка файлов не нужны.

## What Changes

1. **Папка навыков агентов** `agno/skills/`. У каждого агента с собственным промптом своя папка `agno/skills/<agent_id>/SKILL.md`:
   - в заголовке `name` (совпадает с id агента и именем папки) и `description` (что умеет агент);
   - в теле — промпт агента.
2. **Промпт соавтора переносится в `agno/skills/coauthor/SKILL.md`** без изменения текста. Строка `INSTRUCTIONS` из `agno/agents/coauthor.py` удаляется.
3. **Загрузка встроенным загрузчиком Agno** `LocalSkills(<папка агента>)` с проверкой по стандарту. Тело `SKILL.md` передаётся агенту в `instructions` и попадает в системное сообщение целиком на каждом ходу, как сейчас.
4. **Без fallback:** нет папки или `SKILL.md`, заголовок не проходит проверку Agno, `name` не совпадает с id агента — API не стартует, ошибка называет файл и причину.
5. **Документация:** скилл `create-agent` и `AGENTS.md`/`CLAUDE.md` описывают, что промпт нового агента — его `SKILL.md`, а не строка в коде.

## Scope

- `agno/skills/coauthor/SKILL.md` — новый файл.
- `agno/agents/coauthor.py` — загрузка промпта из `SKILL.md` вместо строки.
- Сборка образов: `agno/skills/` попадает в образ API (`agno/Dockerfile` копирует репозиторий целиком — проверить).
- `.agents/skills/create-agent/SKILL.md`, `AGENTS.md`/`CLAUDE.md` («Где что лежит», форма агента).
- Мастер-спека `api/agents`: откуда соавтор берёт промпт.
- Проверка: API стартует, чат отвечает как раньше; API не стартует при отсутствующем или неверном `SKILL.md`; smoke-евалы; запись в `tmp/VERIFY.md`.

## Non-goals

- Хранение модели и её настроек в базе — решено не делать (2026-11-02); модель и настройки остаются в коде (`agno/app/settings.py`).
- Навыки доменов, подгружаемые моделью по запросу (`skills=Skills(...)`, `get_skill_instructions`) — отдельным решением.
- Скрипты и справочные материалы навыков (`scripts/`, `references/`).
- Универсальный агент, планировщик, Workflow.
- Промпт `claude-engineer` (пресет Claude Code) и инструкция Routine `agentos-maintenance` в `agno/app/company.py`: они не промпты продуктовых агентов.
- Описания и быстрые подсказки агентов в `agno/app/config.yaml` (манифест AgentOS) остаются как есть.
- Изменение текста промпта соавтора и его поведения.
- Обновление пина Agno.

## Constraints (из контекст-пака)

- Файлы навыков читаются средствами Agno (`agno.skills`), без своего парсера и без обхода проверки (анти-паттерн 27).
- Без fallback: отсутствующий или неверный `SKILL.md` — явная ошибка при старте, без запасного промпта в коде (анти-паттерн 26).
- В `SKILL.md` нет исполняемого кода; продуктовый агент не получает инструменты запуска скриптов (анти-паттерн 18).
- Поведение соавтора не меняется: тот же текст, та же модель, та же история и тот же контекст из AG-UI.

## Acceptance criteria

- В `agno/agents/coauthor.py` нет текста промпта; промпт лежит в `agno/skills/coauthor/SKILL.md` с `name: coauthor` и `description`.
- Системное сообщение соавтора содержит текст промпта целиком, как до изменения; у агента нет инструментов навыков (`get_skill_instructions` и других).
- Без `agno/skills/coauthor/SKILL.md`, с неверным заголовком или с `name`, отличным от `coauthor`, API не стартует, и ошибка называет причину.
- Чат отвечает автору как раньше; smoke-евалы проходят.
- Образ API содержит `agno/skills/`; в контейнере соавтор работает.
- `create-agent` и `AGENTS.md`/`CLAUDE.md` описывают промпт агента как `SKILL.md`.

## Risks

- **Два описания агента.** `description` в `SKILL.md` и `description` в манифесте `config.yaml` могут разойтись.
- **Имя папки `skills`.** Внутри `agno/` уже есть пакет Agno `agno.skills` (в виртуальном окружении); папка без `__init__.py` с ним не конфликтует, но имя легко перепутать в документации.
- **Ограничения стандарта.** Проверка Agno допускает в заголовке только `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`; дополнительные поля — только внутри `metadata`.

## Open Questions

- Решено 2026-11-02: модель и настройки в базе не храним, остаются в коде.
- Решено 2026-11-02: промпт агента — тело его `SKILL.md`, передаётся целиком в `instructions` (а не каталогом навыков с загрузкой по запросу).
- Нужно ли сверять `description` из `SKILL.md` с манифестом `config.yaml` (проверка в `validate.sh`) или манифест берёт описание из `SKILL.md`.

## References

- `agno/agents/coauthor.py`, `agno/app/main.py`, `agno/app/config.yaml`.
- Agno 3.1.10: `agno/skills/loaders/local.py` (`LocalSkills`: одна папка навыка или каталог, проверка по стандарту), `agno/skills/validator.py`, `agno/skills/skill.py`.
- https://docs.agno.com/skills/overview, https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview.
- `openspec/specs/api/agents/spec.md` — «Зарегистрированные агенты».

## MODIFIED Requirements

### Requirement: Слои приложения
Код бэкенда лежит в `agno/` и MUST разделяться так:
- `app/main.py` — сборка `AgentOS`;
- `app/interfaces.py` — MCP OAuth, MCP-инструменты;
- `app/auth/` — кодовая часть модуля `auth`: проверка JWT Authentik, сопоставление групп и scopes, `Principal`, доступ к проекту;
- `app/company.py` — Products, Sources, Routines;
- `app/config.yaml` — манифест компонентов;
- `app/registry.py` — реестр Studio, shared knowledge/learning/notes;
- `app/settings.py` — фабрики моделей;
- `app/sandbox.py` — провайдеры sandbox и `REPOSITORY`;
- `agents/engineers.py` — инженеры;
- `skills/<agent_id>/SKILL.md` — промпты агентов в формате Anthropic Agent Skills: имя папки и `name` совпадают с id агента, тело — промпт;
- `db/` — подключение к PostgreSQL и знания;
- `evals/` — кейсы и CLI.

Вне `agno/`:
- `auth/` (корень репозитория) — деплой-часть модуля `auth`: сервисы и blueprints Authentik, оформление, инициализация БД, выгрузка ключей;
- `web/` (корень репозитория) — фронтенд (тонкий клиент без своей БД, ADR-001); `web/src/design-system/` — токены, темы, шрифты и базовые компоненты дизайн-системы.

#### Scenario: Порядок сборки
- GIVEN импортируется `app.main`
- WHEN создаётся `AgentOS`
- THEN `attach_interfaces(agent_os)` MUST вызываться после создания и до `agent_os.get_app()`

#### Scenario: Авторизация подключается модулем
- GIVEN импортируется `app.main`
- WHEN создаётся `AgentOS`
- THEN настройка авторизации и изоляции MUST браться из `app/auth/`, а `app/main.py` MUST NOT содержать разбора токенов и claims

#### Scenario: Фронтенд отделён от бэкенда
- GIVEN в репозитории есть `web/`
- WHEN собирается образ бэкенда по `agno/Dockerfile`
- THEN образ MUST NOT зависеть от содержимого `web/`, а код `web/` MUST NOT импортировать модули бэкенда

#### Scenario: Промпт агента в навыке
- GIVEN у агента есть собственный промпт
- WHEN проверяется раскладка `agno/`
- THEN промпт MUST лежать в `skills/<agent_id>/SKILL.md`, а модуль агента в `agents/` MUST NOT содержать текста промпта

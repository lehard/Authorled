# Spec Delta

## MODIFIED Requirements

### Requirement: Слои приложения
Код MUST разделяться так:
- `app/main.py` — сборка `AgentOS`;
- `app/interfaces.py` — MCP OAuth, MCP-инструменты;
- `app/auth/` — кодовая часть модуля `auth`: проверка JWT Authentik, сопоставление групп и scopes, `Principal`, доступ к проекту;
- `modules/auth/` — деплой-часть модуля `auth`: сервисы и blueprints Authentik, оформление, инициализация БД, выгрузка ключей;
- `app/company.py` — Products, Sources, Routines;
- `app/config.yaml` — манифест компонентов;
- `app/registry.py` — реестр Studio, shared knowledge/learning/notes;
- `app/settings.py` — фабрики моделей;
- `app/sandbox.py` — провайдеры sandbox и `REPOSITORY`;
- `agents/engineers.py` — инженеры;
- `db/` — подключение к PostgreSQL и знания;
- `evals/` — кейсы и CLI;
- `web/` — фронтенд (тонкий клиент без своей БД, ADR-001); `web/src/design-system/` — токены, темы, шрифты и базовые компоненты дизайн-системы.

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
- WHEN собирается образ бэкенда по `Dockerfile`
- THEN образ MUST NOT зависеть от содержимого `web/`, а код `web/` MUST NOT импортировать модули бэкенда

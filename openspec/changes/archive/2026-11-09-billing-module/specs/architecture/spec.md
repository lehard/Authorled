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
- `core/` — ядро продукта: пользователи, истории и их данные; MUST NOT вызывать биллинг;
- `billing/` — модуль биллинга: тарифы, подписки, журнал расхода и лимит, свои данные и миграции (`billing/module`); другие части бэкенда MUST обращаться к нему только через его публичный интерфейс;
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

#### Scenario: Биллинг отделён от ядра
- GIVEN импортируется `app.main`
- WHEN проверяется раскладка `agno/`
- THEN код тарифов, подписок и журнала расхода MUST лежать в `billing/`, а не в `core/`

### Requirement: Подключение к БД
URL БД MUST собираться из `DB_DRIVER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_DATABASE` (`core/connection.py`; `db/url.py` берёт сборку оттуда). Все переменные MUST быть заданы: при отсутствии любой из них или нечисловом `DB_PORT` приложение MUST завершать запуск ошибкой, называющей переменную; значения по умолчанию MUST NOT подставляться. Тот же URL MUST использовать шаг миграций схем продукта и биллинга; пул соединений биллинга MUST собираться из тех же переменных с теми же отказами. `DB_USER` MUST быть ролью `agentos` без прав суперпользователя, которая владеет схемами `ai` (Agno), `authorled` (данные продукта) и `billing` (данные биллинга) и не имеет прав на схему `authentik`; загрузочный суперпользователь базы MUST использоваться только шагами инициализации и администрирования, а не API и не миграциями. Роль `agentos`, расширение `vector`, схемы `authorled` и `billing` и владение объектами схемы `ai` MUST готовиться идемпотентным шагом инициализации до миграций и до старта API; если шаг не выполнился, API MUST NOT стартовать. Шаг инициализации MUST готовить ту базу, к которой подключён, и MUST NOT ссылаться на базу по зашитому имени. Пароль роли `agentos` MUST задаваться обязательной переменной `AGENTOS_DB_PASSWORD`.

#### Scenario: Compose
- GIVEN контейнер `agentos-api` запущен через `compose.yaml`
- WHEN строится URL
- THEN `DB_HOST` MUST быть `agentos-db`, `DB_PORT` `5432`
- AND `DB_USER` MUST быть `agentos`

#### Scenario: Нет переменной подключения
- GIVEN `DB_PASS` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой, называющей `DB_PASS`

#### Scenario: Роль API не суперпользователь
- GIVEN API запущен через `compose.yaml`
- WHEN проверяются атрибуты роли, под которой подключается API
- THEN роль MUST NOT иметь `SUPERUSER`

#### Scenario: Нет пароля роли Agno
- GIVEN `AGENTOS_DB_PASSWORD` не задан в `.env`
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей `AGENTOS_DB_PASSWORD`

#### Scenario: Существующая база
- GIVEN база, в которой схема `ai` и её таблицы созданы загрузочным суперпользователем
- WHEN выполняется шаг инициализации и запускается API
- THEN владельцем схемы `ai` и её таблиц MUST стать роль `agentos`
- AND сохранённые сессии, знания и записи Company MUST остаться доступны через API

#### Scenario: Схема продукта в существующей базе
- GIVEN база со схемами `ai` и `authentik`, но без схемы `authorled`
- WHEN выполняется шаг инициализации
- THEN схема `authorled` MUST появиться с владельцем `agentos`
- AND схемы `ai` и `authentik` и их данные MUST остаться без изменений

#### Scenario: Другая база
- GIVEN пустая база с именем, отличным от `ai`
- WHEN шаг инициализации выполняется с подключением к этой базе
- THEN роль `agentos` MUST получить право создавать схемы именно в этой базе
- AND в ней MUST появиться схемы `ai`, `authorled` и `billing` с владельцем `agentos`

#### Scenario: Схема биллинга в существующей базе
- GIVEN база со схемами `ai`, `authorled` и `authentik`, но без схемы `billing`
- WHEN выполняется шаг инициализации
- THEN схема `billing` MUST появиться с владельцем `agentos`
- AND схемы `ai`, `authorled` и `authentik` и их данные MUST остаться без изменений

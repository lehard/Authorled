## ADDED Requirements

### Requirement: Раскладка монорепозитория
Репозиторий MUST состоять из трёх модулей верхнего уровня и общего корня:
- `agno/` — бэкенд на Agno: код, зависимости, образ API, прокси моделей, compose-фрагмент `agno/compose.yaml` и скрипты только бэкенда;
- `web/` — фронтенд;
- `auth/` — деплой-часть модуля авторизации.

В корне MUST оставаться только общее для модулей:
- `compose.yaml`, который подключает фрагменты модулей и объявляет общую PostgreSQL;
- `compose.prod.yaml`, `example.env`, `.env`;
- `openspec/`, `business-intents/`, `.agents/`, `.github/`, `AGENTS.md`/`CLAUDE.md`, `README.md`, `LICENSE`, `tmp/`;
- `scripts/` со скриптами всего стека.

В корне MUST NOT быть кода бэкенда и папки `modules/`. Пути кода бэкенда в спеках (`app/…`, `agents/…`, `db/…`, `evals/…`) MUST читаться относительно `agno/`; остальные пути — относительно корня репозитория.

Корень репозитория MUST задаваться в коде одной константой. Через неё MUST определяться:
- корень OS Manager;
- рабочая папка инженера без песочницы;
- локальный Git Source компании;
- файл `.env` для evals;
- каталог checkpoints.

Константа MUST указывать на корень репозитория, а не на `agno/`. Если в вычисленном корне нет `AGENTS.md`, импорт MUST завершаться ошибкой, называющей путь; другой каталог MUST NOT подставляться.

#### Scenario: Состав верхнего уровня
- GIVEN репозиторий после переноса
- WHEN перечисляются отслеживаемые git каталоги верхнего уровня
- THEN каталоги MUST быть только из списка `agno`, `web`, `auth`, `scripts`, `openspec`, `business-intents`, `.agents`, `.claude`, `.github`
- AND каталогов `app`, `agents`, `db`, `evals`, `litellm`, `docs`, `modules` в корне MUST NOT быть

#### Scenario: OS Manager видит весь репозиторий
- GIVEN API запущен локально или в контейнере
- WHEN определяется корень OS Manager и рабочая папка инженера
- THEN оба MUST указывать на каталог, где лежат `AGENTS.md`, `openspec/` и `agno/`

#### Scenario: Корень не найден
- GIVEN в вычисленном корне репозитория нет `AGENTS.md`
- WHEN импортируется модуль с константой корня
- THEN импорт MUST завершиться ошибкой, называющей проверенный путь

#### Scenario: Данные сохранены после переноса
- GIVEN существующий том `authorled_pgdata` с сессиями и записями Company
- WHEN после переноса выполняется `docker compose up -d --build`
- THEN compose-проект MUST называться `authorled` и использовать тот же том
- AND сохранённые записи MUST быть доступны через API

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

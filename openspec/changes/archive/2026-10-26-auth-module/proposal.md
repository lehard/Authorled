# Proposal

## Why

Данные авторов — главный актив продукта: сценарист А не должен технически видеть или менять проект сценариста Б. Agno не хранит пользователей, пароли и роли, а MVP-ядро и фронтенд (`authorled-web`) без входа не работают. Нужен полноценный Identity Provider (вход, 2FA, профиль, сброс пароля, группы, админка, сервисные учётные записи), и нужен он в той же модели, что и остальной бэкенд: модульный монолит с одним репозиторием и одним релизом. Решение владельца 2026-10-26 (ADR-001, `03-architecture.md`): Authentik целиком становится модулем `auth` этого репозитория; встроить его в процесс Agno нельзя, поэтому он работает отдельными контейнерами, а граница модуля — контракт OIDC/JWT и объект `Principal`.

Бизнес-интент: `business-intents/authentik-identity-and-isolation.md`.

## What Changes

- Новый модуль `auth`, деплой-часть `modules/auth/`: фрагмент compose с контейнерами Authentik (сервер и worker) и закреплённой версией образа; blueprints (группы `screenwriters`, `editors`, `admins`, OIDC-приложение и провайдер для фронтенда, потоки входа с 2FA/MFA, сервисные учётные записи плагинов, property mapping групп в scopes); оформление страниц Authentik; инициализация БД; скрипт выгрузки ключей Authentik в `JWT_JWKS_FILE`.
- Новый модуль `auth`, кодовая часть `app/auth/`: настройка проверки JWT в AgentOS, сопоставление групп и scopes, объект `Principal`, зависимость `current_principal` для маршрутов `base_app` (ADR-002), интерфейс `can_access_project(principal, project_id)`.
- Хранение: Authentik пишет в схему `authentik` общей PostgreSQL (`AUTHENTIK_POSTGRESQL__DEFAULT_SCHEMA`) под отдельной ролью без прав на схему `ai`; Agno остаётся в схеме `ai`. Обратная изоляция (роль Agno без доступа к `authentik`) не обеспечивается: загрузочный пользователь `ai` — суперпользователь.
- Авторизация AgentOS включается при любом `RUNTIME_ENV`, включая `dev` (решение владельца 2026-10-26); условие `authorization=runtime_env != "dev"` в `app/main.py` удаляется. В `dev` и `prd` без ключа проверки JWT приложение не стартует.
- Интерфейс Authentik (вход, профиль, сброс пароля, админка) публикуется на домене продукта за обратным прокси; админка доступна только группе `admins`.
- `scripts/dev.sh` поднимает Authentik вместе с базой и LiteLLM, выгружает ключи в `JWT_JWKS_FILE` и только потом запускает API.
- Правила границ: вне `app/auth/` JWT и claims Authentik не читаются, вне `modules/auth/` нет настроек Authentik.
- **BREAKING**: `docker compose up` и `./scripts/dev.sh api` требуют новые переменные Authentik в `.env` и выгруженный JWKS; запросы к API в `dev` без токена Authentik получают `401` (раньше авторизация в `dev` была выключена); AgentOS UI в `dev` работает только с токеном.

## Scope

- Модуль `modules/auth/` и `app/auth/` в объёме выше.
- `app/main.py` (авторизация, интеграция адаптера), `compose.yaml`, `compose.prod.yaml`, `scripts/dev.sh`, `example.env`, `README.md`, `AGENTS.md`, `.agents/skills/deploy-platform/SKILL.md`, `.agents/skills/setup-platform/SKILL.md`.
- Схема `authentik` и роль БД: создание до первого запуска Authentik, проверка изоляции.
- Контракт входа для `authorled-web` (OIDC-клиент, Bearer-токен) — только описание в design и спеке.
- Дельты мастер-спек: `runtime`, `integrations`, `architecture`, `overview`, `api/core`, `api/mcp`; новая спека `auth`.
- Проверка: два тестовых пользователя, токены разных групп, `401`/`403`/изоляция данных Agno, состав таблиц по схемам, воспроизведение конфигурации Authentik из blueprints; запись в `tmp/VERIFY.md`.

## Non-goals

- Встраивание Authentik в процесс Agno, свой экран входа, свои пароли, регистрация и сброс пароля в бэкенде.
- Отдельная база или отдельный экземпляр PostgreSQL для Authentik; высокая доступность Authentik и несколько реплик.
- Роли в проекте (автор, соавтор, редактор) и проверка доступа к произведению: модуль задаёт интерфейс `can_access_project`, реализация и хранение — change ядра (`core-*`).
- Реализация OIDC-клиента и экрана входа во фронтенде (`authorled-web`).
- Изменение собственных `/users*` и `/service-accounts` Agno (каталог пользователей `user_directory=True` и токены `agno_pat_*`): остаются как есть; их соотношение с Authentik — открытый вопрос design.
- Отдельный журнал безопасности и мониторинг (вне MVP).
- Обновление пина Agno и других зависимостей; изменение моделей, LiteLLM и очередей.
- Правка исторических записей `openspec/changes/archive/**`.

## Capabilities

### New Capabilities
- `auth`: модуль авторизации — состав и границы модуля, проверка JWT Authentik, сопоставление групп и scopes, `Principal` и доступ к проекту, хранение в схеме `authentik`, публикация интерфейса Authentik, воспроизводимая конфигурация из blueprints.

### Modified Capabilities
- `runtime`: контейнеры разработки и production-override включают сервисы Authentik; `scripts/dev.sh` управляет Authentik и выгрузкой JWKS.
- `integrations`: требование «AgentOS UI и JWT» — ключи берутся из JWKS Authentik, а не только с `os.agno.com`.
- `architecture`: «Слои приложения» — добавляются `app/auth/` и `modules/auth/`.
- `overview`: «Возможности AgentOS» — авторизация включена при любом `RUNTIME_ENV`.
- `api/core`: «Аутентификация защищённых маршрутов» и «Отказ старта без ключа проверки JWT» — авторизация и в `dev`, ключ только `JWT_JWKS_FILE`.
- `api/mcp`: «Доступ к /mcp» — без токена `401` и в `dev` (раньше `302`).

## Impact

- Код: новый пакет `app/auth/`, правка `app/main.py`; новые файлы `modules/auth/**`.
- Инфраструктура: новые контейнеры (`authentik-server`, `authentik-worker`) и ресурсы на хосте; схема и роль в `agentos-db`; обратный прокси для домена Authentik (решает design).
- Конфигурация: новые переменные в `example.env` (`AUTHENTIK_*`, роль БД, секреты), `JWT_JWKS_FILE` обязателен и в `dev`.
- Документация и контекст-пак: README, AGENTS.md, скиллы `deploy-platform` и `setup-platform`; `openspec/TODO.md`. ADR-001, `03-architecture.md`, `05-security-and-compliance.md` уже обновлены 2026-10-26.
- Зависимости: фронтенд `authorled-web` получает контракт входа; ядро получает интерфейс `can_access_project`.

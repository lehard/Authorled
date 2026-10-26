# Tasks

Результаты проверок записываются в `tmp/VERIFY.md` раздельно: static, deterministic, container, hosted (что не проверено локально — обратный прокси и домен). Живая проверка требует Docker и `.env`.

## 1. Проверка допущений на пине

- [x] 1.1 Выбрать тег образа Authentik по официальным релизам и проверить совместимость с PostgreSQL 18 (`agnohq/pgvector:18`): поднять Authentik во временном compose, дождаться применения миграций под ролью без суперпользователя в схеме `authentik`. Проверка: сервер и worker `healthy`; записать в `tmp/VERIFY.md` тег, нужны ли расширения или права выше прав роли схемы (D3, Risks), и фактические имена переменных начального администратора. Если нужны права суперпользователя — стоп, решение владельца.
- [x] 1.2 Проверить механизм групп на Agno 3.1.10 (D5): токен Authentik содержит claim `groups`; `Authorization(roles_claim="groups", jwks_file=..., issuer=..., audience=..., verify_audience=True)` принимает токен; выясните, какие данные кладёт middleware в `request.state` (`user_id`, scopes, группы) и какие таблицы/маршруты (`/authz`) появляются. Проверка: короткий скрипт в `tmp/` и вывод в `tmp/VERIFY.md`. Если `roles_claim` не работает — стоп, правка design через `/opsx:update` (вариант B), а не обходной путь.

## 2. База: схема и роль

- [x] 2.1 Добавить `modules/auth/db/init.sql` (идемпотентно: роль Authentik с паролем из окружения, схема `authentik` с владельцем-ролью, `search_path`, `REVOKE` на схему `ai`) и сервис `authentik-db-init` в `compose.yaml` (одноразовый, `restart: "no"`, ждёт `healthy` у `agentos-db`). Проверка: два запуска подряд проходят без ошибок; `\dn` показывает `authentik`; под ролью Authentik `SELECT` из таблицы схемы `ai` отвергается.
- [x] 2.2 Добавить в `example.env` блок Authentik (`AUTHENTIK_SECRET_KEY`, пароль роли БД, данные первого администратора, адреса, Client ID) с пояснениями, кто что использует; в `compose.yaml` обязательные переменные записать как `${NAME:?NAME must be set in .env}`. Проверка: `docker compose config` без `AUTHENTIK_SECRET_KEY` падает с сообщением, называющим переменную.

## 3. Контейнеры Authentik

- [x] 3.1 Добавить `authentik-server` и `authentik-worker` в `compose.yaml`: закреплённый тег из 1.1, подключение ролью Authentik с `AUTHENTIK_POSTGRESQL__DEFAULT_SCHEMA=authentik`, порты `127.0.0.1`, монтирование `modules/auth/blueprints` только для чтения, `depends_on` с `authentik-db-init` (`service_completed_successfully`), healthcheck. Проверка: `docker compose up -d --wait authentik-server authentik-worker`; интерфейс отвечает на `127.0.0.1`; список таблиц по схемам — таблицы Authentik только в `authentik`, в `public` и `ai` нет; без схемы (удалить и запустить) сервер завершается ошибкой.
- [x] 3.2 `compose.prod.yaml`: сервисы Authentik без значений по умолчанию для секретов, порты `127.0.0.1`; комментарий о доверенных адресах обратного прокси. Проверка: `docker compose -f compose.yaml -f compose.prod.yaml config` показывает привязку к `127.0.0.1` и падает без секретов.

## 4. Blueprints

- [x] 4.1 `modules/auth/blueprints/`: группы `screenwriters`, `editors`, `admins`; OIDC-приложение и провайдер фронтенда (публичный клиент, Authorization Code с PKCE, redirect URI из окружения, подпись RS256 ключом Authentik, включая `groups` в токене). Проверка: на пустой схеме после старта группы и приложение существуют (интерфейс или API Authentik); токен тестового пользователя содержит `iss`, `aud`, `sub`, `groups`.
- [x] 4.2 Поток входа с обязательным вторым фактором для обычных пользователей и политика доступа к административной части только для `admins`. Проверка: пользователь `screenwriters` не открывает админку; вход без второго фактора не выдаёт токен.
- [x] 4.3 Сервисные учётные записи: одна для разработки (проверки, `MCP_CHECK_TOKEN`, curl) и шаблон для плагинов с ограниченным набором прав; способ получения токена описан в README. Проверка: токен сервисной учётной записи принимается API на разрешённом маршруте и отвергается (`403`) на запрещённом (см. 7.2).

## 5. Ключи проверки

- [x] 5.1 Сервис `authentik-jwks-export` (минимальный образ с `curl`, одноразовый): после `healthy` сервера атомарно записывает открытые ключи провайдера в `modules/auth/jwks/jwks.json`, ненулевой код при ошибке HTTP, пустом ответе или отсутствии ключей; каталог в `.gitignore`. Проверка: файл содержит ключ с `kid`; с неверным адресом провайдера сервис завершается ненулевым кодом, API не стартует.

## 6. Код: `app/auth/` и подключение

- [x] 6.1 `app/auth/`: построение `Authorization(...)` по D4 (`JWT_JWKS_FILE`, `issuer`, `audience`, RS256, роли групп и `admin_scope` по результату 1.2); все параметры из обязательных переменных окружения, отсутствие любой — `RuntimeError` с именем переменной. Проверка: `./scripts/validate.sh`; запуск без `JWT_JWKS_FILE` завершается ошибкой с именем переменной.
- [x] 6.2 `Principal`, `current_principal` и интерфейс доступа к проекту с `ProjectAccessNotConfigured` (D6, D7). Проверка: `./scripts/validate.sh`; вызов интерфейса без источника поднимает ошибку, «разрешено» не возвращается (проверка вызовом из `python -c` в `tmp/VERIFY.md`).
- [x] 6.3 `app/main.py`: убрать условие `runtime_env != "dev"`, передать `authorization=` из `app/auth/`; `agentos-api` в `compose.yaml` — `JWT_JWKS_FILE`, монтирование ключей только для чтения, `depends_on` с `authentik-jwks-export`. Проверка: `docker compose up -d --build` — API стартует после выгрузки; `GET /health`, `GET /sessions` без токена в `dev` — `401`.
- [x] 6.4 `scripts/check_auth_boundary.sh` (поиск JWT, claims и Authentik вне `app/auth/`, конфигурации Authentik вне `modules/auth/`) и вызов из `scripts/validate.sh`. Проверка: на чистом дереве проходит; с намеренным нарушением (временная строка в `app/main.py`) падает с путём нарушения.

## 7. Интеграционные проверки

- [x] 7.1 `scripts/auth_check.sh` (по образцу `mcp_check.sh`, без вызовов моделей): получает токены тестовых пользователей и сервисных учётных записей у Authentik, проверяет `401` (нет токена, подделка, просрочка, чужая аудитория), `200` и `403` по группам. Проверка: скрипт проходит на локальном стенде и падает при подмене ключа.
- [x] 7.2 Изоляция данных Agno на двух пользователях: сессии A и B, `user_id` в записях БД равен `sub`, чужая сессия не отдаётся. Проверка: результат в `tmp/VERIFY.md` (deterministic/container).
- [x] 7.3 Ротация ключа: пересоздать ключ подписи в Authentik, выполнить `docker compose run --rm authentik-jwks-export`, перезапустить `agentos-api`; токен со старой подписью получает `401`. Проверка: запись в `tmp/VERIFY.md`.
- [x] 7.4 Воспроизводимость: `./scripts/dev.sh reset-db --yes`, затем полный запуск; конфигурация Authentik появляется из blueprints без ручных шагов (кроме создания первого администратора, если blueprints его не создают). Проверка: повтор 4.1 и 7.1 после сброса.

## 8. Скрипты разработки

- [x] 8.1 `scripts/dev.sh`: `db`, `api`, `stop`, `reset-db`, справка и сообщения учитывают Authentik (запуск `authentik-db-init`, `authentik-server`, `authentik-worker`, `authentik-jwks-export`; `api` запускает API на хосте только после выгрузки ключей и экспортирует `JWT_JWKS_FILE` хост-путём). Проверка: сценарии из дельты `runtime` (`db`, `api`, остановка, сброс, неизвестная команда, нет `.env`) выполнены вручную; `bash -n scripts/dev.sh`.

## 9. Документация и контекст

- [x] 9.1 `README.md`, `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md`, `.agents/skills/deploy-platform/SKILL.md`: модуль `auth`, новые переменные, порядок запуска, получение токена для curl и `mcp_check.sh`, ротация ключа, требования к обратному прокси и домену Authentik. Проверка: команды из документов выполняются как написано; `git diff --check`.
- [x] 9.2 `openspec/TODO.md`: закрыть пункт «Авторизация» (ссылка на архив change после архивации), перенести невыполненное (обратный прокси, `hosted`-проверка) в список; `openspec/context/05-security-and-compliance.md` и `03-architecture.md` сверить с фактической реализацией. Проверка: `grep -rn "authorled-auth"` по документам не находит устаревших утверждений.
- [x] 9.3 Финальные проверки: `./scripts/validate.sh`, `git diff --check`, `openspec validate auth-module --strict`, запись раздельных результатов и ограничений в `tmp/VERIFY.md`. Проверка: все команды завершаются нулём; в `tmp/VERIFY.md` явно указано, что обратный прокси, домен и MFA-устройства не проверялись (`hosted`).

## 10. Базовые спеки api/core и api/mcp

- [x] 10.1 Дельты `specs/api/core/spec.md` и `specs/api/mcp/spec.md`: убрать `JWT_VERIFICATION_KEY`, зафиксировать, что авторизация включена и в `dev` (раньше `authorization=runtime_env != "dev"`, `auth_mode: "none"`, `302` на `/mcp` в `dev`), и что запуск без `JWT_JWKS_FILE` падает с `RuntimeError`. Проверка: `openspec validate auth-module --strict` проходит; `grep -rn JWT_VERIFICATION_KEY openspec/specs/api` после архивации не находит упоминаний (до архивации — только в базовых спеках).
- [x] 10.2 Проверить вживую в `RUNTIME_ENV=dev` то, что дельты 10.1 утверждают, но чего не показали прошлые проверки: `GET /mcp` без токена — `401`, `GET /info` без токена — `200`, `GET /config` без токена — `401`, `./scripts/mcp_check.sh` с `MCP_CHECK_TOKEN` токеном `sa-dev` проходит handshake и `tools/list` (модель не вызывается). Проверка: результаты в `tmp/VERIFY.md` (container); при расхождении поправить сценарии в дельтах.

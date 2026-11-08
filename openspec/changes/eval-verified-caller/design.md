# Design: eval соавтора от имени проверенного пользователя разработки

## Context

Мотивация — в `proposal.md` (Why). Что известно из кода (Agno 3.1.10, Authentik 2026.8.5):

- `RunContext.authorization` при создании берёт значение `agno.run.authorization.current_authorization()`. Это contextvar, который задаёт `authorization_scope(factory)`. HTTP-слой (`RunAuthorizationMiddleware`) задаёт его на каждый запрос: полномочия собираются из проверенного состояния запроса, с `enforce_tools=False`, а провайдер прав определяет `resolve_authorization_provider(app)`.
- `agno.os.authz.run_context.restore_authorization(app, snapshot)` собирает `RunAuthorization` из снимка `{"context": {...}, "service_account": ..., "enforce_tools": ...}` с тем же провайдером, что AgentOS выбирает для запросов. Именно так исполнитель расписаний восстанавливает полномочия вызывающего.
- Раннер eval (`agno/eval/suite.py`, `_arun_case`) вызывает асинхронный `setup` случая через `await` в той же задаче. Потом он запускает тело случая через `asyncio.wait_for`, а это новая задача с копией текущего контекста. После тела в той же задаче вызывается `teardown(context, result)`, даже при ошибке и таймауте. Поэтому contextvar, заданный в асинхронном `setup`, виден запуску агента и судье, а `teardown` его снимает.
- Если у запуска есть пользователь, инструменты OS Manager проверяют его права (`_tool_authorization` включает `enforce_tools` для зарезервированных менеджеров). У `screenwriters` прав на OS Manager нет.
- `JWTValidator(jwks_file=..., algorithm="RS256", issuer=...)` и `validate_token(token, expected_audience=...)` (`agno/os/middleware/jwt.py`) — тот же валидатор и те же проверки, что у API: подпись по JWKS, `exp`, `iss`, `aud`.
- `client_credentials` с `username` и паролем приложения (`authentik/providers/oauth2/token/client_credentials.py`) принимает любого активного пользователя с токеном intent `app_password`. Тип пользователя не проверяется, но проверяются политики доступа к приложению.
- `check_auth_boundary.sh` запрещает слова `jwt` и `authentik` в Python-коде `agno/evals/`, `agno/app/` (кроме `agno/app/auth/`), `agno/agents/` и других каталогах.
- `run_principal` допускает `RunContext.user_id is None` и сверяет пользователя только если `user_id` задан.

## Goals / Non-Goals

**Goals:**
- Запуск соавтора в eval получает полномочия так же, как HTTP-запуск: из проверенного токена, с тем же провайдером прав и `enforce_tools=False`.
- Всё, что касается Authentik и токена, остаётся в `agno/app/auth/`.
- Ни одного нового значения по умолчанию: каждая недостающая настройка — ошибка с её именем.

**Non-Goals:**
- Задавать `Case.user_id`: `Case` неизменяем, а `sub` известен только после запроса токена. Запуск идёт с `user_id=None`, и это допускает `run_principal` (решение 2).
- Проверять права на запуск агента (`agents:coauthor:run`) в eval: в процессе нет маршрута, а проверяем мы поведение соавтора, а не права маршрута.

## Decisions

1. **Удостоверение собирает модуль `auth`.** Новый файл `agno/app/auth/dev_caller.py` с функцией `dev_writer_caller(app) -> DevCaller`. `DevCaller` — неизменяемая запись из `authorization: RunAuthorization`, `subject: str` и `identity: Identity`. Функция по шагам:
   1. Требует `RUNTIME_ENV == "dev"`, иначе `RuntimeError` до любого запроса.
   2. Читает обязательные `AUTH_DEV_WRITER_TOKEN`, `AUTH_ISSUER`, `AUTH_FRONTEND_CLIENT_ID` и `JWT_JWKS_FILE` своей проверкой модуля, как `_required_env` у `build_authorization`, но значение `***` (заглушка `example.env`) тоже считается отсутствующим.
   3. Шлёт `POST {authentik}/application/o/token/` (`grant_type=client_credentials`, `client_id`, `username=writer`, `password`, `scope=openid profile email`). Адрес Authentik выводится из `AUTH_ISSUER` так же, как в `scripts/auth_check.sh`: часть до `/application/o/`; если `AUTH_ISSUER` её не содержит — ошибка. Запрос делается через `urllib.request` с таймаутом 30 с. Не-200 — ошибка с кодом HTTP и полем `error` ответа (или пометкой, что тело не JSON); ответ без `access_token` и недоступный адрес — тоже ошибка; пароль и токен в сообщения не попадают. Claim `scopes` в токенах Authentik нет, тогда scopes запуска пусты и берутся из групп, как у запроса; claim `scopes` неверного вида — ошибка.
   4. Проверяет токен `JWTValidator(jwks_file=JWT_JWKS_FILE, algorithm="RS256", issuer=AUTH_ISSUER).validate_token(token, expected_audience=AUTH_FRONTEND_CLIENT_ID)`. Требует `groups` — список строк, как `run_principal`. Требует непустые `email` и `name`, как `current_identity`.
   5. Собирает полномочия `restore_authorization(app, {"context": {"principal_id": sub, "scopes": <claim scopes или []>, "claims": payload}, "service_account": False, "enforce_tools": False})`.

   Шаги 4–5 вынесены в `verified_caller(app, token)`: их можно проверить pytest на токенах, подписанных сгенерированным ключом, без Authentik. `app` — приложение из `app.main` (`agent_os.get_app()`), то же, что обслуживает запросы.

   Альтернативы. Собрать `RunAuthorization` вручную с `resolve_authorization_provider(app)` — то же самое, но снимок повторяет ровно то, что делает исполнитель Agno. Читать токен в `agno/evals/` — запрещено границей модуля. Проверять токен через HTTP-вызов собственного API — нужен запущенный API, а судить по ответу маршрута о токене — не то же самое, что проверить его.

2. **Пользователь задаётся только случаю соавтора, через `setup` и `teardown` случая.** В `agno/evals/cases.py` у `coauthor_uses_context` будет асинхронный `setup`. Он вызывает `dev_writer_caller(app)` (через `asyncio.to_thread`, потому что запрос и проверка синхронные), заводит аккаунт (решение 3) и входит в `authorization_scope(lambda: caller.authorization)`. Открытый контекст-менеджер `setup` возвращает, а асинхронный `teardown` его закрывает. Ошибка в `setup` раннер записывает как `setup: <тип>: <сообщение>`: случай падает, тело не выполняется, модель не вызывается, а `cli` возвращает ненулевой код.

   Альтернативы. Обернуть весь `cli(...)` в `authorization_scope` в `agno/evals/__main__.py`, как предлагал интент. Тогда пользователь достанется случаям OS Manager, и их инструменты упрутся в права `screenwriters`; кроме того, `--tag smoke` начнёт зависеть от Authentik. Выдать eval права администратора — расширение прав ради теста. Свой раннер — запрещённая машинерия (07-anti-patterns, п. 23).

   `setup` и `teardown` — штатные хуки `Case`, а не своя изоляция или очистка: они задают вызывающего, как HTTP-слой. Помощник для них живёт в `agno/evals/caller.py`, чтобы `cases.py` остался списком случаев.

3. **Аккаунт в ядре — путём первого входа.** В `setup` после получения удостоверения: `with get_engine().begin() as c: get_or_create_user(c, caller.subject, caller.identity.email, caller.identity.name)`. Это тот же вызов, что делает `/api/v1/me`. Удалённый аккаунт (`AccountDeleted`) — ошибка `setup`.

   Альтернатива — требовать предварительный `seed` или вход. Это лишний ручной шаг, а результат тот же.

4. **Пароль приложения в blueprint разработки.** В `auth/blueprints-dev/dev-users.yaml` добавляется запись `authentik_core.token` (identifier `writer-dev-token`, `user: !Find [authentik_core.user, [username, writer]]`, `intent: app_password`, `key: !Env AUTH_DEV_WRITER_TOKEN`, `expiring: false`), по образцу `sa-dev-token` в `40-service-accounts.yaml`. Ссылаться на пользователя стоит через `!KeyOf`: для этого у записи пользователя `writer` появится `id`, по образцу `user-sa-dev`. Шаг `auth-users` в `scripts/dev.sh` читает `AUTH_DEV_WRITER_TOKEN` из `.env`, отвергает пустое значение и `***` и передаёт его в `ak apply_blueprint` через `-e` вместе с паролем. Проверка идёт до любого изменения пользователей.

   Альтернатива — создавать токен через `ak shell`, как устройство почты. Blueprint декларативен и повторяет уже принятый образец `sa-dev`.

5. **Где можно запускать.** Eval соавтора запускается на хосте: из контейнера `agentos-api` адрес Authentik из `AUTH_ISSUER` (`localhost:9000`) недоступен, и `setup` падает с ошибкой, называющей этот адрес. Отдельного адреса Authentik для контейнеров не вводим.

## Risks / Trade-offs

- [Раннер Agno поменяет порядок вызова `setup` и тела (например, вынесет `setup` в отдельную задачу) → contextvar не дойдёт до запуска, и хук снова откажет «no verified caller»] → Отказ виден сразу, тихой деградации нет. Поведение закреплено пином 3.1.10; при обновлении Agno этот случай — часть проверки.
- [Запуск с `user_id=None`: сессия eval хранится без пользователя, а предварительная запись прошлых запусков в хуке (`_earlier_runs`) их не находит] → В каждом случае новая сессия с одним запуском, так что записывать нечего; расход самого запуска пишет пост-хук с `sub` из полномочий.
- [Пароль приложения обходит вход по коду для `writer`] → Только локальный стенд: blueprint применяет лишь `auth-users` при `RUNTIME_ENV=dev`, а функция модуля отказывает вне `dev`.
- [Eval тратит лимит `writer`] → Исчерпанный лимит роняет случай с понятным сообщением; поднимается через `./scripts/usage.sh local set-plan`.
- [Политика доступа к приложению Authentik может запретить `writer`] → Тот же пользователь входит во фронтенд через то же приложение, так что политика его пускает. Отказ будет ошибкой `invalid_grant`, а не обходом.

## Migration Plan

Только локальный стенд. После слияния: добавить `AUTH_DEV_WRITER_TOKEN` в `.env` (`openssl rand -hex 24`), выполнить `./scripts/dev.sh auth-users`. Production не затрагивается, откат — удаление записи токена из blueprint разработки и функции модуля.

## Open Questions

- нет.

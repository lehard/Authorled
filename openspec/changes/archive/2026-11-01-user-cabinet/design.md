# Design

## Context

Мотивация — `proposal.md`, требования — дельты в `specs/`. Что есть сейчас:
- **Ядро.** `agno/core/` содержит `connection.py` (URL из `DB_*`) и `tables.py` (таблица `users`); миграция `0001_create_users`; pytest на чистой базе `ai_test` (`./scripts/dev.sh test`). Операций над записями нет.
- **AgentOS.** Приложение создаётся в `agno/app/main.py` без `base_app`; `authorization=build_authorization(db)` ставит JWT-middleware на всё приложение. Маршрут, которого нет в `scope_mappings`, пропускается с любым действительным токеном (`agno/os/middleware/jwt.py`, `_get_required_scopes`); без токена — `401` до маршрута.
- **Модуль `auth`.** `agno/app/auth/principal.py` даёт `current_principal` (`sub`, группы, scopes); другие claims модуль пока не отдаёт.
- **Токен.** Access Token Authentik собирается из тех же scope mappings, что и ID-токен (`openid`, `email`, `profile`, `offline_access` в `auth/blueprints/20-oidc.yaml`). Claim `groups`, на который опирается бэкенд, приходит из mapping `profile`, а он же отдаёт `name`; `email` приходит из mapping `email`. Blueprints менять не нужно; наличие claims проверяется задачей.
- **Фронтенд.**
  - API AgentOS открывается на своём адресе через `/os/` (прокси Vite); `osFetch` в `screens/project/chat/api.ts` добавляет токен.
  - Имя для меню даёт `authProvider.getIdentity` из профиля ID-токена.
  - Тема: `design-system/theme.ts` (`applyTheme` пишет `authorled.theme`) и скрипт в `web/index.html` до первой отрисовки; переключатель есть только в витрине.
- **Agno 3.1.10.** С параметром `base_app` (`AgentOS.__init__`, `_app_set = True`) Agno не ставит свои обработчики `HTTPException`, `RequestValidationError` и `Exception` (`app.py`, `if not self._app_set`). Для всех маршрутов Agno меняются тело ошибок (`error_id`, `error_type`) и обработка 500.

## Goals / Non-Goals

**Goals:**
- Свои маршруты подключаются так, чтобы ответы маршрутов Agno не изменились ни в одном байте.
- Логика «получить или создать» и «изменить» — в ядре, на `Connection` SQLAlchemy, и тестируется на настоящем PostgreSQL. Маршрут только читает запрос, зовёт ядро и пишет ответ.
- Первый вызов одного пользователя из двух вкладок не создаёт дублей.
- Тема аккаунта применяется без отдельного механизма: имеющийся скрипт первой отрисовки плюс применение после `/me`.

**Non-Goals:**
- Общий слой API для будущих маршрутов (генерация TS-клиента, общий клиент problem+json). Пока маршрут один; обобщим, когда появится второй.
- Перенос `osFetch` чата в общий модуль: чат не трогаем.
- Асинхронный драйвер БД: маршруты синхронные, FastAPI выполняет их в пуле потоков.

## Decisions

### 1. Роутер в приложении AgentOS, без `base_app`
`app/main.py` после `app = agent_os.get_app()` вызывает `app.include_router(me_router)`. JWT-middleware уже стоит на приложении, поэтому `/api/v1/me` требует действительный токен, как любой маршрут Agno; scope не нужен.
- *Альтернатива — `base_app`, как написано в ADR-002.* Снимает обработчики ошибок Agno со всех его маршрутов; повторять их у себя — копия чужого кода, а это запрещённый compatibility-адаптер. Решение владельца 2026-11-01: роутер в приложении. ADR-002, `CLAUDE.md`/`AGENTS.md` и контекст-пак уточняются в этом change.
- *Порядок маршрутов (найдено при реализации, решение владельца 2026-11-01).* AgentOS монтирует MCP-приложение на корень `/`, и смонтированное на корень приложение отвечает 404 на любой путь, до которого дошло. Поэтому `attach_api` ставит наши маршруты в списке маршрутов приложения перед этим монтированием; тест `test_routes_come_before_a_root_mount` и живая проверка (`/api/v1/me` → 200, `/mcp` → 401) это закрепляют.
- *Проверка:* `/openapi.json` содержит `/api/v1/me`. Число путей и операций Agno не меняется, кроме нашего пути. Ответ ошибки маршрута Agno сохраняет `error_id`. И то и другое — тестом.

### 2. Ошибки problem+json только для своих маршрутов
Приложение уже имеет обработчики Agno для `HTTPException` и `RequestValidationError` на все пути, и подменять их нельзя. Поэтому:
- маршруты бросают своё исключение `Problem(status, title, detail)`; обработчик зарегистрирован только для этого типа и отвечает `application/problem+json`;
- тело `PATCH` маршрут читает сам (`await request.json()`) и проверяет моделью Pydantic (`extra="forbid"`, хотя бы одно поле, `display_name` обрезается). `ValidationError` превращается в `Problem(422)` с именем поля. Схема тела попадает в OpenAPI через `openapi_extra`, чтобы контракт для фронтенда остался виден;
- `401` отдаёт middleware Agno в своём формате — это зафиксировано в спеке `api/me`.
- *Альтернатива — свой обработчик `RequestValidationError`, отличающий путь `/api/v1/`.* Требует перехватить обработчик Agno и вызывать его для чужих путей — та же хрупкость, что в решении 1.

### 3. Почта и имя — отдельная зависимость модуля `auth`
В `agno/app/auth/` появляется `current_identity(request) -> Identity(email, name)`, рядом с `current_principal`, а не новые поля `Principal`:
- `Principal` — про доступ, а почта и имя в решениях о доступе не участвуют (спека `auth`);
- сервисные учётные записи без почты продолжают получать `Principal`.

Нет claim или он пуст — исключение `MissingIdentityClaim(claim)`. Обработчик роутера превращает его в `Problem(403)` с именем claim. Чтение claims остаётся только в `agno/app/auth/`, и `check_auth_boundary.sh` это проверяет.

### 4. Ядро: `core/users.py` на `Connection`
- `get_or_create_user(conn, subject, email, name) -> Account`, одна транзакция:
  1. `INSERT … ON CONFLICT (auth_subject) DO NOTHING RETURNING` в `users`;
  2. если вставки не было — `SELECT … FOR UPDATE` и обновление `email` (если изменилась) и `last_seen_at`;
  3. `INSERT … ON CONFLICT DO NOTHING` в `user_settings`.

  Удалённая запись даёт `AccountDeleted`, и транзакция откатывается. `ON CONFLICT` решает гонку двух первых вызовов без блокировок таблицы.
- `update_account(conn, subject, display_name=UNSET, theme=UNSET) -> Account`. Различает «не передано» и `None` (тема «как в системе»); обновляет `updated_at` только изменённой таблицы. Нет записи — `AccountNotFound`, удалена — `AccountDeleted`.
- `Account` — неизменяемый dataclass: `id`, `email`, `display_name`, `theme`.
- *Альтернатива — ORM-модели.* Ядро уже описано `Table` в `tables.py`; одной Core-таблицы достаточно, второй стиль не нужен.

### 5. Подключение маршрутов к базе
`core/engine.py`: `get_engine()` создаёт один `Engine` SQLAlchemy по `build_db_url()` при первом вызове и кэширует его. Это та же база и та же роль `agentos`, что у Agno, но свой пул: `get_postgres_db()` — адаптер Agno, а не подключение ядра. Маршрут открывает `engine.begin()` на запрос.
- *Альтернатива — взять движок из `get_postgres_db()`.* Связывает ядро с внутренностями Agno, хотя `core/` намеренно от него независим.

### 6. Таблица `user_settings` и миграция `0002_user_settings`
- `user_id uuid` — первичный ключ, `FOREIGN KEY → users.id ON DELETE RESTRICT`. Удаление аккаунта мягкое, физически строки не удаляются; `RESTRICT` не даёт случайно потерять настройки.
- `theme text NULL` с `CHECK (theme IN ('light','sepia','dark'))`.
- `updated_at timestamptz NOT NULL DEFAULT now()`.

Имена ограничений — по соглашению `metadata` в `tables.py`, тест сравнения описания с базой покрывает новую таблицу. Строки профиля для уже существующих пользователей не нужны: `users` сейчас пуста, а «получить или создать» дописывает строку и для старой записи.

### 7. Фронтенд: аккаунт как identity Refine
- `web/src/account/meApi.ts`:
  - `getMe()` и `patchMe(changes)` на `/os/api/v1/me` с токеном из `activeUser()`;
  - ответ `application/problem+json` превращается в `AccountError` с `detail` и статусом;
  - неизвестная тема в ответе — ошибка, а не подстановка.
- `authProvider.getIdentity` вызывает `getMe()`. Тогда `useGetIdentity` (меню и страница настроек) получает аккаунт из одного кэша React Query. После `patchMe` кэш identity обновляется, и меню сразу показывает новое имя.
- Тема: `RequireAuth` после получения identity вызывает `applyAccountTheme(theme)`. `light`/`sepia`/`dark` пишутся в `authorled.theme` и в `data-theme`; `null` удаляет ключ и ставит тему системы. Скрипт `web/index.html` не меняется. Витрина продолжает менять только ключ в браузере.
- Ошибка `getMe()` → меню и `/settings` показывают причину и «Повторить» (`refetch`), без данных ID-токена.
- *Альтернатива — отдельный контекст аккаунта.* Дублирует кэш identity Refine, а меню уже читает `useGetIdentity`.

### 8. Экран `/settings`
`web/src/screens/settings/SettingsScreen.tsx` повторяет раскладку v1 средствами дизайн-системы:
- `TopBar` полки, `Paper`, слева список разделов-якорей; на `< 768 px` он над содержимым;
- раздел «Профиль»: `Input` имени и «Сохранить», почта текстом, «Выйти» через `useLogout`;
- раздел «Внешний вид»: четыре плитки-радиокнопки. Превью — маленький «стол с листом» с собственным `data-theme`: токены объявлены на каждом `[data-theme]`, поэтому плитка рисует свою тему внутри текущей. «Как в системе» — половина `light` и половина `dark`.

Выбор темы применяется сразу (оптимистично) и сохраняется `patchMe`; при ошибке возвращается тема из кэша и показывается причина. Пункт «Настройки» добавляется в `UserMenu`.

## Risks / Trade-offs

- [Claims `email`/`name` нет в Access Token на нашей версии Authentik] → задача 1 проверяет декодированный токен до кода. Если их нет — стоп и `/opsx:update`: тогда нужен scope mapping в blueprints.
- [OpenAPI без автоматической схемы тела `PATCH` (тело читается вручную)] → схема задаётся `openapi_extra` из модели Pydantic; тест проверяет её наличие.
- [Мигание темы на новом устройстве до ответа `/me`] → принято в интенте: одна смена при первом входе.
- [Число путей OpenAPI в спеке `overview` (131/182) уже не совпадает с кодом: перед change API отдаёт 141 путь и 197 операций] → в дельте стоит число после change (142/199). Перед правкой его надо пересчитать на запущенном API и при расхождении исправить дельту.
- [Первый экран вне чата, которому нужен API] → в разработке API и так нужен для чата; ошибка показывается с причиной.
- [Свой пул соединений рядом с пулом Agno] → один API-процесс, небольшой пул (`pool_size=5`); при росте нагрузки пересмотреть.

## Migration Plan

1. `agentos-migrate` применяет `0002_user_settings` до старта API, как `0001`. Откат вперёд-только: при ошибке — новая миграция, а не правка `0002`.
2. Бэкенд и фронтенд выкатываются вместе. Старый фронтенд с новым API работает (меню из токена); новый фронтенд без нового API показывает ошибку `/me`.
3. Данных переносить не нужно: `users` пуста, записи появятся при первом входе.

# Tasks

## 1. Предусловия

- [x] 1.1 Декодировать Access Token пользователя (например, `writer@authorled.test`, полученный фронтендом) и убедиться, что в нём есть непустые `email` и `name`. Если их нет — стоп и `/opsx:update` (нужен scope mapping в blueprints). Результат записать в `tmp/VERIFY.md` без значения токена
- [x] 1.2 Посчитать пути и операции `GET /openapi.json` на запущенном API до изменений. Если там не 141/197 — исправить число в дельте `specs/overview/spec.md` (до +1 пути и +2 операций) до правки кода

## 2. Ядро: таблица профиля

- [x] 2.1 `agno/core/tables.py`: таблица `user_settings` (`user_id` — PK и FK на `users.id` с `RESTRICT`, `theme` с `CHECK`, `updated_at`), имена ограничений по соглашению `metadata`
- [x] 2.2 Миграция `agno/migrations/versions/0002_user_settings.py` (`alembic revision --rev-id 0002_user_settings`), написанная вручную под `tables.py`; downgrade — `NotImplementedError`, как в `0001`. Проверка: `./scripts/dev.sh test` (сравнение описания с базой) и `./scripts/validate.sh` (одна голова)
- [x] 2.3 Тесты таблицы в `agno/tests/`: неизвестная тема, профиль без пользователя, вторая строка того же пользователя, состав колонок `users` и `user_settings`

## 3. Ядро: операции

- [x] 3.1 `agno/core/engine.py`: `get_engine()` — один кэшированный `Engine` по `build_db_url()`, небольшой пул
- [x] 3.2 `agno/core/users.py`: `Account`, `get_or_create_user` (`ON CONFLICT DO NOTHING`, `FOR UPDATE`, обновление почты и `last_seen_at`, строка профиля), `update_account` с отличием «не передано» от `None`, исключения `AccountDeleted` и `AccountNotFound`
- [x] 3.3 Тесты операций на `ai_test`:
  - первый вызов создаёт по одной строке;
  - повтор не создаёт дублей;
  - имя не перезаписывается токеном;
  - смена почты;
  - удалённый аккаунт;
  - `update_account` по полям и `updated_at`;
  - два первых вызова в параллельных соединениях дают одну запись.

  Проверка: `./scripts/dev.sh test`

## 4. Модуль auth

- [x] 4.1 `agno/app/auth/principal.py`: `Identity(email, name)`, `current_identity`, `MissingIdentityClaim`; экспорт из `app/auth/__init__.py`. Пустой или отсутствующий claim — исключение с именем claim
- [x] 4.2 Тест `current_identity` на запросе с подготовленным `request.state` (claims есть, нет `email`, пустой `name`); `./scripts/check_auth_boundary.sh` проходит

## 5. Маршруты /api/v1/me

- [x] 5.1 `agno/app/api/` (новый пакет):
  - `Problem` и обработчик `application/problem+json` только для своих исключений (`Problem`, `MissingIdentityClaim`);
  - модели ответа и тела `PATCH` (`extra="forbid"`, хотя бы одно поле, обрезка имени, `Literal` темы или `null`);
  - роутер `GET`/`PATCH /api/v1/me` на `current_principal` и `current_identity`; ядро на `engine.begin()`;
  - `AccountDeleted` → `410`, `AccountNotFound` → `404`, ошибки тела → `422` с полем;
  - схема тела в `openapi_extra`.
- [x] 5.2 `agno/app/main.py`: `app.include_router(me_router)` после `agent_os.get_app()`, без `base_app`; комментарий со ссылкой на ADR-002 и причиной
- [x] 5.3 Тесты маршрутов в `agno/tests/` (`TestClient` на отдельном `FastAPI` с роутером и обработчиком, `request.state` задаётся тестовым middleware):
  - сценарии спеки `api/me`: первый и повторный вызов, `PATCH` имени и темы, `null`, `422` (пустое имя, `blue`, `{}`, лишнее поле), `403` без `email`, `404`, `410`, только своя запись;
  - тело ошибки — `application/problem+json`.
- [x] 5.4 Проверка на запущенном API (`docker compose up -d --build`):
  - без токена `GET /api/v1/me` → `401`;
  - токен сервисной учётной записи (`./scripts/auth_check.sh`) → `403` с `email`;
  - токен пользователя → `200`;
  - `/openapi.json` содержит `/api/v1/me` со схемой тела `PATCH`, число путей и операций совпадает с дельтой `overview`;
  - ошибка маршрута Agno (например, `GET /agents/нет-такого` под админом) по-прежнему содержит поля Agno.

## 6. Фронтенд

- [x] 6.1 `web/src/account/meApi.ts`: `getMe`, `patchMe` на `/os/api/v1/me` с токеном; разбор problem+json в `AccountError`; неизвестная тема в ответе — ошибка
- [x] 6.2 `web/src/design-system/theme.ts`: `applyAccountTheme(theme | null)` — запись или удаление `authorled.theme` и `data-theme` (для `null` — тема системы); витрина не меняется
- [x] 6.3 `web/src/auth/authProvider.ts`: `getIdentity` возвращает аккаунт из `getMe()` (`id`, `name`, `email`, `theme`); `RequireAuth` применяет тему аккаунта после ответа
- [x] 6.4 `web/src/screens/shared/UserMenu.tsx`: имя и почта из аккаунта, пункт «Настройки» → `/settings`, ошибка `/me` с причиной и «Повторить»
- [x] 6.5 `web/src/app/router.tsx`: маршрут `/settings` внутри `RequireAuth`
- [x] 6.6 `web/src/screens/settings/SettingsScreen.tsx`:
  - раскладка v1 (`TopBar`, лист, разделы-якоря слева, сверху на `< 768 px`, «Назад»);
  - «Профиль»: имя с «Сохранить» (активна при изменении, пустое — «Введите имя.» без запроса), почта текстом, «Выйти»;
  - после сохранения обновить кэш identity;
  - ошибка `/me` с «Повторить».
- [x] 6.7 «Внешний вид»:
  - четыре плитки-радиокнопки с превью в своём `data-theme` («Как в системе» — половины `light` и `dark`);
  - выбор применяется сразу и сохраняется `patchMe`;
  - при ошибке тема возвращается, причина показывается.
- [x] 6.8 Проверка: `./scripts/validate.sh` (сборка, токены, контраст) без новых сырых цветов

## 7. Спеки, документы и проверка

- [x] 7.1 ADR-002, `CLAUDE.md`, `AGENTS.md`, `openspec/context/03-architecture.md` и `04-engineering-standards.md`: «через `base_app`» → «роутер в приложении AgentOS», с причиной (обработчики ошибок Agno). Требование «Каждый маршрут проверяет доступ к проекту» уточнить: маршруты без проекта (`/api/v1/me`) работают только с записью владельца токена
- [x] 7.2 Проверка в браузере (Playwright, отдельные контексты, Mailpit для кода), запись в `tmp/VERIFY.md`:
  - новая регистрация → меню из `/me`, записи в `users` и `user_settings`;
  - смена имени → меню сразу, после перезагрузки и после повторного входа;
  - пустое имя;
  - тема «Бумага» в одном контексте → `sepia` после входа во втором;
  - «Как в системе» при тёмной системе;
  - API остановлен → причина и «Повторить» на `/settings` и в меню;
  - три темы и 375 px без горизонтальной прокрутки.
- [x] 7.3 Итоговые проверки: `./scripts/dev.sh test`, `./scripts/validate.sh`, `git diff --check`, `openspec validate user-cabinet --strict`

## Workflow follow-up

- `/opsx:verify user-cabinet`, затем `/opsx:archive user-cabinet` (синхронизация дельт `api/me`, `core/database`, `auth`, `overview`, `web/workspace`, `web/design-system`).
- Обновить статус в `business-intents/user-cabinet.md` после архива.

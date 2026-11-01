# Design

## Context

- Мотивация — `proposal.md`, требования — `specs/web/workspace/spec.md`, дельты `web/app` и `web/design-system`.
- `web/` сейчас: Vite 8, React 19, TypeScript 6 со строгими настройками, Tailwind 4, дизайн-система в `src/design-system/` (токены «Кабинета», шрифты, темы, `Paper`, `AiLabel`, `ThemeSwitcher`, `StatusBadge`), 7 компонентов shadcn в `src/components/ui/`, витрина `src/showcase/Showcase.tsx`, которую показывает `App.tsx`. Проверки: `lint`, `typecheck`, `build`, `check:contrast`, `check_web_tokens.sh` в `validate.sh`.
- Образец экранов и поведения — макет v2: `app.js` (экраны, навигатор, меню, диалоги), `data.js` (данные примера, `PROFILE`, `ROLES`), `app.css` (вид на токенах).
- Вход: Authentik 2026.8.5, публичный OIDC-клиент `AUTH_FRONTEND_CLIENT_ID`, один адрес возврата `AUTH_FRONTEND_REDIRECT_URI` (строгое совпадение, по умолчанию `http://localhost:5173/auth/callback`), Access Token 10 минут, refresh 30 дней, scopes `openid`, `email`, `profile` (`auth/blueprints/20-oidc.yaml`).
- Пакеты на 2026-10-31: `@refinedev/core` 5.0.12 (peer `@tanstack/react-query` ^5.81.5), `@refinedev/react-router` 2.0.4 (peer `react-router` ^7), `react-router` 7.18.4 (7.18.5 моложе двух недель; 8.x не поддерживается интеграцией Refine), `oidc-client-ts` 3.5.0. В `@refinedev/core` есть телеметрия на `telemetry.refine.dev`, выключается опцией `disableTelemetry`.

## Goals / Non-Goals

**Goals:**
- Приложение по макету v2 на React, где данные идут только через провайдер Refine, чтобы замена на API бэкенда не трогала экраны.
- Модель ресурсов, близкая к будущему API ядра: отдельные сущности с `projectId` и мягким удалением.
- Вход Authentik без промежуточного бэкенда (спека `auth`).

**Non-Goals:**
- Всё из Non-goals proposal. Сохранение данных между перезагрузками в режиме `fixtures`.

## Decisions

1. **Структура `web/src/`.**
   - `app/` — корень: `AppRoot.tsx` (Refine, роутер, провайдеры), `config.ts` (настройки), `routes.tsx`;
   - `auth/` — `userManager.ts` (oidc-client-ts), `authProvider.ts` (Refine), `CallbackScreen.tsx`;
   - `data/` — `model.ts` (типы), `fixtures.ts` (данные примера), `fixturesProvider.ts`, `profiles.ts` (`PROFILE`, `ROLES`);
   - `screens/` — `shelf/`, `project/` (окно, навигатор, документы, текст), `system/` (ошибка настройки, «Не найдено», ошибка входа);
   - `showcase/` остаётся; `design-system/` без статусов.
   `App.tsx` заменяется на `app/AppRoot.tsx`.

2. **Ресурсы Refine.** `projects` (название, описание, `deletedAt`); `scripts` (по одному на историю, `id = projectId`: название, тэглайн, логлайн, видимость частей, титульная страница, синопсис, абзацы текста); `characters`, `locations`, `worlds` (`projectId`, имя, роль, одна строка, описание, поля профиля, `deletedAt`). Корзина истории — выборка `characters`, `locations`, `worlds` с `deletedAt` по `projectId`; корзина историй — `projects` с `deletedAt`. «Удалить» = `update` с `deletedAt`, «Удалить навсегда» = `deleteOne`. Экраны вызывают `useList`, `useOne`, `useCreate`, `useUpdate`, `useDelete`, а не модуль данных напрямую.
   *Альтернатива:* один ресурс «история» со вложенными документами, как в макете. Отклонено: будущий API ядра хранит документы отдельно (инвариант 5 в `03-architecture.md`), и каждая правка заставляла бы переписывать историю целиком.

3. **Провайдер `fixtures`.** Реализует `getList` (фильтры `eq` по `projectId` и `null`/`nnull` по `deletedAt`, сортировка по полю), `getOne`, `create`, `update`, `deleteOne`. Неподдержанный фильтр или ресурс — исключение с названием, а не пустой список. Данные — копия `fixtures.ts`, перенесённого из `data.js` макета v2 (истории, сценарии с абзацами, персонажи, локации, миры; без комментариев, правок и бесед). Живут в памяти модуля.

4. **Настройки.** `vite.config.ts`:
   - `envDir` — корень репозитория, поэтому `VITE_DATA_SOURCE` читается из корневого `.env` (в бандл попадают только переменные `VITE_*`);
   - три переменные входа читаются `loadEnv` по именам и передаются через `define` как `__AUTH_CONFIG__`; других переменных `AUTH_*` (например, `AUTH_DEV_SERVICE_TOKEN`) в бандле нет.
   Сборка без `.env` (CI) проходит; `app/config.ts` при старте проверяет каждое значение (непустое, `AUTH_*_URI` — корректный URL) и бросает ошибку с именем переменной. Затем проверяется, что `location.origin` совпадает с origin адреса возврата. Ошибки настроек показывает `ConfigErrorScreen` до монтирования Refine.

5. **Вход.** `UserManager` из `oidc-client-ts`: `authority = AUTH_ISSUER`, `client_id`, `redirect_uri`, `response_type: "code"` (PKCE по умолчанию), `scope: "openid profile email offline_access"`, хранение в `sessionStorage` (по умолчанию библиотеки), `automaticSilentRenew` через refresh-токен. В blueprint добавляется управляемый маппинг `goauthentik.io/providers/oauth2/scope-offline_access`, иначе Authentik не выдаст refresh-токен и сессия обрывалась бы каждые 10 минут. `authProvider` для Refine:
   - `check`: есть пользователь с неистёкшим токеном → вход; иначе `signinRedirect({ state: { returnTo } })`;
   - `/auth/callback`: `signinRedirectCallback`, переход на `returnTo`; ошибка → экран с причиной (`error_description` Authentik) и «Войти снова»;
   - `logout`: `signoutRedirect` (выход в Authentik);
   - `getIdentity`: `name` и `email` из профиля.
   Маршруты, кроме `/showcase` и `/auth/callback`, обёрнуты в `Authenticated` Refine.

6. **Роутер.** `createBrowserRouter` React Router 7 и `routerProvider` из `@refinedev/react-router`. Адрес документа — сегмент `:doc` со значениями из спеки (`char:vera` и т. п.); разбор и проверка — одна функция `parseDoc`, неизвестное значение → «Не найдено». Vite в разработке отдаёт `index.html` на любые пути.

7. **Вид.** Классы Tailwind на токенах дизайн-системы, по `app.css` макета v2: стол (`.desk` на `body`), навигатор и чат — панели (`bg-panel shadow-panel rounded-panel`), документ — лист (`Paper`). Недостающие компоненты shadcn ставятся CLI: `dialog`, `dropdown-menu`, `context-menu`, `input`, `textarea`, `label`, `select`, `checkbox`, `sheet`, `alert-dialog`. Иконки — `lucide-react`. Стили абзацев сценария (типы из `TYPES` макета) — `screens/project/script.css` только на токенах; его проверяет `check_web_tokens.sh`.

8. **Мобильная раскладка.** До 900 px навигатор — `Sheet` слева по кнопке, чат — `Sheet` снизу по полосе с заголовком «Соавтор»; полка — одна-две колонки.

9. **«Сохранено».** Поля документов сохраняются `useUpdate` с задержкой 600 мс после ввода; статус: «Сохраняется…» во время запроса, «Сохранено» после, ошибка провайдера — текст ошибки красным (не тихий откат).

10. **Витрина и статусы.** `/showcase` вне `Authenticated`; раздел статусов удаляется; `StatusBadge.tsx`, `statuses.ts` и экспорт из `design-system/index.ts` удаляются. Токены `--status-*` и их пары в `check-contrast.ts` остаются.

11. **Адрес разработки.** Vite по-прежнему слушает `127.0.0.1` (спека `web/app`), а открывается по `http://localhost:5173` (`.claude/launch.json`, README `web/`), потому что origin должен совпасть с адресом возврата. Хранилище OIDC в `sessionStorage` привязано к origin: открытие по `127.0.0.1` ломало бы возврат, поэтому это явная ошибка (решение 4).

## Risks / Trade-offs

- [Браузер разрешает `localhost` в `::1`, а Vite слушает только `127.0.0.1`] → Chrome и Safari пробуют оба адреса; если не откроется, вывести в README явную команду и не менять `host` без решения владельца (спека `web/app`).
- [Токены в `sessionStorage` доступны скриптам страницы] → стандартная схема для публичного SPA-клиента; сторонних скриптов нет (спека «без внешних запросов»), CSP — отдельный change при деплое фронта.
- [Данные примера сбрасываются при перезагрузке] → это видно меткой «Данные примера»; сохранение — с провайдером API.
- [Модель ресурсов придумана до API ядра] → она повторяет инварианты ядра (отдельные сущности, мягкое удаление); при расхождении с будущим OpenAPI меняется только провайдер и типы.
- [Refine тянет `lodash`, `papaparse`, `qs` и devtools] → проверить размер сборки; devtools не подключаются.

## Migration Plan

Только фронтенд и blueprint Authentik. После применения: `docker compose up -d` (Authentik применит blueprint с `offline_access`), добавить `VITE_DATA_SOURCE=fixtures` в `.env`, открыть `http://localhost:5173`. Откат — revert коммита; blueprint без маппинга просто перестанет выдавать refresh-токен.

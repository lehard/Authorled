# Tasks

## 1. Шлюз продления

- [x] 1.1 `web/src/auth/userManager.ts`:
  - `renew()` — один общий `Promise` продления на вкладку (`signinSilent()`), сбрасывается после завершения;
  - `invalid_grant` (`ErrorResponse`) → `removeUser()` и `null`; остальные ошибки пробрасываются;
  - `activeUser()` продлевает истёкший токен только через `renew()`.
- [x] 1.2 `initUserManager`: `automaticSilentRenew: false`; таймер библиотеки (`addAccessTokenExpiring`) вызывает `renew()`; ошибка таймерного продления не теряется (логируется в консоль с причиной, конец сессии ведёт по 2.1)
- [x] 1.3 Поиск по `web/src`: `signinSilent` вызывается только из `renew()`; проверка — `grep -rn signinSilent web/src`

## 2. Экран при конце сессии и сбое

- [x] 2.1 `web/src/app/RefineRoot.tsx` (`RequireAuth`): подписка на `userManager().events.addUserUnloaded` → `refetch()` проверки; отписка при размонтировании. Конец сессии → `/login?returnTo=…`, сбой → прежний экран с причиной и «Попробовать снова»
- [x] 2.2 `web/src/account/meApi.ts`, `web/src/screens/project/chat/api.ts`: при `null` от `activeUser()` — ошибка без собственного экрана поверх ухода на `/login`; тексты «Вход истёк» остаются только как запасной текст ошибки, если экран ещё не ушёл
- [x] 2.3 `web/src/auth/LoginScreen.tsx`: проверка «уже вошли» на отозванном токене не показывает ошибку, а идёт к `flow.start()` (живая сессия Authentik — токены без формы)

## 3. Проверка

- [x] 3.1 `./scripts/validate.sh` (сборка, линт, типы web)
- [x] 3.2 Playwright (Chromium, отдельные контексты, Mailpit), запись в `tmp/VERIFY.md`:
  - истёкший токен (правка `expires_at` в `sessionStorage`) и одновременные запросы проверки, `/api/v1/me` и `/settings` → ровно один запрос к `/application/o/token/`, экран работает;
  - дублированная вкладка (второй контекст со скопированным `sessionStorage`) после продления в первой → тот же адрес без формы входа и без «Не удалось проверить вход»;
  - отозванный refresh token и завершённая сессия Authentik на `/p/water/text` → `/login` с почтой, после входа — `/p/water/text`;
  - Authentik остановлен (`docker compose stop authentik-server`) → «Не удалось проверить вход» с причиной; после запуска «Попробовать снова» впускает.
- [x] 3.3 Журнал событий Authentik после проверок 3.2 (кроме намеренного дубля): нет новых `suspicious_request` «Revoked refresh token was used» от сценариев с одной вкладкой
- [x] 3.4 Итог: `git diff --check`, `openspec validate token-refresh --strict`

## Workflow follow-up

- Ручная проверка владельцем в Safari: оставить вкладку в фоне дольше 10 минут, вернуться — работа без экрана ошибки.
- `/opsx:verify token-refresh`, затем `/opsx:archive token-refresh`; статус в `business-intents/token-refresh.md`.

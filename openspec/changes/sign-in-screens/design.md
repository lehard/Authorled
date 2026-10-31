# Design

## Context

- Мотивация — `proposal.md`, требования — дельты `specs/auth/spec.md` и `specs/web/workspace/spec.md`.
- Authentik 2026.8.5 (`auth/compose.yaml`). Проверено 2026-10-31 на локальном стенде:
  - `GET/POST /api/v3/flows/executor/{slug}/` отдаёт шаги потока JSON-ом (`component`: `ak-stage-identification`, `ak-stage-password`, `ak-stage-authenticator-validate`, `ak-stage-authenticator-email`, `xak-flow-redirect`, `ak-stage-access-denied`, `ak-stage-flow-error` и др.) и принимает ответы с сессионной cookie без CSRF-токена;
  - запросы к API с другого origin (`localhost:5173`) Authentik не разрешает (нет CORS-заголовков), к `/.well-known/` и `/token` — разрешает для origin адреса возврата;
  - есть Email Authenticator (`authenticator_email`: `token_expiry`, `subject`, `template`, общие настройки почты) и класс устройства `email` у `authenticator_validate`;
  - `/api/v3/core/brands/current/` с `Host: localhost:9000` отдаёт бренд по умолчанию, с `Host: localhost` — наш: домен бренда сравнивается с хостом вместе с портом.
- Сейчас: поток `authorled-authentication` = identification (с паролем на том же шаге) → `authenticator_validate` (TOTP, static; `configure`) → login (`auth/blueprints/30-authentication-flow.yaml`). Фронтенд (`web-app-shell`) уводит на страницу Authentik через `signinRedirect` и принимает код на `/auth/callback`.
- Образец экранов — v1: `openspec/context/_raw/design/kabinet/index.html`, состояния `#auth/light/code`, `#auth/light/pass`, `#auth/dark/error`; README v1, раздел «Вход и регистрация».

## Goals / Non-Goals

**Goals:**
- Свой вход по v1 без страниц Authentik, при этом пароли, коды, сессии и токены — только в Authentik.
- Один и тот же поток для пользователя и для быстрого входа разработчика.
- Конфигурация воспроизводится из blueprints и `.env`, без ручных шагов.

**Non-Goals:**
- Регистрация, «Забыли пароль?», настройки безопасности — следующие changes на том же клиенте шагов.

## Decisions

1. **Порядок входа: сначала свои шаги, потом OIDC.** Нет сессии → `RequireAuth` ведёт на `/login?returnTo=…`. Экран проходит поток `authorled-authentication` через API шагов; Authentik ставит сессионную cookie. На `xak-flow-redirect` экран вызывает `signinRedirect({ state: { returnTo } })`: у Authentik уже есть сессия, авторизация идёт без его страниц (поток согласия — неявный), код возвращается на `/auth/callback`, дальше как сейчас.
   *Альтернатива:* вести OIDC первым и подменять страницу потока Authentik. Отклонено: Authentik не умеет отдавать поток на внешний адрес.

2. **Один origin для шагов входа.** Браузер не пустит запросы к API Authentik с адреса фронтенда, поэтому путь `/api/v3/flows/executor/` открыт на адресе фронтенда:
   - разработка — прокси Vite на origin `AUTH_ISSUER` (`changeOrigin`), cookie `authentik_session` ставится на хост `localhost` и уходит и на `localhost:9000` (cookie не различают порты);
   - прод — тот же путь на обратном прокси фронтенда и `AUTHENTIK_COOKIE_DOMAIN` (родительский домен), обязательный в `compose.prod.yaml`. В разработке переменная не задаётся: cookie для `localhost` с атрибутом `Domain` браузеры не принимают.

3. **Поток входа (blueprint `30-authentication-flow.yaml`).**
   - identification: поля `email`, `username`; без `password_stage`; `pretend_user_exists: false` — неизвестная почта даёт ошибку сразу (в v1 один экран почты ведёт и ко входу, и к регистрации, так что существование аккаунта всё равно видно; это осознанный выбор v1);
   - password: привязка с политикой-выражением `return request.context["pending_user"].has_usable_password()` и `re_evaluate_policies: true`;
   - `authenticator_validate`: `device_classes: [email]`, `not_configured_action: configure`, `configuration_stages: [authenticator_email]`;
   - `authenticator_email`: `use_global_settings: true`, `token_expiry: minutes=10`, `subject: "Код для входа в Authorled"`, `template` — свой русский шаблон `auth/templates/email/authorled-code.html` (монтируется в `/templates`);
   - login, как сейчас. TOTP-стадия удаляется из потока (объект можно оставить — он ни к чему не привязан; удаляем, чтобы не путать).

4. **Почта.** `AUTHENTIK_EMAIL__HOST`, `__PORT`, `__USERNAME`, `__PASSWORD`, `__USE_TLS`, `__USE_SSL`, `__FROM` — в `&authentik-env` с `${…:?…}`. Разработка: сервис `mailpit` (образ с закреплённым тегом) во фрагменте `auth/compose.yaml`, SMTP только во внутренней сети, веб-интерфейс на `127.0.0.1:8025`; в `example.env` значения для Mailpit (пустые `USERNAME`/`PASSWORD` допустимы и задаются явно пустыми). `compose.prod.yaml`: `mailpit` получает `profiles: ["never"]`, поэтому не запускается и не входит в `config --services`.

5. **Бренд.** `AUTH_BRAND_DOMAIN` — хост, как пользователь открывает Authentik, вместе с портом, если он есть: в `example.env` — `localhost:9000`. Проверка — сценарий «Бренд с портом».

6. **Клиент шагов (`web/src/auth/flow/`).** `flowClient.ts`: `start()` (GET), `submit(response)` (POST), разбор ответа в объединение типов по `component`; неизвестный `component` или ответ не 200 — ошибка с названием. Экран `/login` — конечный автомат: `email` → (`password`) → `code` → `done`. Сообщения Authentik (`response_errors`) переводятся по коду (`invalid`, неверный пароль, неверный токен); неизвестный код показывается как есть с пояснением «Authentik ответил: …».

7. **Код из 6 ячеек.** Шесть `input inputMode="numeric"`; ввод цифры — фокус дальше; Backspace в пустой — назад; вставка — раскладка; шестая цифра — отправка. Ошибка — очистка и фокус в первую. «Отправить ещё раз» — повторная отправка выбора устройства (`selected_challenge`), таймер 60 секунд на клиенте; частоту дополнительно ограничивает Authentik (`email_otp_throttling_factor`).

8. **Пользователи для разработки.** `auth/blueprints-dev/dev-users.yaml` монтируется в `/blueprints-dev` (вне `/blueprints`, поэтому Authentik его не находит сам). `./scripts/dev.sh auth-users`: отказывает при `RUNTIME_ENV`, отличном от `dev`, без `AUTH_DEV_USER_PASSWORD` в `.env` и без запущенного `mailpit` (его нет в проде); затем `ak apply_blueprint /blueprints-dev/dev-users.yaml` и `ak shell`, который создаёт каждому пользователю подтверждённое почтовое устройство. Blueprint устройство создать может, но поле `confirmed` через него не записывается, а без подтверждённого устройства незаконченная первая настройка блокирует следующий вход (см. Risks).

9. **Быстрый вход.** `web/src/auth/flow/devSignIn.ts` подключается только через `import.meta.env.DEV` (динамический импорт в ветке, которую Vite вырезает из production-сборки). Пароль передаётся `define` только при `command === "serve"`. Код: после отправки пароля — опрос `/mailpit/api/v1/search?query=to:"<почта>"` (прокси Vite на `http://localhost:8025`) раз в 500 мс до 10 секунд, письмо новее момента запроса, шесть цифр из текста. Нет письма или Mailpit недоступен — ошибка с причиной.

10. **Выход.** `signoutRedirect` с `post_logout_redirect_uri = AUTH_FRONTEND_LOGOUT_URI` (новая обязательная переменная, тот же origin, что и адрес возврата; проверяется при старте фронтенда). В провайдере — адрес с `redirect_uri_type: logout` и свой поток `authorled-invalidation` (стадия `user_logout`): стандартный поток выхода Authentik показывал свою страницу и не завершал сессию в Authentik.

11. **Сессия Authentik и незаконченный вход.**
   - `/login` при открытии запускает поток: если Authentik сразу отвечает `xak-flow-redirect` (сессия уже есть — другая вкладка), приложение берёт токены без формы.
   - Authentik хранит незаконченный поток в сессии: после перезагрузки на шаге кода поток продолжился бы с кода. Старт сбрасывает его через `/flows/-/cancel/` (тот же прокси, редирект не выполняется).
   - Запросы одной сессии не должны идти параллельно: Authentik сохраняет сессию в конце запроса, и параллельный старт (React StrictMode дважды выполняет эффект) возвращает отменённый поток. Старт выполняется один раз на экземпляр клиента.
   - Быстрый вход при чужой сессии в Authentik сначала завершает её потоком выхода.

12. **Ошибки Authentik.** Authentik отвечает на языке браузера, поэтому таблица известных ошибок содержит английские и русские тексты (почта, пароль, код; стадия проверки кода говорит про «время на устройстве» — для кода из письма это неверный код). Неизвестная ошибка показывается с пометкой «Authentik ответил: …».

13. **Ячейки кода.** Набранное хранится и в `ref`: нажатия могут приходить быстрее перерисовки. Несколько цифр за одно событие (автоподстановка `one-time-code`, быстрый ввод) раскладываются по ячейкам; ограничения длины у ячейки нет.

## Risks / Trade-offs

- [Существование аккаунта видно по ответу на почту] → решение v1; ограничение частоты попыток — Authentik (`failed_attempts_before_cancel`, throttling).
- [Прод требует обратный прокси с путём `/api/v3/flows/executor/` и общий домен cookie] → требование в спеке `auth`; деплой фронтенда — отдельный change, README описывает настройку.
- [Ответы API шагов могут меняться между версиями Authentik] → разбор только нужных полей, неизвестный `component` — явная ошибка; версия закреплена в `auth/compose.yaml`.
- [Пароль пользователей для разработки попадает в бандл сервера разработки] → только при `vite serve`, только тестовое значение из `.env`; production-сборку проверяет сценарий «Нет в production».
- [Незаконченная первая настройка почтового кода оставляет неподтверждённое устройство, и Authentik дальше отказывает: «The user already has an email address registered for MFA»] → у пользователей для разработки устройство создаётся подтверждённым; для настоящих пользователей — решение в change регистрации (устройство при регистрации или очистка неподтверждённых), пункт в `openspec/TODO.md`.
- [Пользователи с TOTP] → при следующем входе настроят код на почту; эксплуатации нет, локальная база пересоздаётся.

## Migration Plan

`.env`: добавить `AUTHENTIK_EMAIL__*` (Mailpit), `AUTH_FRONTEND_LOGOUT_URI`, `AUTH_BRAND_DOMAIN=localhost:9000`, `AUTH_DEV_USER_PASSWORD`; пересоздать контейнеры Authentik (`docker compose up -d`), иначе новые переменные до них не дойдут. `docker compose up -d` (Authentik применит поток, поднимется Mailpit), `./scripts/dev.sh auth-users`. Откат — revert коммита и `docker compose up -d`: старый поток вернётся из blueprint.

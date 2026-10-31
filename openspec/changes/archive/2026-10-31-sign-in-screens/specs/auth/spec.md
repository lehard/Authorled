## MODIFIED Requirements

### Requirement: Конфигурация из blueprints
Группы (`screenwriters`, `editors`, `admins`, `plugins`), OIDC-приложение и провайдер для фронтенда, поток входа, сопоставление групп и scopes и сервисные учётные записи плагинов MUST описываться blueprints в `auth/blueprints/` и MUST применяться автоматически при запуске Authentik. Поток входа MUST идти так: почта или имя пользователя → пароль, только если у пользователя задан пароль → второй фактор кодом на почту (устройство настраивается при первом входе, если его нет) → вход. Код MUST действовать 10 минут. Поток входа MUST быть привязан к бренду домена Authentik (`AUTH_BRAND_DOMAIN`, с портом, если Authentik открывают по адресу с портом) и MUST NOT зависеть от других blueprints, потому что порядок их применения не определён. Конфигурация MUST воспроизводиться на пустой схеме без ручных шагов в интерфейсе, кроме создания первого администратора.

#### Scenario: Пустая схема
- GIVEN схема `authentik` пуста
- WHEN запускаются сервер и worker Authentik
- THEN MUST существовать группы `screenwriters`, `editors`, `admins`, OIDC-приложение фронтенда и сопоставление групп и scopes

#### Scenario: Вход с двумя факторами
- GIVEN пользователь группы `screenwriters` с паролем
- WHEN он проходит поток входа с верным паролем
- THEN поток MUST отправить код на его почту и MUST NOT выдавать токен без этого кода

#### Scenario: Пользователь без пароля
- GIVEN у пользователя не задан пароль
- WHEN он вводит почту в потоке входа
- THEN поток MUST перейти сразу к коду на почту, не спрашивая пароль

#### Scenario: Бренд с портом
- GIVEN `AUTH_BRAND_DOMAIN=localhost:9000` и Authentik открыт по `http://localhost:9000`
- WHEN запрашивается `/api/v3/core/brands/current/`
- THEN ответ MUST содержать поток входа `authorled-authentication`

### Requirement: Вход фронтенда
Фронтенды (веб, мобильное, десктоп) MUST получать токены в Authentik по OIDC и передавать Access Token в запросах к API Agno как `Authorization: Bearer`. Веб-фронтенд MUST проходить шаги потока входа своими экранами через API шагов входа Authentik (`/api/v3/flows/executor/…`, сброс незаконченного входа — `/flows/-/cancel/`), открытый на адресе фронтенда (прокси сервера разработки, в проде — обратный прокси с общим доменом cookie `AUTHENTIK_COOKIE_DOMAIN`), а затем получать токены по OIDC без повторного ввода. Выход MUST завершать и сессию Authentik (поток выхода продукта) и MUST возвращать на `AUTH_FRONTEND_LOGOUT_URI` без страниц Authentik. Промежуточный бэкенд между фронтендом и AgentOS MUST NOT использоваться. Authentik MUST выдавать токены только приложениям, зарегистрированным в blueprints.

#### Scenario: Вход и запрос
- GIVEN пользователь прошёл экраны входа фронтенда
- WHEN фронтенд получает Access Token по OIDC
- THEN Authentik MUST выдать токен без своей страницы входа, и запрос к API Agno с этим токеном MUST выполняться от `user_id` пользователя

#### Scenario: Выход завершает сессию Authentik
- GIVEN пользователь вошёл
- WHEN он выходит из фронтенда
- THEN браузер MUST вернуться на `AUTH_FRONTEND_LOGOUT_URI`, и следующий запуск потока входа MUST начинаться с почты, а не с готовой сессии

## ADDED Requirements

### Requirement: Почта Authentik
Authentik MUST отправлять письма (коды входа) через SMTP из переменных `AUTHENTIK_EMAIL__HOST`, `AUTHENTIK_EMAIL__PORT`, `AUTHENTIK_EMAIL__USERNAME`, `AUTHENTIK_EMAIL__PASSWORD`, `AUTHENTIK_EMAIL__USE_TLS`, `AUTHENTIK_EMAIL__USE_SSL` и `AUTHENTIK_EMAIL__FROM`; недостающая переменная MUST останавливать запуск с её именем. В разработке письма MUST уходить в локальный Mailpit и MUST быть видны на `http://localhost:8025`; в production Mailpit MUST NOT запускаться.

#### Scenario: Код в Mailpit
- GIVEN локальный стенд с Mailpit
- WHEN пользователь проходит пароль в потоке входа
- THEN письмо с кодом MUST появиться в Mailpit на его адрес

#### Scenario: Нет SMTP
- GIVEN `AUTHENTIK_EMAIL__HOST` не задан в `.env`
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей `AUTHENTIK_EMAIL__HOST`

#### Scenario: Mailpit не в проде
- GIVEN конфигурация production (`compose.yaml` с `compose.prod.yaml`)
- WHEN выполняется `docker compose config --services`
- THEN списка MUST NOT содержать Mailpit

### Requirement: Пользователи для разработки
Команда `./scripts/dev.sh auth-users` MUST создавать или обновлять в локальном Authentik пользователей `writer@authorled.test` («Сценарист», группа `screenwriters`) и `editor@authorled.test` («Редактор», группа `editors`) с паролем из `AUTH_DEV_USER_PASSWORD`. Без `AUTH_DEV_USER_PASSWORD` команда MUST завершаться ошибкой с именем переменной. Blueprint этих пользователей MUST NOT применяться автоматически и MUST NOT применяться при `RUNTIME_ENV`, отличном от `dev`.

#### Scenario: Создание пользователей
- GIVEN локальный стенд запущен и `AUTH_DEV_USER_PASSWORD` задан
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN в Authentik MUST существовать оба пользователя в своих группах

#### Scenario: Не в проде
- GIVEN `RUNTIME_ENV=prd`
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN команда MUST завершиться ошибкой и MUST NOT создавать пользователей

## MODIFIED Requirements

### Requirement: Конфигурация из blueprints
Группы (`screenwriters`, `editors`, `admins`, `plugins`), OIDC-приложение и провайдер для фронтенда, поток входа, поток регистрации, сопоставление групп и scopes и сервисные учётные записи плагинов MUST описываться blueprints в `auth/blueprints/` и MUST применяться автоматически при запуске Authentik и при каждом деплое сервера, в том числе когда изменились только значения настроек, на которые blueprints ссылаются, а сами файлы нет. Если применение blueprints при деплое не удалось, деплой MUST завершиться ошибкой. Поток входа MUST идти так: почта или имя пользователя → пароль, только если у пользователя задан пароль → второй фактор кодом на почту (устройство настраивается при первом входе, если его нет) → вход. Код MUST действовать 10 минут. Шаг почты потока входа MUST знать поток регистрации `authorled-enrollment`. Поток входа MUST быть привязан к бренду домена Authentik (`AUTH_BRAND_DOMAIN`, с портом, если Authentik открывают по адресу с портом) и MUST NOT зависеть от других blueprints, потому что порядок их применения не определён. Конфигурация MUST воспроизводиться на пустой схеме без ручных шагов в интерфейсе, кроме создания первого администратора.

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

#### Scenario: Поток регистрации на пустой схеме
- GIVEN схема `authentik` пуста
- WHEN запускаются сервер и worker Authentik
- THEN MUST существовать поток `authorled-enrollment`, и шаг почты потока `authorled-authentication` MUST ссылаться на него

#### Scenario: Новые адреса из настроек
- GIVEN на сервере в env заменены `AUTH_FRONTEND_REDIRECT_URI`, `AUTH_FRONTEND_LOGOUT_URI` и `AUTH_BRAND_DOMAIN`, а файлы blueprints не менялись
- WHEN проходит деплой релиза
- THEN OIDC-провайдер фронтенда MUST принимать только новые адреса возврата и выхода
- AND `/api/v3/core/brands/current/` на новом домене Authentik MUST содержать поток входа `authorled-authentication`

#### Scenario: Сбой применения при деплое
- GIVEN blueprint не применяется (например, ссылается на настройку, которой нет)
- WHEN проходит деплой релиза
- THEN деплой MUST завершиться ошибкой с именем blueprint

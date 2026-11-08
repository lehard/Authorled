## MODIFIED Requirements

### Requirement: Пользователи для разработки
Команда `./scripts/dev.sh auth-users` MUST создавать или обновлять в локальном Authentik пользователей `writer@authorled.test` («Сценарист», группа `screenwriters`) и `editor@authorled.test` («Редактор», группа `editors`) с паролем из `AUTH_DEV_USER_PASSWORD`. Без `AUTH_DEV_USER_PASSWORD` команда MUST завершаться ошибкой с именем переменной. Blueprint этих пользователей MUST NOT применяться автоматически и MUST NOT применяться при `RUNTIME_ENV`, отличном от `dev`.

Та же команда MUST создавать или обновлять у `writer@authorled.test` бессрочный пароль приложения Authentik со значением из `AUTH_DEV_WRITER_TOKEN`; без `AUTH_DEV_WRITER_TOKEN` команда MUST завершаться ошибкой с именем переменной до изменения пользователей. У `editor@authorled.test` пароля приложения MUST NOT быть. `compose.yaml` и `compose.prod.yaml` MUST NOT требовать `AUTH_DEV_WRITER_TOKEN`.

#### Scenario: Создание пользователей
- GIVEN локальный стенд запущен и `AUTH_DEV_USER_PASSWORD` задан
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN в Authentik MUST существовать оба пользователя в своих группах

#### Scenario: Не в проде
- GIVEN `RUNTIME_ENV=prd`
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN команда MUST завершиться ошибкой и MUST NOT создавать пользователей

#### Scenario: Пароль приложения writer
- GIVEN локальный стенд запущен, `AUTH_DEV_USER_PASSWORD` и `AUTH_DEV_WRITER_TOKEN` заданы
- WHEN выполняется `./scripts/dev.sh auth-users`, затем запрос токена `client_credentials` с `username=writer` и паролем `AUTH_DEV_WRITER_TOKEN`
- THEN Authentik MUST выдать Access Token с `sub` пользователя `writer`, группой `screenwriters` и claims `email` и `name`

#### Scenario: Нет AUTH_DEV_WRITER_TOKEN
- GIVEN `AUTH_DEV_WRITER_TOKEN` не задан или равен `***`
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN команда MUST завершиться ошибкой, называющей `AUTH_DEV_WRITER_TOKEN`, и MUST NOT менять пользователей

## ADDED Requirements

### Requirement: Полномочия запуска для доверенного кода
Модуль MUST давать коду разработки (eval) удостоверение `writer@authorled.test` для запуска агента в процессе. Модуль MUST получать токен у локального Authentik по паролю приложения из `AUTH_DEV_WRITER_TOKEN`, проверять его так же, как токены запросов («Проверка токена», «Контракт токена»), и отдавать полномочия запуска с `sub`, группами и scopes токена, а также почту и имя. При `RUNTIME_ENV`, отличном от `dev`, модуль MUST отказывать без запроса к Authentik.

#### Scenario: Проверенное удостоверение
- GIVEN `RUNTIME_ENV=dev`, `AUTH_DEV_WRITER_TOKEN` задан и Authentik выдаёт токен `writer`
- WHEN код разработки запрашивает удостоверение
- THEN `Principal`, который агент получает в запуске с этими полномочиями, MUST иметь `user_id`, равный `sub` токена, и группу `screenwriters`

#### Scenario: Токен не проходит проверку
- GIVEN Authentik выдал токен с чужим издателем, чужой аудиторией, подписью не ключом из `JWT_JWKS_FILE`, истёкшим сроком или без claim `groups`
- WHEN код разработки запрашивает удостоверение
- THEN модуль MUST завершиться ошибкой, называющей причину, и MUST NOT отдавать полномочия

#### Scenario: Отказ вне локального стенда
- GIVEN `RUNTIME_ENV=prd`
- WHEN код разработки запрашивает удостоверение
- THEN модуль MUST завершиться ошибкой и MUST NOT обращаться к Authentik

#### Scenario: Секреты не печатаются
- GIVEN любой исход запроса удостоверения
- WHEN модуль пишет сообщение об ошибке или в лог
- THEN в нём MUST NOT быть значения `AUTH_DEV_WRITER_TOKEN` и выданного токена

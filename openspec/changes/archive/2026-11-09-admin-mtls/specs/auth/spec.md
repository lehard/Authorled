# Spec Delta

## MODIFIED Requirements

### Requirement: Интерфейс Authentik
Интерфейс Authentik (вход, профиль, сброс пароля) MUST быть доступен на домене Authentik (`AUTH_BRAND_DOMAIN`). Административная часть MUST быть доступна только на адресе админки (`AUTH_ADMIN_DOMAIN`) и только пользователям группы `admins`. Когда адрес админки отличается от домена Authentik, административная часть на домене Authentik MUST отвечать `404`. Сервер Authentik MUST NOT быть опубликован на внешних интерфейсах хоста напрямую в обход обратного прокси.

#### Scenario: Админка не-администратору
- GIVEN вошёл пользователь группы `screenwriters`
- WHEN он открывает административную часть Authentik
- THEN доступ MUST быть отклонён

#### Scenario: Админка на домене Authentik
- GIVEN конфигурация production, `AUTH_BRAND_DOMAIN=auth.soavtor.app`, `AUTH_ADMIN_DOMAIN=admin.soavtor.app`
- WHEN клиент открывает `https://auth.soavtor.app/if/admin/`
- THEN ответ MUST быть `404`

#### Scenario: Админка на своём адресе
- GIVEN конфигурация production и браузер с клиентским сертификатом владельца
- WHEN он открывает `https://admin.soavtor.app/if/admin/` без сессии
- THEN MUST открыться поток входа `authorled-authentication`

#### Scenario: Порты хоста
- GIVEN запущена конфигурация production
- WHEN проверяются опубликованные порты сервера Authentik
- THEN они MUST быть привязаны к `127.0.0.1`

## ADDED Requirements

### Requirement: Вход суперпользователя
Поток входа `authorled-authentication` MUST отказывать пользователю с правами суперпользователя Authentik, если вход идёт не через адрес админки `AUTH_ADMIN_DOMAIN`, до шага пароля и до отправки кода, и MUST NOT создавать ему сессию. Хост админки MUST иметь свой бренд с этим потоком входа. `AUTH_ADMIN_DOMAIN` MUST быть задан явно, без значения по умолчанию; на локальном стенде он равен `AUTH_BRAND_DOMAIN`. Подставить адрес админки запросом к другому адресу MUST NOT быть возможно.

#### Scenario: Суперпользователь на публичном адресе
- GIVEN `akadmin` с правами суперпользователя
- WHEN он вводит почту в потоке входа через `app.soavtor.app` или `auth.soavtor.app`
- THEN поток MUST отказать сообщением «Администратор входит только через адрес админки.»
- AND пароль MUST NOT спрашиваться, код MUST NOT отправляться, сессия MUST NOT создаваться

#### Scenario: Суперпользователь на адресе админки
- GIVEN `akadmin` и браузер с клиентским сертификатом владельца
- WHEN он проходит поток входа на `admin.soavtor.app`
- THEN поток MUST спросить пароль и код и MUST открыть админку

#### Scenario: Автор на публичном адресе
- GIVEN пользователь группы `screenwriters`
- WHEN он входит через `app.soavtor.app`
- THEN поток MUST идти как раньше: пароль, если он задан, затем код

#### Scenario: Подмена адреса
- GIVEN запрос к `auth.soavtor.app` с заголовком `Host` или `X-Forwarded-Host`, равным `admin.soavtor.app`
- WHEN `akadmin` проходит поток входа этим запросом
- THEN поток MUST отказать так же, как на публичном адресе, или запрос MUST быть отклонён обратным прокси

#### Scenario: Подмена изнутри сети
- GIVEN запрос к `authentik-server:9000` из другого контейнера сети Docker с `X-Forwarded-Host`, равным адресу админки
- WHEN `akadmin` проходит этим запросом поток входа
- THEN поток MUST отказать так же, как на публичном адресе

#### Scenario: Нет настройки
- GIVEN в env нет `AUTH_ADMIN_DOMAIN`
- WHEN запускается Authentik
- THEN запуск MUST завершиться ошибкой с именем настройки

#### Scenario: Локальный стенд
- GIVEN `AUTH_ADMIN_DOMAIN=localhost:9000` и `AUTH_BRAND_DOMAIN=localhost:9000`
- WHEN `akadmin` входит на `http://localhost:9000`
- THEN поток MUST пустить его в админку

### Requirement: Потоки на публичных адресах
На публичных адресах (домен Authentik и домен сервиса) MUST быть доступны только потоки продукта `authorled-authentication`, `authorled-enrollment`, `authorled-invalidation` и поток согласия OIDC-провайдера фронтенда: их страницы и API шагов. Запросы к другим потокам (в том числе к потокам Authentik по умолчанию) на этих адресах MUST получать `404`. На адресе админки ограничение MUST NOT действовать.

#### Scenario: Поток по умолчанию на домене Authentik
- GIVEN конфигурация production
- WHEN клиент запрашивает `https://auth.soavtor.app/api/v3/flows/executor/default-authentication-flow/`
- THEN ответ MUST быть `404`

#### Scenario: Поток по умолчанию через домен сервиса
- GIVEN конфигурация production
- WHEN клиент запрашивает `https://app.soavtor.app/api/v3/flows/executor/default-authentication-flow/`
- THEN ответ MUST быть `404`

#### Scenario: Поток продукта
- GIVEN конфигурация production
- WHEN фронтенд запрашивает `https://app.soavtor.app/api/v3/flows/executor/authorled-authentication/`
- THEN запрос MUST дойти до Authentik

#### Scenario: Вход по OIDC
- GIVEN автор без сессии
- WHEN фронтенд начинает вход по OIDC на `auth.soavtor.app`
- THEN Authentik MUST провести его через `authorled-authentication` и поток согласия и выдать код авторизации

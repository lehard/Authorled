# Spec Delta

## ADDED Requirements

### Requirement: Настройки админки
Поля админки MUST задаваться blueprints только при создании объекта и MUST NOT меняться при повторном применении blueprints. Это заголовки и имена потоков `authorled-authentication`, `authorled-enrollment` и `authorled-invalidation`, заголовок бренда домена `AUTH_BRAND_DOMAIN`, тема письма с кодом и число неудачных попыток пароля до сброса входа. Остальные поля объектов из blueprints MUST восстанавливаться при каждом применении изменённого blueprint.

#### Scenario: Правка в админке переживает релиз
- GIVEN администратор изменил в админке заголовок бренда, тему письма с кодом и число попыток пароля
- WHEN применяются blueprints с изменённым содержимым файлов
- THEN эти три значения MUST остаться такими, какими их задал администратор

#### Scenario: Поле репозитория восстанавливается
- GIVEN администратор изменил в админке срок кода или адрес возврата провайдера
- WHEN применяется изменённый blueprint, который объявляет этот объект
- THEN значение MUST вернуться к значению из blueprint

#### Scenario: Пустая схема получает значения из репозитория
- GIVEN схема `authentik` пуста
- WHEN запускаются сервер и worker Authentik
- THEN заголовки потоков, заголовок бренда, тема письма и число попыток пароля MUST совпадать со значениями из blueprints

### Requirement: Список разрешённых почт
Список разрешённых почт MUST храниться в атрибуте `allowed_emails` группы `screenwriters`: это список строк, задаётся в админке Authentik. Blueprints MUST NOT задавать и менять этот атрибут, кроме blueprint пользователей для разработки. Изменение атрибута MUST действовать на следующую попытку регистрации, без релиза и перезапуска. Реальные почты MUST NOT попадать в репозиторий.

#### Scenario: Почта добавлена в админке
- GIVEN почты `new@authorled.test` нет в `allowed_emails`
- WHEN администратор добавляет её в атрибут, и сразу после этого проходится поток регистрации с этой почтой
- THEN проверка списка MUST пройти без перезапуска контейнеров

#### Scenario: Релиз не трогает список
- GIVEN в `allowed_emails` записан список почт
- WHEN применяются blueprints с изменённым содержимым файлов
- THEN атрибут MUST остаться прежним

#### Scenario: Нет атрибута
- GIVEN у группы `screenwriters` нет атрибута `allowed_emails`
- WHEN поток регистрации получает почту и имя
- THEN поток MUST отказать с ошибкой «Регистрация временно недоступна.»
- AND пользователь MUST NOT появиться, письмо MUST NOT уйти
- AND в журнале событий Authentik MUST появиться событие `configuration_error` с текстом, называющим `allowed_emails` и группу `screenwriters`

#### Scenario: Неверный атрибут
- GIVEN `allowed_emails` группы `screenwriters` — не список строк (например, строка `a@b.ru` или список с числом)
- WHEN поток регистрации получает почту и имя
- THEN поток MUST вести себя так же, как без атрибута

#### Scenario: Пустой список
- GIVEN `allowed_emails: []`
- WHEN поток регистрации получает любую почту
- THEN поток MUST отказать с ошибкой «Регистрация сейчас доступна только по приглашению.»

## MODIFIED Requirements

### Requirement: Конфигурация из blueprints
Группы (`screenwriters`, `editors`, `admins`, `plugins`), OIDC-приложение и провайдер для фронтенда, поток входа, поток регистрации, сопоставление групп и scopes и сервисные учётные записи плагинов MUST описываться blueprints в `auth/blueprints/` и MUST применяться автоматически при запуске Authentik и при каждом деплое сервера, в том числе когда изменились только значения настроек, на которые blueprints ссылаются, а сами файлы нет. Если применение blueprints при деплое не удалось, деплой MUST завершиться ошибкой. Поток входа MUST идти так: почта или имя пользователя → пароль, только если у пользователя задан пароль → второй фактор кодом на почту (устройство настраивается при первом входе, если его нет) → вход. Код MUST действовать 10 минут. Шаг почты потока входа MUST знать поток регистрации `authorled-enrollment`. Поток входа MUST быть привязан к бренду домена Authentik (`AUTH_BRAND_DOMAIN`, с портом, если Authentik открывают по адресу с портом) и MUST NOT зависеть от других blueprints, потому что порядок их применения не определён. Конфигурация MUST воспроизводиться на пустой схеме без ручных шагов в интерфейсе, кроме создания первого администратора и заполнения списка разрешённых почт.

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

### Requirement: Регистрация
Регистрация MUST быть открыта почтам из списка разрешённых почт (атрибут `allowed_emails` группы `screenwriters`), без приглашений и одобрения; список из одного элемента `*` MUST открывать её всем. Почты MUST сравниваться без учёта регистра и без пробелов по краям. Почте не из списка поток `authorled-enrollment` MUST отказывать с ошибкой «Регистрация сейчас доступна только по приглашению.» раньше других проверок почты, MUST NOT создавать пользователя и MUST NOT отправлять письмо. Поток регистрации MUST принимать почту и непустое имя, MUST NOT спрашивать пароль и MUST отказывать, если пользователь с такой почтой уже есть. Он MUST создавать пользователя с этой почтой, именем и группой `screenwriters`, затем MUST отправлять на почту код (6 цифр, 10 минут) и MUST завершаться входом только после верного кода.

#### Scenario: Новая почта
- GIVEN пользователя с почтой `new@authorled.test` нет, и она разрешена
- WHEN проходится поток регистрации с этой почтой, именем «Анна Северова» и верным кодом из письма
- THEN в Authentik MUST существовать активный пользователь с этой почтой и именем в группе `screenwriters` и с подтверждённым устройством для кода
- AND сессия Authentik MUST позволять получить токен по OIDC без страницы Authentik

#### Scenario: Почта уже есть
- GIVEN пользователь с почтой `writer@authorled.test` существует, и она разрешена
- WHEN поток регистрации получает эту почту
- THEN поток MUST отказать с ошибкой «Аккаунт с такой почтой уже есть.» и MUST NOT создавать второго пользователя

#### Scenario: Пустое имя
- GIVEN поток регистрации и разрешённая почта
- WHEN он получает пустое имя
- THEN поток MUST вернуть ошибку у поля имени

#### Scenario: Почта не из списка
- GIVEN `allowed_emails: ["tester@authorled.test"]`
- WHEN поток регистрации получает `stranger@authorled.test`
- THEN поток MUST отказать с ошибкой «Регистрация сейчас доступна только по приглашению.»
- AND пользователь MUST NOT появиться, и письмо MUST NOT уйти

#### Scenario: Занятая почта не из списка
- GIVEN пользователь `old@authorled.test` существует, а почты нет в `allowed_emails`
- WHEN поток регистрации получает эту почту
- THEN отказ MUST совпадать с отказом для незнакомой почты не из списка

#### Scenario: Другой регистр
- GIVEN `allowed_emails: ["Tester@Authorled.test"]`
- WHEN поток регистрации получает `tester@authorled.test`
- THEN проверка списка MUST пройти

#### Scenario: Регистрация открыта всем
- GIVEN `allowed_emails: ["*"]`
- WHEN поток регистрации получает новую почту и имя
- THEN проверка списка MUST пройти

### Requirement: Пользователи для разработки
Команда `./scripts/dev.sh auth-users` MUST создавать или обновлять в локальном Authentik пользователей `writer@authorled.test` («Сценарист», группа `screenwriters`) и `editor@authorled.test` («Редактор», группа `editors`) с паролем из `AUTH_DEV_USER_PASSWORD` и MUST открывать локальную регистрацию всем (`allowed_emails: ["*"]` у группы `screenwriters`). Без `AUTH_DEV_USER_PASSWORD` команда MUST завершаться ошибкой с именем переменной. Blueprint этих пользователей MUST NOT применяться автоматически и MUST NOT применяться при `RUNTIME_ENV`, отличном от `dev`.

Та же команда MUST создавать или обновлять у `writer@authorled.test` бессрочный пароль приложения Authentik со значением из `AUTH_DEV_WRITER_TOKEN`; без `AUTH_DEV_WRITER_TOKEN` команда MUST завершаться ошибкой с именем переменной до изменения пользователей. У `editor@authorled.test` пароля приложения MUST NOT быть. `compose.yaml` и `compose.prod.yaml` MUST NOT требовать `AUTH_DEV_WRITER_TOKEN`.

#### Scenario: Создание пользователей
- GIVEN локальный стенд запущен и `AUTH_DEV_USER_PASSWORD` задан
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN в Authentik MUST существовать оба пользователя в своих группах
- AND у группы `screenwriters` MUST быть `allowed_emails: ["*"]`

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

## REMOVED Requirements

### Requirement: Настройка разрешённых почт
**Reason**: список разрешённых почт переезжает из окружения в атрибут группы `screenwriters`, который меняется в админке без перезапуска (требование «Список разрешённых почт»).
**Migration**: перед релизом перенести почты из `AUTH_ALLOWED_EMAILS` в `/etc/authorled/authorled.env` в атрибут `allowed_emails` группы `screenwriters` (значение `*` становится `["*"]`), затем удалить переменную из `.env` всех стендов. На локальном стенде выполнить `./scripts/dev.sh auth-users`.

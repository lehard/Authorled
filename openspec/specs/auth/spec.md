# Auth Specification

## Purpose
Модуль авторизации `auth`: полный Authentik как Identity Provider проекта, проверка его токенов в AgentOS, сопоставление групп и прав, изоляция данных пользователей и контракт, через который остальные модули узнают, кто вызывает API и что ему разрешено.

## Requirements

### Requirement: Состав и границы модуля
Модуль `auth` MUST состоять из двух частей:
- деплой-часть — каталог `auth/` в корне репозитория;
- кодовая часть — `agno/app/auth/` в модуле бэкенда.

Вне `auth/` MUST NOT находиться настройки Authentik (blueprints, оформление, инициализация БД) и объявления его сервисов. Сервисы модуля (инициализация БД Authentik, сервер, worker, выгрузка ключей) MUST объявляться во фрагменте `auth/compose.yaml`, который корневой `compose.yaml` MUST подключать через `include`. Вне фрагмента MUST оставаться только его подключение и зависимости других сервисов от сервисов модуля.

Вне `agno/app/auth/` код MUST NOT читать JWT и claims токена и MUST NOT импортировать что-либо из Authentik. Остальные модули MUST получать удостоверение только через `Principal` и проверять доступ к проекту только через интерфейс модуля.

#### Scenario: Claims читаются только в модуле
- GIVEN репозиторий собран
- WHEN выполняется поиск обращений к JWT, claims и Authentik в Python-коде вне `agno/app/auth/`
- THEN обращений MUST NOT быть

#### Scenario: Настройки Authentik в одном месте
- GIVEN репозиторий собран
- WHEN выполняется поиск конфигурации Authentik (blueprints, `AUTHENTIK_*`) вне `auth/`, `compose.prod.yaml`, `example.env`, `scripts/` и документации
- THEN конфигурации MUST NOT быть

#### Scenario: Сервисы Authentik во фрагменте модуля
- GIVEN репозиторий собран
- WHEN выполняется поиск объявлений сервисов с образом Authentik вне `auth/compose.yaml`
- THEN объявлений MUST NOT быть
- AND `docker compose config` MUST содержать сервисы `authentik-db-init`, `authentik-server`, `authentik-worker` и `authentik-jwks-export`

#### Scenario: Конфигурация не изменилась
- GIVEN один и тот же `.env`
- WHEN сравниваются результаты `docker compose config` до и после переноса модуля из `modules/auth/` в `auth/`
- THEN образы, команды, порты, переменные окружения, тома и зависимости сервисов модуля MUST совпадать, кроме путей к файлам на хосте

### Requirement: Principal
Для каждого запроса с действительным токеном модуль MUST предоставлять `Principal` с `user_id` (значение claim `sub`), списком групп и списком scopes. Свои маршруты приложения (`/api/v1/*`, ADR-002) MUST получать `Principal` через зависимость `current_principal`. Если токен отсутствует или недействителен, зависимость MUST NOT возвращать значение и запрос MUST завершаться `401`; значения `user_id` по умолчанию MUST NOT подставляться.

#### Scenario: Действительный токен
- GIVEN пользователь вошёл в Authentik и получил Access Token
- WHEN клиент вызывает защищённый маршрут с `Authorization: Bearer <токен>`
- THEN `Principal.user_id` MUST быть равен `sub` токена
- AND группы и scopes MUST соответствовать токену

#### Scenario: Токена нет
- GIVEN авторизация включена
- WHEN клиент вызывает защищённый маршрут без токена
- THEN система MUST вернуть `401` до выполнения обработчика

### Requirement: Проверка токена
Система MUST проверять подпись, срок действия, издателя (`iss`) и аудиторию (`aud`) каждого Bearer-токена до выполнения бизнес-логики и до любого вызова LLM. Токен с неверной подписью, просроченный, с чужим издателем или аудиторией MUST отклоняться ответом `401`. Токены MUST выпускаться Authentik и подписываться его ключом (с публикацией открытых ключей), а не секретом клиента.

#### Scenario: Подделанный токен
- GIVEN токен подписан ключом, которого нет среди ключей Authentik
- WHEN клиент вызывает `POST /agents/{agent_id}/runs`
- THEN система MUST вернуть `401`
- AND LLM MUST NOT вызываться

#### Scenario: Просроченный токен
- GIVEN срок действия токена истёк
- WHEN клиент вызывает любой защищённый маршрут
- THEN система MUST вернуть `401`

#### Scenario: Чужая аудитория
- GIVEN токен выдан для другого приложения Authentik
- WHEN клиент вызывает защищённый маршрут
- THEN система MUST вернуть `401`

### Requirement: Права по группам
Группы Authentik (`screenwriters`, `editors`, `admins`, `plugins`, `routines`) MUST сопоставляться с правами (scopes) AgentOS; набор прав каждой группы MUST задаваться модулем `auth` в коде и MUST заменять сохранённый при каждом запуске. Группы авторов (`screenwriters`, `editors`) MUST получать право запуска только продуктовых агентов, по одному scope на агента (`agents:<id>:run`, сейчас — `agents:coauthor:run`); общие права запуска агентов, команд и workflows (`agents:run`, `agents:*:run` и т. п.) группам авторов, плагинов и Routines MUST NOT выдаваться: платформенные агенты (OS Manager, `claude-engineer`) исполняют команды и правят файлы на сервере. Маршрут или агент, требующий scope, которого нет в токене, MUST отвечать `403` до запуска LLM. Группа `admins` MUST получать административные scopes; группы `screenwriters` и `editors` MUST получать только перечисленные в сопоставлении. Группа `routines` MUST получать только права Routine Company Manager: запуск `company-manager-internal` и чтение его запусков (`agents:company-manager-internal:run`, `agents:company-manager-internal:read`), чтение и правку Routines и расписаний, чтение Products, Sources, Projects, Tasks, wiki и решений Company, создание и правку Projects и Tasks и запись решений Company; административные scopes и удаление записей Company ей MUST NOT выдаваться.

#### Scenario: Нет нужного scope
- GIVEN токен пользователя группы `screenwriters`, в сопоставлении которой нет scope маршрута
- WHEN клиент вызывает этот маршрут
- THEN система MUST вернуть `403`
- AND LLM MUST NOT вызываться

#### Scenario: Scope есть
- GIVEN токен пользователя группы, scopes которой включают scope маршрута
- WHEN клиент вызывает этот маршрут
- THEN система MUST выполнить запрос

#### Scenario: Автор и платформенный агент
- GIVEN токен пользователя группы `screenwriters`
- WHEN клиент вызывает `POST /agents/claude-engineer/runs`
- THEN система MUST вернуть `403`

#### Scenario: Автор и соавтор
- GIVEN токен пользователя группы `editors`
- WHEN клиент вызывает `POST /agents/coauthor/agui`
- THEN система MUST выполнить запрос

#### Scenario: Routines и другие агенты
- GIVEN токен сервисной учётной записи группы `routines`
- WHEN клиент вызывает `POST /agents/os-manager-internal/runs`, `POST /agents/claude-engineer/runs` или `POST /agents/coauthor/agui`
- THEN система MUST вернуть `403`
- AND LLM MUST NOT вызываться

#### Scenario: Routines и маршруты администратора
- GIVEN токен сервисной учётной записи группы `routines`
- WHEN клиент вызывает `GET /users`
- THEN система MUST вернуть `403`

#### Scenario: Routines и Routine Company
- GIVEN токен сервисной учётной записи группы `routines`
- WHEN клиент вызывает `GET /company/routines`
- THEN система MUST вернуть `200`

### Requirement: Изоляция данных Agno
Система MUST хранить и читать сессии, память и обучение Agno под `user_id`, равным `sub` токена; пользователь MUST NOT получать данные Agno другого пользователя. Эта изоляция MUST NOT считаться защитой данных произведения.

#### Scenario: Чужая сессия
- GIVEN пользователи A и B создали по сессии
- WHEN пользователь A запрашивает `GET /sessions/{session_id}` для сессии пользователя B
- THEN сессия B MUST NOT быть возвращена

#### Scenario: user_id в записях
- GIVEN пользователь A создал сессию
- WHEN читается запись сессии в БД Agno
- THEN её `user_id` MUST совпадать с `sub` токена пользователя A

### Requirement: Доступ к проекту
Модуль MUST предоставлять интерфейс проверки доступа к проекту, принимающий `Principal` и идентификатор проекта и возвращающий решение «разрешено» или «запрещено». Источник ролей в проекте MUST подключаться ядром. «Разрешено» MUST означать, что у пользователя есть любая роль в проекте (владелец или участник); какое действие разрешено роли, MUST решать ядро (`api/story-sharing`, «Права ролей»). Пока источник не подключён, вызов интерфейса MUST завершаться явной ошибкой и MUST NOT возвращать «разрешено». Маршрут, получивший «запрещено», MUST отвечать `404` или `403`.

#### Scenario: Источник ролей не подключён
- GIVEN ядро ещё не подключило источник ролей
- WHEN код вызывает интерфейс проверки доступа
- THEN вызов MUST завершиться ошибкой с сообщением, что источник ролей не настроен
- AND решение «разрешено» MUST NOT быть возвращено

#### Scenario: Чужой проект
- GIVEN источник ролей подключён и пользователь A не имеет доступа к проекту P
- WHEN клиент вызывает маршрут проекта P с токеном пользователя A
- THEN система MUST вернуть `404` или `403`

#### Scenario: Участник проекта
- GIVEN пользователь A — читатель проекта P
- WHEN код вызывает интерфейс проверки доступа для A и P
- THEN решение MUST быть «разрешено»

### Requirement: Ключи проверки
Система MUST загружать ключи проверки подписи из файла `JWT_JWKS_FILE`, содержащего открытые ключи Authentik. Если ключ проверки не задан или файл не читается, приложение MUST завершать запуск с ошибкой, называющей причину, при любом `RUNTIME_ENV`. Модуль MUST выгружать ключи из работающего Authentik в этот файл автоматическим шагом запуска, а не вручную: шаг MUST ждать появления ключей (провайдер создаётся blueprints уже после того, как сервер здоров) ограниченное время и MUST завершаться ошибкой по его истечении; API MUST стартовать только после успешной выгрузки; после повторной выгрузки и перезапуска API токены, подписанные удалёнными ключами, MUST отклоняться.

#### Scenario: Нет файла ключей
- GIVEN `JWT_JWKS_FILE` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой
- AND API MUST NOT начать обслуживать запросы

#### Scenario: Ротация ключа
- GIVEN в Authentik заменён ключ подписи, файл ключей выгружен заново и API перезапущен
- WHEN клиент вызывает защищённый маршрут с токеном, подписанным прежним ключом
- THEN система MUST вернуть `401`

### Requirement: Хранение данных Authentik
Authentik MUST использовать общую PostgreSQL проекта и схему `authentik`; схема `ai` MUST оставаться за Agno. Authentik MUST подключаться отдельной ролью, у которой `search_path` содержит только `authentik` и нет прав на схему `ai`. Схема и роль MUST создаваться до первого запуска Authentik; если схемы или роли нет, Authentik MUST NOT запускаться. Таблицы Authentik MUST NOT появляться в схемах `public` и `ai`. Версия Authentik дополнительно требует права `CREATE` на базу (создаёт пустую схему `template`) и на схему `public` (создаёт функции триггеров); эти права MUST выдаваться роли Authentik при инициализации, а суперпользователя роль MUST NOT быть. Изоляция MUST действовать в обе стороны: роль, под которой подключается Agno, MUST NOT иметь прав на схему `authentik` и её объекты.

#### Scenario: Состав таблиц
- GIVEN Authentik запущен на пустой базе
- WHEN в БД перечисляются таблицы по схемам
- THEN таблицы Authentik MUST находиться только в схеме `authentik`
- AND в схемах `public` и `ai` таблиц Authentik MUST NOT быть

#### Scenario: Роль Authentik не читает данные Agno
- GIVEN подключение под ролью Authentik
- WHEN выполняется `SELECT` из таблицы схемы `ai`
- THEN запрос MUST завершиться отказом в правах

#### Scenario: Роль Agno не читает данные Authentik
- GIVEN подключение под ролью, которой пользуется API Agno
- WHEN выполняется `SELECT` из таблицы схемы `authentik`
- THEN запрос MUST завершиться отказом в правах

#### Scenario: Нет схемы
- GIVEN схема `authentik` не создана
- WHEN запускается сервер Authentik
- THEN запуск MUST завершиться ошибкой

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

### Requirement: Сервисные учётные записи плагинов
Плагины (Stark, IDE) MUST обращаться к API под сервисными учётными записями Authentik, scopes которых заданы blueprints и ограничены перечнем операций плагина. Токен сервисной учётной записи MUST проходить ту же проверку, что токены пользователей.

#### Scenario: Операция вне разрешённых
- GIVEN токен сервисной учётной записи плагина без scope маршрута
- WHEN плагин вызывает этот маршрут
- THEN система MUST вернуть `403`

### Requirement: Секреты модуля
Секретный ключ Authentik, пароли ролей БД и Client Secret MUST передаваться только через переменные окружения; значения MUST NOT храниться в коде, blueprints, образах и коммитах. Недостающий обязательный секрет MUST останавливать запуск с сообщением, называющим переменную.

#### Scenario: Нет секретного ключа
- GIVEN `AUTHENTIK_SECRET_KEY` не задан в `.env`
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей `AUTHENTIK_SECRET_KEY`

### Requirement: Контракт токена
Связь бэкенда с Authentik MUST ограничиваться контрактом токена; при выносе Authentik из репозитория обе стороны MUST соблюдать этот контракт без изменений бэкенда. Access Token MUST быть JWT, подписанным алгоритмом `RS256` ключом Authentik, открытая часть которого выгружена в `JWT_JWKS_FILE`, и MUST содержать claims:
- `sub` — постоянный идентификатор пользователя или сервисной учётной записи; бэкенд MUST использовать его как `user_id`;
- `groups` — список строк из закрытого перечня `screenwriters`, `editors`, `admins`, `plugins`, `routines`;
- `iss` — равен `AUTH_ISSUER`;
- `aud` — равен `AUTH_FRONTEND_CLIENT_ID`;
- `exp` — срок действия.

Access Token пользователя (не сервисной учётной записи) MUST также содержать claims `email` (почта для входа) и `name` (имя). Бэкенд MUST использовать их только для записи пользователя продукта (`/api/v1/me`) и MUST NOT использовать для решений о доступе.

Перечень групп MUST совпадать в blueprints модуля и в сопоставлении групп и scopes; несовпадение MUST обнаруживаться проверкой репозитория (`./scripts/validate.sh`) до запуска. Бэкенд MUST NOT читать из токена другие claims для решений о доступе. Изменение состава claims, перечня групп или значений `iss`/`aud` MUST проходить через изменение этого требования.

#### Scenario: Группа есть только в blueprints
- GIVEN в blueprints модуля объявлена группа, которой нет в сопоставлении групп и scopes
- WHEN выполняется `./scripts/validate.sh`
- THEN проверка MUST завершиться ошибкой, называющей группу

#### Scenario: Группа есть только в сопоставлении
- GIVEN в сопоставлении групп и scopes есть группа, которой нет в blueprints модуля
- WHEN выполняется `./scripts/validate.sh`
- THEN проверка MUST завершиться ошибкой, называющей группу

#### Scenario: Токен без claim groups
- GIVEN токен с действительной подписью, `iss` и `aud`, но без claim `groups`
- WHEN клиент вызывает свой маршрут приложения (`/api/v1/*`)
- THEN система MUST вернуть `401`

#### Scenario: user_id из sub
- GIVEN пользователь получил Access Token Authentik
- WHEN он вызывает защищённый маршрут
- THEN `user_id` запроса MUST равняться claim `sub` токена

#### Scenario: Почта и имя в токене пользователя
- GIVEN пользователь вошёл через фронтенд
- WHEN декодируется его Access Token
- THEN токен MUST содержать непустые claims `email` и `name`, совпадающие с почтой и именем пользователя в Authentik

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

### Requirement: Брошенная регистрация
Устройство для кода MUST сохраняться только подтверждённым. Пользователь, бросивший регистрацию до кода, MUST NOT получать токен; следующий вход с его почтой MUST идти обычным путём (почта → код → вход) и MUST NOT блокироваться ошибкой об уже зарегистрированном устройстве.

#### Scenario: Брошенная регистрация
- GIVEN регистрация остановлена до ввода кода
- WHEN пользователь входит с той же почтой
- THEN поток входа MUST отправить код и после верного кода MUST завершиться входом
- AND до верного кода токен MUST NOT выдаваться

### Requirement: Почта и имя из токена
Модуль MUST предоставлять своим маршрутам приложения почту и имя пользователя из claims `email` и `name` проверенного токена через отдельную от `Principal` зависимость. Другие модули MUST NOT читать эти claims сами. Если claim отсутствует или пуст, зависимость MUST завершать запрос `403` с названием claim и MUST NOT подставлять значение по умолчанию.

#### Scenario: Почта и имя есть
- GIVEN токен пользователя с `email` = `anna@example.com` и `name` = «Анна Петрова»
- WHEN маршрут запрашивает почту и имя
- THEN он MUST получить `anna@example.com` и «Анна Петрова»

#### Scenario: Имени нет
- GIVEN действительный токен без claim `name`
- WHEN маршрут запрашивает почту и имя
- THEN запрос MUST завершиться `403` с названием `name` до выполнения обработчика

### Requirement: Refresh token фронтенда
Провайдер фронтенда MUST выдавать новый refresh token при каждом продлении и MUST отклонять повторное использование прежнего (`invalid_grant` и событие «Revoked refresh token was used» в журнале Authentik); `refresh_token_threshold` MUST оставаться `seconds=0`. Фронтенд MUST отправлять каждый refresh token в Authentik не больше одного раза.

#### Scenario: Повторное использование отклоняется
- GIVEN refresh token обменян на новые токены
- WHEN тот же refresh token отправляется в `/application/o/token/` ещё раз
- THEN Authentik MUST ответить `400` с `invalid_grant`, а новый refresh token MUST оставаться действительным

#### Scenario: Нормальная работа без событий
- GIVEN пользователь работает во фронтенде дольше срока жизни Access Token, в том числе со сном вкладки
- WHEN просматривается журнал событий Authentik
- THEN в нём MUST NOT быть событий «Revoked refresh token was used» от этого пользователя

### Requirement: Письма продукта
Письма, которые получают пользователи, MUST выглядеть как письма продукта «Соавтор»: в теме, тексте и имени отправителя MUST стоять название «Соавтор» кириллицей, а слова Authorled, CoAuthor и authentik MUST NOT встречаться. Письмо MUST NOT содержать картинок, внешних шрифтов и скриптов. Письмо MUST иметь HTML и текстовую версию с одним содержанием.

#### Scenario: Письмо с кодом
- WHEN пользователь запрашивает код входа
- THEN тема письма MUST быть «Код для входа в Соавтор»
- AND имя отправителя MUST быть «Соавтор»
- AND письмо MUST содержать код и срок его действия

#### Scenario: Имя отправителя кириллицей
- GIVEN `AUTHENTIK_EMAIL__FROM="Соавтор <noreply@soavtor.app>"`
- WHEN письмо с кодом приходит в Gmail или Яндекс Почту
- THEN почтовая программа MUST показывать отправителя как «Соавтор», без искажённых символов

#### Scenario: Без следов Authentik
- WHEN приходит письмо с кодом
- THEN в нём MUST NOT быть логотипа authentik и подписи «Powered by authentik»
- AND письмо MUST NOT иметь вложений

#### Scenario: Срок действия
- GIVEN стадия кода настроена на 10 минут
- WHEN приходит письмо с кодом
- THEN в HTML и текстовой версии MUST быть указано 10 минут

#### Scenario: Код при регистрации
- WHEN пользователь регистрируется и получает код
- THEN письмо MUST быть тем же, а код из него MUST завершить регистрацию

#### Scenario: Тёмная тема почтовой программы
- GIVEN почтовая программа показывает письма в тёмной теме
- WHEN открыто письмо с кодом
- THEN код и текст MUST оставаться читаемыми

### Requirement: Название продукта в Authentik
Названия, которые Authentik показывает людям, MUST называть продукт «Соавтор»: заголовок бренда домена продукта, заголовки потоков входа, регистрации и выхода, имя OIDC-приложения фронтенда и имя устройства кода на почту. Slug потоков и приложения MUST NOT меняться: от них зависят адреса шагов входа и издатель токенов.

#### Scenario: Бренд и потоки
- GIVEN blueprints применены
- WHEN запрашивается `/api/v3/core/brands/current/` на домене Authentik продукта
- THEN `branding_title` MUST быть «Соавтор», а поток входа MUST оставаться `authorled-authentication`
- AND заголовки потоков `authorled-authentication`, `authorled-enrollment` и `authorled-invalidation` MUST быть «Вход в Соавтор», «Регистрация в Соавторе» и «Выход из Соавтора»

#### Scenario: Вход после переименования
- GIVEN пользователь вошёл до применения новых blueprints
- WHEN blueprints применены и его Access Token истёк
- THEN фронтенд MUST продлить вход тем же refresh token без повторного входа, а издатель токенов MUST остаться прежним

### Requirement: Маршруты без токена
Проверку токена MUST проходить каждый маршрут, кроме служебных маршрутов Agno, которые он не проверяет по умолчанию (`/`, `/health`, `/info`, `/docs`, `/redoc`, `/openapi.json`, `/docs/oauth2-redirect`), маршрута заявки в бету `POST /api/v1/beta-requests` и маршрута чтения по ссылке `POST /api/v1/read-links/open`. Список исключений MUST задаваться в коде модуля `auth` полностью и явно; шаблоны, открывающие несколько маршрутов `/api/v1/` сразу, MUST NOT использоваться.

#### Scenario: Заявка без токена
- GIVEN авторизация включена
- WHEN клиент вызывает `POST /api/v1/beta-requests` без токена
- THEN система MUST выполнить обработчик заявки, а не вернуть `401`

#### Scenario: Чтение по ссылке без токена
- GIVEN авторизация включена
- WHEN клиент вызывает `POST /api/v1/read-links/open` без токена
- THEN система MUST выполнить обработчик ссылки, а не вернуть `401`

#### Scenario: Соседний маршрут остаётся закрытым
- GIVEN авторизация включена
- WHEN клиент вызывает `GET /api/v1/me`, `GET /api/v1/projects` или `GET /api/v1/drafts/{id}/read-link` без токена
- THEN система MUST вернуть `401`

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

### Requirement: Сервисная учётная запись Routines
Blueprints модуля MUST объявлять сервисную учётную запись `sa-routines`, единственную в группе `routines`. Постоянного пароля приложения у неё MUST NOT быть ни в blueprints, ни в env-файлах: пароль приложения владелец выдаёт в админке Authentik на время сохранения прав Routine и удаляет после. Её токен MUST получаться так же, как у других сервисных учётных записей (`client_credentials` с паролем приложения), и проходить ту же проверку, что токены пользователей.

#### Scenario: Учётная запись после деплоя
- GIVEN blueprints применены при запуске Authentik
- WHEN владелец открывает учётную запись `sa-routines` в админке
- THEN она MUST быть сервисной учётной записью в группе `routines`
- AND у неё MUST NOT быть паролей приложения и токенов, созданных blueprints

#### Scenario: Токен по временному паролю
- GIVEN владелец выдал `sa-routines` пароль приложения
- WHEN выполняется запрос токена `client_credentials` с `username=sa-routines` и этим паролем
- THEN Authentik MUST выдать Access Token с `sub` учётной записи и группой `routines`
- AND токен MUST проходить проверку «Проверка токена» и «Контракт токена»

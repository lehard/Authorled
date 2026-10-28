## MODIFIED Requirements

### Requirement: Состав и границы модуля
Модуль `auth` MUST состоять из деплой-части `modules/auth/` и кодовой части `app/auth/`. Вне `modules/auth/` MUST NOT находиться настройки Authentik (blueprints, оформление, инициализация БД) и объявления его сервисов: сервисы модуля (инициализация БД Authentik, сервер, worker, выгрузка ключей) MUST объявляться во фрагменте `modules/auth/compose.yaml`, который корневой `compose.yaml` MUST подключать через `include`; в корневом `compose.yaml` MUST остаться только ссылка на фрагмент и зависимости других сервисов от сервисов модуля. Вне `app/auth/` код MUST NOT читать JWT и claims токена и MUST NOT импортировать что-либо из Authentik: остальные модули MUST получать удостоверение только через `Principal` и проверять доступ к проекту только через интерфейс модуля.

#### Scenario: Claims читаются только в модуле
- GIVEN репозиторий собран
- WHEN выполняется поиск обращений к JWT, claims и Authentik в Python-коде вне `app/auth/`
- THEN обращений MUST NOT быть

#### Scenario: Настройки Authentik в одном месте
- GIVEN репозиторий собран
- WHEN выполняется поиск конфигурации Authentik (blueprints, `AUTHENTIK_*`) вне `modules/auth/`, `compose.prod.yaml`, `example.env`, `scripts/` и документации
- THEN конфигурации MUST NOT быть

#### Scenario: Сервисы Authentik во фрагменте модуля
- GIVEN репозиторий собран
- WHEN выполняется поиск объявлений сервисов с образом Authentik вне `modules/auth/compose.yaml`
- THEN объявлений MUST NOT быть
- AND `docker compose config` MUST содержать сервисы `authentik-db-init`, `authentik-server`, `authentik-worker` и `authentik-jwks-export`

#### Scenario: Конфигурация не изменилась
- GIVEN один и тот же `.env`
- WHEN сравниваются результаты `docker compose config` до и после переноса сервисов во фрагмент
- THEN образы, команды, порты, переменные окружения, тома и зависимости сервисов модуля MUST совпадать

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

## ADDED Requirements

### Requirement: Контракт токена
Связь бэкенда с Authentik MUST ограничиваться контрактом токена; при выносе Authentik из репозитория обе стороны MUST соблюдать этот контракт без изменений бэкенда. Access Token MUST быть JWT, подписанным алгоритмом `RS256` ключом Authentik, открытая часть которого выгружена в `JWT_JWKS_FILE`, и MUST содержать claims:
- `sub` — постоянный идентификатор пользователя или сервисной учётной записи; бэкенд MUST использовать его как `user_id`;
- `groups` — список строк из закрытого перечня `screenwriters`, `editors`, `admins`, `plugins`;
- `iss` — равен `AUTH_ISSUER`;
- `aud` — равен `AUTH_FRONTEND_CLIENT_ID`;
- `exp` — срок действия.

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
- WHEN клиент вызывает маршрут, объявленный через `base_app`
- THEN система MUST вернуть `401`

#### Scenario: user_id из sub
- GIVEN пользователь получил Access Token Authentik
- WHEN он вызывает защищённый маршрут
- THEN `user_id` запроса MUST равняться claim `sub` токена

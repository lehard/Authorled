## MODIFIED Requirements

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

## ADDED Requirements

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

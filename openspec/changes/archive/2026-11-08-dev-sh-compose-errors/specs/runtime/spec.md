## MODIFIED Requirements

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql`, `auth-users` (спека `auth`, «Пользователи для разработки») и `seed` («Демо-контент»). Команда `migrate` MUST запускать `agentos-db` и `agentos-db-init` и применять миграции сервисом `agentos-migrate`. Команда `test` MUST выполнять тесты хранения данных продукта на чистой базе `ai_test` (спека `core/database`, «Тесты хранения на чистой базе»). Он MUST использовать сервисы compose-файлов репозитория (`agentos-db`, `agentos-db-init`, `litellm` и сервисы модуля `auth`), а не собственные определения контейнеров, и MUST ждать их статуса `healthy` (для разовых сервисов — успешного завершения) до продолжения. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE`. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api` и `seed`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять. Если команда `docker compose`, которой `auth-users` и `seed` проверяют запущенные сервисы, сама завершается ошибкой (например, в `.env` нет переменной, которую требует compose-файл), скрипт MUST завершаться кодом 1 с сообщением о сбое `docker compose` и MUST NOT сообщать, что сервис не запущен. Сообщение о незапущенном сервисе MUST называть проект Compose и каталог, в которых искали сервис; выбирать другой проект Compose скрипт MUST NOT.

#### Scenario: Только база
- GIVEN `.env` заполнен обязательным блоком
- WHEN выполняется `./scripts/dev.sh db`
- THEN MUST быть запущен только `agentos-db` и скрипт MUST вернуть 0 после статуса `healthy`
- AND порт `127.0.0.1:5432` MUST принимать соединения пользователя `ai` к базе `ai`

#### Scenario: API на хосте
- GIVEN `.env` заполнен и `uv` установлен
- WHEN выполняется `./scripts/dev.sh api`
- THEN MUST быть запущены `agentos-db`, `litellm`, `authentik-db-init`, `authentik-server` и `authentik-worker` и дождаться `healthy` или успешного завершения
- AND `agentos-db-init`, `agentos-migrate` и `authentik-jwks-export` MUST завершиться успешно до запуска API
- AND контейнер `agentos-api` MUST быть остановлен, чтобы освободить порт 8000
- AND API MUST запускаться из `agno/` на `127.0.0.1:8000` с `--reload` по каталогам `agents`, `app`, `db`, `evals` модуля бэкенда, с `RUNTIME_ENV=dev`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_USER=agentos`, `LITELLM_URL=http://127.0.0.1:4000`, зависимостями из `agno/requirements.txt`, `.env` из корня репозитория и `JWT_JWKS_FILE`, указывающим на `auth/jwks/jwks.json`

#### Scenario: Нет .env
- GIVEN файла `.env` нет
- WHEN выполняется любая команда, кроме справки
- THEN скрипт MUST завершиться кодом 1 с сообщением о `.env` и MUST NOT запускать контейнеры

#### Scenario: Остановка сохраняет данные
- GIVEN в базе есть данные
- WHEN выполняется `./scripts/dev.sh stop`, затем `./scripts/dev.sh db`
- THEN те же данные MUST быть доступны (том `pgdata` не удалён)

#### Scenario: Сброс базы требует подтверждения
- WHEN выполняется `./scripts/dev.sh reset-db` без `--yes`
- THEN скрипт MUST завершиться ненулевым кодом, не удалив контейнер и том
- AND `./scripts/dev.sh reset-db --yes` MUST удалить контейнер `agentos-db` и том `pgdata` (вместе с данными Authentik в схеме `authentik`), а следующий `db` MUST создать пустую базу

#### Scenario: Неизвестная команда
- WHEN выполняется `./scripts/dev.sh` без аргумента или с неизвестной командой
- THEN скрипт MUST напечатать справку и завершиться кодом 2

#### Scenario: Миграции из скрипта
- GIVEN `.env` заполнен
- WHEN выполняется `./scripts/dev.sh migrate`
- THEN `agentos-db` MUST быть `healthy`, `agentos-db-init` MUST завершиться успешно
- AND миграции схемы `authorled` MUST быть применены, а скрипт MUST вернуть код `agentos-migrate`

#### Scenario: Compose не может прочитать конфигурацию
- GIVEN в `.env` нет переменной, которую требует compose-файл (например, `CLOUDRU_API_KEY`)
- WHEN выполняется `./scripts/dev.sh auth-users` или `./scripts/dev.sh seed`
- THEN после ошибки `docker compose` скрипт MUST завершиться кодом 1 с сообщением о сбое `docker compose` и подсказкой исправить `.env`
- AND вывод MUST NOT содержать сообщения, что `mailpit`, `agentos-db` или `authentik-worker` не запущен
- AND скрипт MUST NOT менять пользователей Authentik и базу

#### Scenario: Сервис не запущен в проекте этого каталога
- GIVEN `.env` заполнен, а в проекте Compose каталога, из которого запущен скрипт, нет запущенного `mailpit` (например, стенд работает из другой рабочей копии)
- WHEN выполняется `./scripts/dev.sh auth-users`
- THEN скрипт MUST завершиться кодом 1 с сообщением, что `mailpit` не запущен, с названием проекта Compose и каталога
- AND скрипт MUST NOT обращаться к контейнерам другого проекта Compose

### Requirement: Отказы загрузки демо-контента
Загрузка демо-контента MUST быть одной транзакцией: при отказе или сбое база MUST остаться без изменений. Команда `seed` MUST NOT удалять или заменять истории. Если стенд не готов к загрузке или демо-название занято, команда MUST завершаться ненулевым кодом с названием причины. Сбой обращения к Authentik при чтении пользователей разработки MUST сообщаться как сбой этого шага и MUST NOT сообщаться как отсутствие пользователей.

#### Scenario: Повторный запуск
- GIVEN у `writer@authorled.test` есть «Последний паром», в том числе в корзине
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием пользователя и истории
- AND истории обоих пользователей MUST остаться без изменений

#### Scenario: Стенд не запущен
- GIVEN не запущен `agentos-db` или Authentik
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с названием незапущенного сервиса, проекта Compose и каталога

#### Scenario: Нет пользователей разработки
- GIVEN Authentik запущен, а команда `auth-users` не выполнялась
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением про `./scripts/dev.sh auth-users` и MUST NOT менять базу

#### Scenario: Сбой чтения пользователей Authentik
- GIVEN `authentik-worker` числится запущенным, но команда в его контейнере завершается ошибкой
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением о сбое чтения пользователей Authentik
- AND сообщение MUST NOT предлагать `./scripts/dev.sh auth-users`, а база MUST остаться без изменений

#### Scenario: Схема отстала
- GIVEN в базе применены не все миграции схемы `authorled`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом с сообщением про `./scripts/dev.sh migrate` и MUST NOT менять базу

#### Scenario: Не локальный стенд
- GIVEN `RUNTIME_ENV=prd`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN команда MUST завершиться ненулевым кодом и MUST NOT обращаться к базе

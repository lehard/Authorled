## MODIFIED Requirements

### Requirement: Скрипт локальной разработки
`scripts/dev.sh` MUST быть единым входом в локальную разработку с API на хосте и MUST поддерживать команды `up`, `db`, `api`, `migrate`, `test`, `stop`, `reset-db`, `psql`, `auth-users` (спека `auth`, «Пользователи для разработки») и `seed` («Демо-контент»). Команда `up` MUST запускать сервисы стенда для API на хосте — `agentos-db`, `litellm`, `clamav`, `phoenix`, `authentik-server`, `authentik-worker`, `mailpit` и разовые шаги, от которых они зависят, без `agentos-api` — и возвращать 0 после их статуса `healthy`. Команда `migrate` MUST готовить базу разработки этой рабочей копии («Базы worktree») шагом `agentos-db-init` и применять миграции схем `authorled` и `billing` на хосте под ролью `agentos`. Команда `test` MUST выполнять тесты хранения данных продукта на чистой тестовой базе (спека `core/database`, «Тесты хранения на чистой базе»). Скрипт MUST работать со стендом проекта Compose `authorled` и сервисами compose-файлов репозитория, а не с собственными определениями контейнеров. Команды `api`, `migrate`, `test`, `seed`, `psql` и `auth-users` MUST NOT запускать, останавливать и пересоздавать сервисы стенда: нужные им сервисы MUST уже быть `healthy`, а разовые шаги (`agentos-db-init`, `authentik-jwks-export`) MUST запускаться без подъёма зависимостей. Команда `api` MUST запускать API на хосте только после успешной выгрузки ключей Authentik в `JWT_JWKS_FILE` и MUST NOT останавливать контейнер `agentos-api`; если порт `127.0.0.1:8000` занят, она MUST завершаться кодом 1 с сообщением, называющим, кто его держит. Скрипт MUST завершаться ненулевым кодом с сообщением, называющим причину, если не найден `docker`, не найден `uv` (для `api`, `migrate`, `test` и `seed`), не найден `lsof` (для `api`), отсутствует `.env` или команда неизвестна; значений по умолчанию вместо недостающего ввода он MUST NOT подставлять. Если команда `docker compose`, которой скрипт проверяет сервисы стенда, сама завершается ошибкой (например, в `.env` нет переменной, которую требует compose-файл), скрипт MUST завершаться кодом 1 с сообщением о сбое `docker compose` и MUST NOT сообщать, что сервис не запущен. Сообщение о сервисе, который не запущен или не `healthy`, MUST называть сервис, проект Compose `authorled` и команду `./scripts/dev.sh up` в основной папке; выбирать другой проект Compose скрипт MUST NOT.

#### Scenario: Только база
- GIVEN `.env` заполнен обязательным блоком, команда запущена из основной папки
- WHEN выполняется `./scripts/dev.sh db`
- THEN MUST быть запущен только `agentos-db` и скрипт MUST вернуть 0 после статуса `healthy`
- AND порт `127.0.0.1:5432` MUST принимать соединения пользователя `ai` к базе `ai`

#### Scenario: Стенд для API на хосте
- GIVEN `.env` заполнен, команда запущена из основной папки
- WHEN выполняется `./scripts/dev.sh up`
- THEN `agentos-db`, `litellm`, `clamav`, `phoenix`, `authentik-server`, `authentik-worker` и `mailpit` MUST быть `healthy`, и скрипт MUST вернуть 0
- AND контейнер `agentos-api` MUST NOT запускаться этой командой

#### Scenario: API на хосте
- GIVEN `.env` заполнен, `uv` и `lsof` установлены, стенд запущен командой `up`, порт 8000 свободен
- WHEN выполняется `./scripts/dev.sh api`
- THEN `agentos-db-init`, миграции схем `authorled` и `billing` и `authentik-jwks-export` MUST завершиться успешно до запуска API
- AND API MUST запускаться из `agno/` на `127.0.0.1:8000` с `--reload` по каталогам `agents`, `app`, `db`, `evals` модуля бэкенда, с `RUNTIME_ENV=dev`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_USER=agentos`, `DB_DATABASE` базы разработки этой рабочей копии, `LITELLM_URL=http://127.0.0.1:4000`, `PHOENIX_URL=http://127.0.0.1:6006`, зависимостями из `agno/requirements.txt`, `.env` из корня рабочей копии и `JWT_JWKS_FILE`, указывающим на `auth/jwks/jwks.json` этой рабочей копии

#### Scenario: Порт API занят
- GIVEN работает контейнер `agentos-api` или другой процесс слушает `127.0.0.1:8000`
- WHEN выполняется `./scripts/dev.sh api`
- THEN скрипт MUST завершиться кодом 1 до миграций с сообщением, называющим контейнер `agentos-api` или процесс и его PID
- AND контейнер `agentos-api` MUST остаться запущенным

#### Scenario: Стенд не запущен
- GIVEN `.env` заполнен, а нужный команде сервис стенда (например, `clamav` для `test`) не запущен или не `healthy`
- WHEN выполняется `./scripts/dev.sh test`, `migrate`, `api`, `seed`, `psql` или `auth-users`
- THEN скрипт MUST завершиться кодом 1 с сообщением, называющим сервис, проект Compose `authorled` и команду `./scripts/dev.sh up` в основной папке
- AND скрипт MUST NOT запускать сервисы стенда и MUST NOT менять базы

#### Scenario: Сервис не запущен в проекте этого каталога
- GIVEN `.env` заполнен, а в проекте Compose `authorled` нет запущенного `mailpit`
- WHEN выполняется `./scripts/dev.sh auth-users` из основной папки или из worktree
- THEN скрипт MUST завершиться кодом 1 с сообщением, что `mailpit` не запущен, с названием проекта `authorled` и командой `./scripts/dev.sh up` в основной папке
- AND скрипт MUST NOT обращаться к контейнерам другого проекта Compose

#### Scenario: Нет .env
- GIVEN файла `.env` нет
- WHEN выполняется любая команда, кроме справки
- THEN скрипт MUST завершиться кодом 1 с сообщением о `.env` и MUST NOT запускать контейнеры

#### Scenario: Остановка сохраняет данные
- GIVEN в базе есть данные
- WHEN выполняется `./scripts/dev.sh stop`, затем `./scripts/dev.sh db` из основной папки
- THEN те же данные MUST быть доступны (том `pgdata` не удалён)

#### Scenario: Сброс базы требует подтверждения
- WHEN выполняется `./scripts/dev.sh reset-db` без `--yes`
- THEN скрипт MUST завершиться ненулевым кодом, не удалив контейнер и том
- AND `./scripts/dev.sh reset-db --yes` из основной папки MUST удалить контейнер `agentos-db` и том `pgdata` (вместе с данными Authentik в схеме `authentik`), а следующий `db` MUST создать пустую базу

#### Scenario: Неизвестная команда
- WHEN выполняется `./scripts/dev.sh` без аргумента или с неизвестной командой
- THEN скрипт MUST напечатать справку и завершиться кодом 2

#### Scenario: Миграции из скрипта
- GIVEN `.env` заполнен, `uv` установлен, `agentos-db` `healthy`
- WHEN выполняется `./scripts/dev.sh migrate`
- THEN `agentos-db-init` MUST завершиться успешно на базе разработки этой рабочей копии
- AND миграции схем `authorled` и `billing` MUST быть применены к этой базе, а скрипт MUST вернуть 0 или код упавшей миграции

#### Scenario: Compose не может прочитать конфигурацию
- GIVEN в `.env` нет переменной, которую требует compose-файл (например, `CLOUDRU_API_KEY`)
- WHEN выполняется команда, которая проверяет сервисы стенда (например, `./scripts/dev.sh auth-users`, `seed` или `test`)
- THEN после ошибки `docker compose` скрипт MUST завершиться кодом 1 с сообщением о сбое `docker compose` и подсказкой исправить `.env`
- AND вывод MUST NOT содержать сообщения, что сервис не запущен
- AND скрипт MUST NOT менять пользователей Authentik и базы

### Requirement: Демо-контент
Команда `./scripts/dev.sh seed` MUST загружать в базу разработки этой рабочей копии (`ai` в основной папке, `ai_dev_<worktree>` в worktree, «Базы worktree») демо-истории «Тихая вода», «Последний паром» и «Без названия» пользователям `writer@authorled.test` и `editor@authorled.test`, каждому свою копию. Команда MUST создавать этих пользователей в ядре, если их там нет, с тем же идентификатором, что они получат при входе. Контент MUST проходить проверки ядра, как правки автора, а данные других пользователей MUST NOT меняться.

#### Scenario: Загрузка на пустую базу
- GIVEN база после миграций без историй, а пользователи разработки созданы командой `auth-users`
- WHEN выполняется `./scripts/dev.sh seed`
- THEN у `writer@authorled.test` и `editor@authorled.test` MUST быть «Тихая вода» с двумя драфтами, «Последний паром» с шестью сценами, паспортом, персонажами, локациями и миром, а «Без названия» MUST лежать в корзине
- AND скрипт MUST вернуть 0

#### Scenario: Редактор до первого входа
- GIVEN редактор ещё ни разу не входил и команда `seed` выполнена
- WHEN он входит в приложение
- THEN полка MUST показывать его истории, а новая учётная запись MUST NOT создаваться

#### Scenario: Содержимое драфтов
- GIVEN команда `seed` выполнена
- WHEN автор открывает «Тихую воду»
- THEN полка MUST показывать у истории подпись «2 драфта»
- AND в «Драфт 1» MUST быть текст, паспорт, персонажи, локации, мир, два комментария редактора, ответ сценариста, два открытых предложения соавтора, точка драфта и персонаж в корзине
- AND во втором драфте MUST быть подпись «от Драфта 1», новая концовка, изменённая карточка Веры и своя точка и MUST NOT быть комментариев и предложений

#### Scenario: Чужие истории
- GIVEN у третьего пользователя есть история «Маяк», а у `writer@authorled.test` есть история «Белая дача»
- WHEN выполняется `./scripts/dev.sh seed`
- THEN обе истории MUST остаться без изменений

#### Scenario: Заметки демо-истории
- GIVEN команда `seed` выполнена
- WHEN автор открывает «Тихую воду» в любом драфте
- THEN в разделе «Заметки» MUST быть две заметки, а в «Корзине» MUST лежать ещё одна

## ADDED Requirements

### Requirement: Стенд основной папки
Локальный стенд принадлежит основной папке репозитория. Команды `up`, `db`, `stop` и `reset-db` MUST выполняться только из неё; из worktree скрипт MUST завершаться кодом 1 с сообщением, называющим путь основной папки, и MUST NOT обращаться к Docker. Никакая команда `dev.sh` из worktree MUST NOT пересоздавать контейнеры стенда.

#### Scenario: Управление стендом из worktree
- GIVEN скрипт запущен из worktree под `.claude/worktrees/`
- WHEN выполняется `./scripts/dev.sh up`, `db`, `stop` или `reset-db --yes`
- THEN скрипт MUST завершиться кодом 1 с сообщением, что команду запускают из основной папки, и с её путём
- AND контейнеры и тома стенда MUST остаться без изменений

#### Scenario: Команды worktree не пересоздают стенд
- GIVEN стенд запущен из основной папки
- WHEN из worktree выполняются `./scripts/dev.sh test`, `migrate`, `api`, `seed`, `psql` и `auth-users`
- THEN у контейнеров стенда MUST остаться прежние время создания и рабочий каталог проекта Compose (основная папка)

### Requirement: Базы worktree
Основная папка работает с базой разработки `ai` и тестовой базой `ai_test`. В worktree `migrate`, `api`, `seed` и `psql` MUST работать с базой `ai_dev_<имя>`, а `test` — с `ai_test_<имя>`, где `<имя>` — имя каталога worktree в нижнем регистре, в котором каждый символ, кроме латинских букв, цифр и `_`, заменён на `_`. Имя базы длиннее 63 байт MUST давать отказ с кодом 1 и этим именем. Из worktree база `ai` MUST NOT меняться.

#### Scenario: Миграции ветки в своей базе
- GIVEN worktree `story-cover-colors` с миграцией, которой нет в `ai`
- WHEN из него выполняется `./scripts/dev.sh migrate`
- THEN база `ai_dev_story_cover_colors` MUST быть создана, если её не было, подготовлена `agentos-db-init` и мигрирована до последней ревизии ветки
- AND ревизии схем `authorled` и `billing` в базе `ai` MUST остаться прежними

#### Scenario: API из worktree
- GIVEN порт 8000 свободен, стенд запущен
- WHEN из worktree выполняется `./scripts/dev.sh api`
- THEN API MUST работать с базой `ai_dev_<имя>`, созданной и мигрированной этой командой при необходимости

#### Scenario: Демо-истории без базы worktree
- GIVEN в worktree база `ai_dev_<имя>` ещё не создана
- WHEN выполняется `./scripts/dev.sh seed`
- THEN скрипт MUST завершиться кодом 1 с сообщением выполнить `./scripts/dev.sh migrate` и MUST NOT создавать базу

#### Scenario: psql из worktree
- WHEN из worktree выполняется `./scripts/dev.sh psql`
- THEN psql MUST открыться в базе `ai_dev_<имя>`

#### Scenario: Слишком длинное имя базы
- GIVEN имя каталога worktree даёт имя базы длиннее 63 байт
- WHEN выполняется `./scripts/dev.sh test` или `migrate`
- THEN скрипт MUST завершиться кодом 1 с этим именем до обращения к базе

### Requirement: .env в worktree
В worktree файл `.env` MUST быть символической ссылкой на `.env` основной папки по абсолютному пути. Иначе любая команда, кроме справки, MUST завершаться кодом 1 с сообщением, которое печатает команду `ln -sf <основная папка>/.env .env`, и MUST NOT обращаться к Docker. Сверку ключей `.env` с `example.env` скрипт MUST NOT делать: недостающие переменные называет compose.

#### Scenario: Копия .env в worktree
- GIVEN в worktree `.env` — обычный файл
- WHEN выполняется `./scripts/dev.sh test`
- THEN скрипт MUST завершиться кодом 1 с командой `ln -sf <основная папка>/.env .env`
- AND MUST NOT запускать контейнеры и менять базы

#### Scenario: Ссылка на основной .env
- GIVEN в worktree `.env` — ссылка на `.env` основной папки
- WHEN выполняется команда `dev.sh`
- THEN проверка `.env` MUST пройти, а переменные MUST читаться из `.env` основной папки

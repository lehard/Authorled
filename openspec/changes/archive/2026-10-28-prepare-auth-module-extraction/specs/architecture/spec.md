## MODIFIED Requirements

### Requirement: Подключение к БД
URL БД MUST собираться из `DB_DRIVER`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_DATABASE` (`db/url.py`). Все переменные MUST быть заданы: при отсутствии любой из них или нечисловом `DB_PORT` приложение MUST завершать запуск ошибкой, называющей переменную; значения по умолчанию MUST NOT подставляться. `DB_USER` MUST быть ролью `agentos` без прав суперпользователя, которая владеет схемой `ai` и не имеет прав на схему `authentik`; загрузочный суперпользователь базы MUST использоваться только шагами инициализации и администрирования, а не API. Роль `agentos`, расширение `vector` и владение объектами схемы `ai` MUST готовиться идемпотентным шагом инициализации до старта API; если шаг не выполнился, API MUST NOT стартовать. Пароль роли `agentos` MUST задаваться обязательной переменной `AGENTOS_DB_PASSWORD`.

#### Scenario: Compose
- GIVEN контейнер `agentos-api` запущен через `compose.yaml`
- WHEN строится URL
- THEN `DB_HOST` MUST быть `agentos-db`, `DB_PORT` `5432`
- AND `DB_USER` MUST быть `agentos`

#### Scenario: Нет переменной подключения
- GIVEN `DB_PASS` не задан
- WHEN запускается API
- THEN запуск MUST завершиться ошибкой, называющей `DB_PASS`

#### Scenario: Роль API не суперпользователь
- GIVEN API запущен через `compose.yaml`
- WHEN проверяются атрибуты роли, под которой подключается API
- THEN роль MUST NOT иметь `SUPERUSER`

#### Scenario: Нет пароля роли Agno
- GIVEN `AGENTOS_DB_PASSWORD` не задан в `.env`
- WHEN выполняется `docker compose up`
- THEN команда MUST завершиться ошибкой, называющей `AGENTOS_DB_PASSWORD`

#### Scenario: Существующая база
- GIVEN база, в которой схема `ai` и её таблицы созданы загрузочным суперпользователем
- WHEN выполняется шаг инициализации и запускается API
- THEN владельцем схемы `ai` и её таблиц MUST стать роль `agentos`
- AND сохранённые сессии, знания и записи Company MUST остаться доступны через API

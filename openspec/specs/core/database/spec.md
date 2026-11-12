# core/database Specification

## Purpose
Хранение данных продукта (ядра): схема `authorled` в общей базе отдельно от Agno и Authentik, миграции Alembic отдельным шагом до API, таблица пользователей и тесты на чистой базе.

## Requirements

### Requirement: Схема данных продукта
Данные продукта MUST храниться в схеме `authorled` общей базы, отдельно от схемы `ai` (Agno) и схемы `authentik`. Владельцем схемы `authorled` MUST быть роль `agentos`. Схему MUST создавать идемпотентный шаг инициализации базы до миграций и до старта API. Таблицы продукта MUST NOT создаваться в схемах `ai`, `authentik` и `public`; обращения к таблицам продукта MUST называть схему `authorled` явно и MUST NOT зависеть от пути поиска схем роли.

#### Scenario: Чистая база
- GIVEN база без схемы `authorled`
- WHEN выполняется шаг инициализации
- THEN схема `authorled` MUST существовать и принадлежать роли `agentos`

#### Scenario: Повторная инициализация
- GIVEN схема `authorled` с таблицами и данными
- WHEN шаг инициализации выполняется ещё раз
- THEN он MUST завершиться успешно
- AND таблицы и данные схемы `authorled` MUST остаться без изменений

### Requirement: Миграции схемы продукта
Структура схемы `authorled` MUST меняться только миграциями. Миграции MUST идти только вперёд: применённую миграцию MUST NOT редактировать, у истории миграций MUST быть ровно одна голова. Журнал применённых миграций MUST храниться в схеме `authorled`; миграции MUST NOT создавать, менять или удалять объекты других схем.

#### Scenario: Другие схемы не затронуты
- GIVEN база с объектами в схемах `ai`, `authentik` и `public`
- WHEN выполняется шаг миграций
- THEN объекты и данные этих схем MUST остаться без изменений

#### Scenario: Две головы миграций
- GIVEN в истории миграций две головы
- WHEN выполняется `./scripts/validate.sh`
- THEN проверка MUST завершиться ненулевым кодом с сообщением, называющим головы

### Requirement: Шаг миграций
Миграции MUST применяться отдельным шагом под ролью `agentos` до старта API; API MUST NOT применять миграции при своём запуске. Если шаг миграций завершился ошибкой, он MUST вернуть ненулевой код с сообщением, называющим миграцию, на которой остановился, и API MUST NOT стартовать.

#### Scenario: Миграции на чистой базе
- GIVEN база после шага инициализации без таблиц в схеме `authorled`
- WHEN выполняется шаг миграций
- THEN все миграции MUST примениться
- AND журнал миграций в схеме `authorled` MUST указывать на последнюю миграцию

#### Scenario: Повторный шаг миграций
- GIVEN все миграции уже применены
- WHEN шаг миграций выполняется ещё раз
- THEN он MUST завершиться успешно без изменений в базе

#### Scenario: Ошибка миграции
- GIVEN миграция, которая завершается ошибкой
- WHEN выполняется `docker compose up`
- THEN шаг миграций MUST завершиться ненулевым кодом
- AND API MUST NOT стартовать

### Requirement: Таблица пользователей
Схема `authorled` MUST содержать таблицу `users`, одну запись на пользователя продукта:
- `id` — `uuid`, первичный ключ, создаёт база; на него ссылаются таблицы продукта;
- `auth_subject` — непустой уникальный текст, claim `sub` токена Authentik;
- `email`, `display_name` — непустой текст для показа;
- `created_at`, `updated_at`, `last_seen_at` — обязательное время с часовым поясом, по умолчанию время вставки;
- `deleted_at` — время с часовым поясом, заполнено у мягко удалённого.

#### Scenario: Уникальный subject
- GIVEN в `users` есть запись с `auth_subject` = `s1`
- WHEN вставляется вторая запись с `auth_subject` = `s1`
- THEN база MUST отклонить вставку нарушением уникальности

#### Scenario: Пустые обязательные поля
- GIVEN таблица `users`
- WHEN вставляется запись без `auth_subject`, `email` или `display_name` либо с пустой строкой в одном из них
- THEN база MUST отклонить вставку

#### Scenario: Значения по умолчанию
- GIVEN таблица `users`
- WHEN вставляется запись только с `auth_subject`, `email` и `display_name`
- THEN `id` MUST быть заполнен новым `uuid`
- AND `created_at`, `updated_at` и `last_seen_at` MUST быть заполнены временем вставки
- AND `deleted_at` MUST быть пустым

#### Scenario: Описание в коде совпадает с базой
- GIVEN все миграции применены к чистой базе
- WHEN описание таблиц продукта в коде сравнивается со схемой `authorled` в базе
- THEN различий MUST NOT быть

### Requirement: Что не хранится в схеме продукта
Настройки пользователя (тема, а в будущем настройки чата и агента) MUST NOT храниться в таблице `users`: они хранятся в таблице `user_settings` со ссылкой на `users.id`. Группы, роли и права MUST NOT храниться в схеме `authorled`: их источник — Authentik и токен.

#### Scenario: Состав полей users
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.users`
- THEN MUST присутствовать ровно `id`, `auth_subject`, `email`, `display_name`, `created_at`, `updated_at`, `last_seen_at`, `deleted_at`

#### Scenario: Состав полей user_settings
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.user_settings`
- THEN MUST присутствовать ровно `user_id`, `theme`, `coauthor_mode`, `daily_word_goal`, `updated_at`

### Requirement: Тесты хранения на чистой базе
Тесты хранения данных продукта MUST выполняться на настоящем PostgreSQL без моков базы. Команда `./scripts/dev.sh test` MUST создавать под загрузочным пользователем чистую тестовую базу в `agentos-db` — `ai_test` при запуске из основной папки, `ai_test_<имя>` при запуске из worktree (спека `runtime`, «Базы worktree») — готовить её тем же шагом инициализации, что и основную, применять миграции под ролью `agentos` и запускать pytest под ролью `agentos`. Основная база `ai` и тестовые базы других рабочих копий при этом MUST NOT меняться. Если тестовая база уже существует, команда MUST пересоздать её до тестов. Тесты MUST отказываться работать в базе, имя которой не `ai_test` и не начинается с `ai_test_`.

#### Scenario: Тесты не трогают основную базу
- GIVEN в основной базе `ai` есть данные Agno и Authentik
- WHEN выполняется `./scripts/dev.sh test`
- THEN тесты MUST выполняться в тестовой базе этой рабочей копии
- AND данные основной базы MUST остаться без изменений

#### Scenario: Упавший тест
- GIVEN один из тестов не проходит
- WHEN выполняется `./scripts/dev.sh test`
- THEN команда MUST завершиться ненулевым кодом

#### Scenario: Параллельные прогоны из разных рабочих копий
- GIVEN `./scripts/dev.sh test` идёт из основной папки
- WHEN одновременно `./scripts/dev.sh test` запускают из worktree
- THEN прогоны MUST идти в базах `ai_test` и `ai_test_<имя>` и MUST NOT удалять или менять базу друг друга

#### Scenario: Тесты на чужой базе
- GIVEN pytest в `agno/tests` запущен с `DB_DATABASE=ai`
- WHEN начинается первый тест, которому нужна база
- THEN тесты MUST остановиться с ошибкой, называющей допустимые имена тестовой базы и `./scripts/dev.sh test`

### Requirement: Таблица профиля
Схема `authorled` MUST содержать таблицу `user_settings` — настройки пользователя, одна строка на запись `users`:
- `user_id` — `uuid`, первичный ключ, ссылка на `users.id`;
- `theme` — `light`, `sepia`, `dark` или пусто («как в системе»), другое база отклоняет;
- `coauthor_mode` — обязательный режим соавтора `ask` или `auto`, по умолчанию `ask`; другое и пусто база отклоняет;
- `daily_word_goal` — дневная цель по словам, целое от 1 до 1 000 000 или пусто («цели нет»); другое база отклоняет;
- `updated_at` — обязательное время с часовым поясом, по умолчанию время вставки.
Следующие настройки MUST добавляться колонками миграциями, не полем произвольной структуры.

#### Scenario: Неизвестная тема
- GIVEN запись пользователя и его строка `user_settings`
- WHEN в `theme` записывается `blue`
- THEN база MUST отклонить запись

#### Scenario: Профиль без пользователя
- GIVEN в `users` нет записи с `id` = `X`
- WHEN вставляется строка `user_settings` с `user_id` = `X`
- THEN база MUST отклонить вставку нарушением ссылки

#### Scenario: Одна строка профиля
- GIVEN у пользователя уже есть строка `user_settings`
- WHEN вставляется вторая строка с тем же `user_id`
- THEN база MUST отклонить вставку

#### Scenario: Неизвестный режим соавтора
- GIVEN запись пользователя и его строка `user_settings`
- WHEN в `coauthor_mode` записывается `always` или `NULL`
- THEN база MUST отклонить запись

#### Scenario: Режим существующих пользователей
- GIVEN строки `user_settings` созданы до миграции режима
- WHEN применяется миграция
- THEN у каждой строки `coauthor_mode` MUST быть `ask`

#### Scenario: Неверная дневная цель
- GIVEN запись пользователя и его строка `user_settings`
- WHEN в `daily_word_goal` записывается 0 или -5
- THEN база MUST отклонить запись

#### Scenario: Дневная цель существующих пользователей
- GIVEN строки `user_settings` созданы до миграции дневной цели
- WHEN применяется миграция
- THEN у каждой строки `daily_word_goal` MUST быть пусто

### Requirement: Запись пользователя по входу
Ядро MUST предоставлять операцию «получить или создать пользователя» по `sub`, почте и имени из токена. Если записи нет, MUST в одной транзакции создаваться запись `users` и строка `user_settings` с пустой темой; одновременные первые вызовы одного `sub` MUST NOT создавать двух записей. Если запись удалена мягко, операция MUST завершаться явной ошибкой и MUST NOT менять запись.

#### Scenario: Два первых вызова одновременно
- GIVEN записи пользователя нет
- WHEN операция вызывается для одного `sub` в двух параллельных транзакциях
- THEN MUST существовать ровно одна запись `users` и одна строка `user_settings`

### Requirement: Повторный вход пользователя
Для существующей записи операция «получить или создать пользователя» MUST обновлять `email` (если изменилась) и `last_seen_at` и MUST NOT перезаписывать `display_name` именем из токена: после создания имя меняет только пользователь. Изменение имени или темы MUST обновлять `updated_at` своей таблицы.

#### Scenario: Имя не возвращается к имени из токена
- GIVEN пользователь создан с именем «Анна Петрова» и затем сменил имя на «Анна П.»
- WHEN операция вызывается снова с именем «Анна Петрова» из токена
- THEN `display_name` MUST остаться «Анна П.»

#### Scenario: Почта изменилась в Authentik
- GIVEN запись пользователя с почтой `old@example.com`
- WHEN операция вызывается с тем же `sub` и почтой `new@example.com`
- THEN `email` записи MUST стать `new@example.com`, а `id` MUST остаться прежним

### Requirement: Таблица историй
Схема `authorled` MUST содержать таблицу `projects`, одну запись на историю: `id` (`uuid`, создаёт база), `owner_id` (ссылка на `users.id`, удаление пользователя с историями запрещено), непустой `title`, `description` (текст, по умолчанию пустой), `format` (только `feature`), `word_goal` (цель истории по словам, целое от 1 до 1 000 000 или пусто), `goal_deadline` (дата срока или пусто; заполнена только вместе с `word_goal`), `created_at`, `updated_at`, `deleted_at`.

#### Scenario: Неизвестный формат
- GIVEN все миграции применены
- WHEN вставляется история с `format` `novel`
- THEN база MUST отклонить запись

#### Scenario: Состав полей projects
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.projects`
- THEN MUST присутствовать ровно `id`, `owner_id`, `title`, `description`, `format`, `word_goal`, `goal_deadline`, `created_at`, `updated_at`, `deleted_at`

#### Scenario: Срок без цели
- GIVEN история без `word_goal`
- WHEN в `goal_deadline` записывается дата
- THEN база MUST отклонить запись

#### Scenario: Неверная цель истории
- WHEN в `word_goal` истории записывается 0
- THEN база MUST отклонить запись

### Requirement: Таблица документов
Схема `authorled` MUST содержать таблицу `documents`: `id`, `project_id` (ссылка на `projects.id`, удаляется вместе с историей), `draft_id` (обязательная ссылка на драфт той же истории, удаляется вместе с драфтом), `kind` (`script`, `character`, `location`, `world`), непустой `name`, `role` (`main`, `secondary`, `episodic` или пусто; заполнена только у `character` и `location`), `summary`, `position` (не меньше 0), `fields` (JSON-объект), `revision` (не меньше 1), `updated_by` (ссылка на `users.id`), `created_at`, `updated_at`, `deleted_at`. У драфта MUST быть не больше одного документа `script`.

#### Scenario: Второй сценарий
- GIVEN у драфта есть документ `script`
- WHEN вставляется второй документ `script` того же драфта
- THEN база MUST отклонить запись

#### Scenario: Сценарий в каждом драфте
- GIVEN у истории два драфта
- WHEN в каждый вставляется документ `script`
- THEN база MUST принять обе записи

#### Scenario: Драфт другой истории
- GIVEN драфт принадлежит истории А
- WHEN вставляется документ истории Б с этим `draft_id`
- THEN база MUST отклонить запись

#### Scenario: Роль мира
- GIVEN все миграции применены
- WHEN вставляется документ `world` с `role` `main`
- THEN база MUST отклонить запись

### Requirement: Таблица текстов сценария
Схема `authorled` MUST содержать таблицу `screenplay_texts`, один текст на документ `script`: `document_id` (первичный ключ, ссылка на `documents.id`, удаляется вместе с документом), `content` (JSON-документ редактора), `revision` (не меньше 1), `updated_by` (ссылка на `users.id`), `updated_at`.

#### Scenario: Текст удаляется с документом
- GIVEN у сценария есть текст
- WHEN сценарий удаляется из `documents`
- THEN его строки в `screenplay_texts` MUST NOT остаться

### Requirement: Таблицы комментариев
Схема `authorled` MUST содержать `comment_threads` (`id`, `document_id`, `quote`, `scene_uid` — непустой или пусто, `resolved_at`, `resolved_by`, `created_at`) и `comment_messages` (`id`, `thread_id`, `author_kind` — `user` или `coauthor`, `author_id`, `author_role`, непустой `body`, `created_at`, `edited_at`). У сообщения `user` `author_id` MUST быть заполнен ссылкой на `users.id`, у сообщения `coauthor` MUST быть пуст; другое база отклоняет. Существующие сообщения MUST получить `author_kind` `user`. Ветки MUST удаляться вместе с документом, сообщения — вместе с веткой.

#### Scenario: Сообщения удаляются с веткой
- GIVEN у ветки два сообщения
- WHEN ветка удаляется
- THEN её сообщений MUST NOT остаться

#### Scenario: Сообщение соавтора с пользователем
- GIVEN все миграции применены
- WHEN вставляется сообщение с `author_kind` `coauthor` и заполненным `author_id`
- THEN база MUST отклонить запись

#### Scenario: Сообщение пользователя без автора
- GIVEN все миграции применены
- WHEN вставляется сообщение с `author_kind` `user` и пустым `author_id`
- THEN база MUST отклонить запись

### Requirement: Таблица предложений
Схема `authorled` MUST содержать `suggestions` (`id`, `document_id`, `scene_uid`, `quote`, `text`, `why`, `status` — `open`, `accepted` или `rejected`, `session_id`, `created_at`, `decided_at`). Предложения MUST удаляться вместе с документом; `decided_at` MUST быть заполнен ровно у решённых предложений.

#### Scenario: Решение без времени
- GIVEN все миграции применены
- WHEN вставляется предложение со `status` `accepted` и пустым `decided_at`
- THEN база MUST отклонить запись

### Requirement: Таблицы файлов
Схема `authorled` MUST содержать `files` (`id`, `project_id` — удаляется с историей, `uploaded_by`, `purpose` — `chat`, `import` или `note`, `session_id` — заполнен только у `chat`, непустой `name`, `media_type`, `size_bytes` от 1 до 20 971 520, `sha256`, `text_content`, `created_at`) и `file_contents` (`file_id` — первичный ключ, удаляется с файлом, `bytes`). Байты файла MUST храниться только в `file_contents`.

#### Scenario: Файл чата без беседы
- GIVEN все миграции применены
- WHEN вставляется файл с `purpose` `chat` и пустым `session_id`
- THEN база MUST отклонить запись

#### Scenario: Каскад от истории
- GIVEN у истории есть документы, тексты, комментарии, предложения, файлы и заметки с оригиналами
- WHEN история удаляется из `projects`
- THEN в схеме `authorled` MUST NOT остаться их строк

#### Scenario: Оригинал заметки без беседы
- GIVEN все миграции применены
- WHEN вставляется файл с `purpose` `note` и непустым `session_id`
- THEN база MUST отклонить запись

### Requirement: Таблица драфтов
Схема `authorled` MUST содержать таблицу `drafts`: `id`, `project_id` (удаляется вместе с историей), непустой `name`, `locked`, `forked_from_id` (ссылка на драфт, при его удалении становится пустой), `forked_from_name`, `created_at`, `updated_at`, `deleted_at`.

#### Scenario: Содержимое удаляется с драфтом
- GIVEN у драфта есть документы и текст
- WHEN драфт удаляется из `drafts`
- THEN его документов и текстов MUST NOT остаться

#### Scenario: Основа удалена
- GIVEN драфт 2 ответвился от драфта 1
- WHEN драфт 1 удаляется из `drafts`
- THEN `forked_from_id` драфта 2 MUST стать пустым, а `forked_from_name` MUST остаться

### Requirement: Таблица снимков документа
Схема `authorled` MUST содержать таблицу `document_versions`: `id`, `document_id` (удаляется вместе с документом), `part` (`text` или `fields`), `content` (JSON-объект), `reason` (`auto`, `suggestion`, `import`, `restore`, `coauthor`), `saved_by` (ссылка на `users.id`), `saved_at`, `created_at`.

#### Scenario: Неизвестная причина
- GIVEN все миграции применены
- WHEN вставляется снимок с `reason` `manual`
- THEN база MUST отклонить запись

#### Scenario: Снимки удаляются с документом
- GIVEN у документа есть снимки
- WHEN документ удаляется
- THEN его снимков MUST NOT остаться

### Requirement: Таблица точек драфта
Схема `authorled` MUST содержать таблицу `draft_points`: `id`, `draft_id` (удаляется вместе с драфтом), непустой `name`, `kind` (`manual` или `auto`), `content` (JSON-объект со всеми документами драфта), `created_by` (ссылка на `users.id`), `created_at`.

#### Scenario: Точка без названия
- GIVEN все миграции применены
- WHEN вставляется точка с пустым `name`
- THEN база MUST отклонить запись

### Requirement: Таблица последних открытых драфтов
Схема `authorled` MUST содержать таблицу `draft_opens`, одну запись на пользователя и историю: `user_id`, `project_id` (первичный ключ вместе), `draft_id` (удаляется вместе с драфтом), `opened_at`.

#### Scenario: Вторая запись
- GIVEN у пользователя есть запись для истории
- WHEN вставляется вторая запись той же пары
- THEN база MUST отклонить запись

### Requirement: Очистка демо-контента
Миграция драфтов MUST удалять все истории со всем содержимым и MUST NOT трогать пользователей, их настройки и схемы `ai` и `authentik`.

#### Scenario: Миграция на базе с демо-контентом
- GIVEN в базе есть пользователь и история с документами
- WHEN применяется миграция драфтов
- THEN таблицы историй MUST быть пустыми, а пользователь MUST остаться

### Requirement: Новая форма полей сценария
Миграция MUST приводить к новой форме документы сценария, снимки части `fields` этих документов и сценарии в точках драфтов: убирать `tagline`, задавать имя «Сценарий» и дополнять заданный `show` частью `logline` со значением `true`. Остальные поля, логлайн и ревизии MUST оставаться прежними. Истории, драфты и пользователи MUST NOT удаляться.

#### Scenario: Сценарий старой формы
- GIVEN у сценария заданы `tagline`, `logline` и `show` без `logline`, а имя равно названию истории
- WHEN применяется миграция
- THEN `tagline` MUST исчезнуть, имя MUST стать «Сценарий», `show.logline` MUST быть `true`, а логлайн и ревизия MUST остаться прежними

#### Scenario: Сценарий без заданных частей
- GIVEN у сценария не задан `show`
- WHEN применяется миграция
- THEN `show` MUST остаться не заданным

#### Scenario: Откат к старому снимку
- GIVEN снимок и точка драфта сделаны до миграции
- WHEN после миграции автор откатывается к ним и сохраняет логлайн
- THEN сохранение MUST пройти без отказа

#### Scenario: Документы других видов
- GIVEN в драфте есть персонаж и его снимок
- WHEN применяется миграция
- THEN персонаж и снимок MUST остаться прежними

### Requirement: Таблица заметок
Схема `authorled` MUST содержать таблицу `notes`: `id`, `project_id` (удаляется вместе с историей), непустой `title`, `body`, `revision` от 1, `updated_by` (ссылка на пользователя), `created_at`, `updated_at`, `deleted_at` и необязательный `file_id` — ссылка на оригинал в `files`, у разных заметок разный. Признака задания на исследование у заметки MUST NOT быть: миграция `0017` убирает столбец `research`. Удалить файл, на который ссылается заметка, база MUST NOT позволять. Ссылки на драфт у заметки MUST NOT быть.

#### Scenario: Заметки удаляются с историей
- GIVEN у истории есть заметка
- WHEN история удаляется из `projects`
- THEN её заметок MUST NOT остаться

#### Scenario: Заметка переживает драфт
- GIVEN у истории два драфта и заметка
- WHEN один драфт удаляется из `drafts`
- THEN заметка MUST остаться

#### Scenario: Пустое название
- WHEN в `notes` вставляется строка с пустым `title`
- THEN база MUST отказать

#### Scenario: Данные истории не меняются
- GIVEN в базе есть истории с документами
- WHEN применяется миграция заметок
- THEN истории и документы MUST остаться прежними, а таблица `notes` MUST быть пустой

#### Scenario: Один оригинал на две заметки
- GIVEN у заметки «Эпоха» есть оригинал
- WHEN другой заметке ставится тот же `file_id`
- THEN база MUST отказать

#### Scenario: Оригинал удаляется в обход заметки
- GIVEN у заметки есть оригинал
- WHEN его строка удаляется из `files`
- THEN база MUST отказать

#### Scenario: Миграция оригиналов
- GIVEN в базе есть заметки и файлы чата
- WHEN применяется миграция оригиналов заметок
- THEN у всех заметок `file_id` MUST быть пустым, а файлы MUST остаться прежними

#### Scenario: Задание на исследование в таблице
- GIVEN база на миграции `0016` с заметкой, у которой есть `research`
- WHEN применяется миграция `0017`
- THEN столбца `research` в `notes` MUST NOT быть, а заметка MUST остаться с прежними названием и текстом

### Requirement: Таблица заявок в бету
Схема `authorled` MUST содержать таблицу `beta_requests`, одну запись на почту заявителя: `id` (`uuid`, создаёт база), `email` (непустой текст в нижнем регистре, уникальный), `name` (непустой текст), `role` (только `screenwriter`, `writer`, `other`), `consent_at` (время согласия, обязательно), `created_at`. Таблица MUST NOT ссылаться на `users`: заявитель ещё не пользователь. Удаление пользователя или истории MUST NOT затрагивать заявки.

#### Scenario: Состав полей beta_requests
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.beta_requests`
- THEN MUST присутствовать ровно `id`, `email`, `name`, `role`, `consent_at`, `created_at`

#### Scenario: Вторая запись с той же почтой
- GIVEN в `beta_requests` есть запись с почтой `anna@example.com`
- WHEN вставляется ещё одна запись с той же почтой
- THEN база MUST отклонить запись

#### Scenario: Неизвестная роль
- GIVEN все миграции применены
- WHEN вставляется заявка с `role` `producer`
- THEN база MUST отклонить запись

### Requirement: Таблица оценок ответов соавтора
Схема `authorled` MUST содержать таблицу `coauthor_feedback`: `id` (`uuid`, создаёт база), `user_id` (ссылка на `users.id`, удаление пользователя с оценками база отклоняет), `run_id` и `session_id` (непустой текст), `value` (`useful`, `not_useful` или пусто — оценка снята), `created_at`, `updated_at`. Пара `user_id`, `run_id` MUST быть уникальной. Текста ответа и произведения в таблице MUST NOT быть.

#### Scenario: Состав полей coauthor_feedback
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.coauthor_feedback`
- THEN MUST присутствовать ровно `id`, `user_id`, `run_id`, `session_id`, `value`, `created_at`, `updated_at`

#### Scenario: Вторая оценка того же запуска
- GIVEN у пользователя есть оценка запуска `r1`
- WHEN вставляется ещё одна строка этого пользователя с `run_id` `r1`
- THEN база MUST отклонить вставку

#### Scenario: Неизвестное значение
- WHEN вставляется оценка с `value` `great`
- THEN база MUST отклонить вставку

#### Scenario: Пользователь с оценками
- GIVEN у пользователя есть строки `coauthor_feedback`
- WHEN его запись `users` удаляется
- THEN база MUST отклонить удаление

### Requirement: Таблица учёта письма
Схема `authorled` MUST содержать таблицу `writing_progress` — прирост слов по отрезкам 15 минут:
- `user_id` — ссылка на `users.id`, удаление пользователя с записями запрещено;
- `project_id` — ссылка на `projects.id`, удаляется с историей;
- `period_start` — время с поясом, кратное 15 минутам UTC;
- `words` — прирост, целое, может быть ≤ 0.

Первичный ключ — `user_id`, `project_id`, `period_start`. Текста произведения в таблице MUST NOT быть.

#### Scenario: Состав полей writing_progress
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.writing_progress`
- THEN MUST присутствовать ровно `user_id`, `project_id`, `period_start`, `words`

#### Scenario: Отрезок не на границе
- WHEN вставляется строка с `period_start` 10:07 UTC
- THEN база MUST отклонить запись

#### Scenario: Вторая строка того же отрезка
- GIVEN есть строка пользователя по истории с `period_start` 10:15 UTC
- WHEN вставляется ещё одна строка с той же тройкой ключа
- THEN база MUST отклонить вставку

#### Scenario: История удалена навсегда
- GIVEN у истории есть строки `writing_progress`
- WHEN история удаляется из `projects`
- THEN её строки `writing_progress` MUST NOT остаться

### Requirement: Таблица книг библиотеки
Схема `authorled` MUST содержать таблицу `source_books`, одну строку на книгу канона: `id`, `slug` (имя файла канона без `.md`, уникальный), непустые `title`, `authors` (непустой список) и `language` (только `ru` или `en`), необязательные `original_year`, `edition_year`, `translator`, `translation_year`, `original_title`, непустой `embedding_model`, `loaded_at`. Ссылок на пользователей и истории у неё MUST NOT быть.

#### Scenario: Состав полей source_books
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.source_books`
- THEN MUST присутствовать ровно `id`, `slug`, `title`, `authors`, `language`, `original_year`, `edition_year`, `translator`, `translation_year`, `original_title`, `embedding_model`, `loaded_at`

#### Scenario: Вторая книга с тем же slug
- GIVEN в `source_books` есть книга `impro`
- WHEN вставляется ещё одна строка со `slug` `impro`
- THEN база MUST отказать

#### Scenario: Неизвестный язык
- WHEN в `source_books` вставляется строка с `language` `de`
- THEN база MUST отказать

### Requirement: Таблица кусков библиотеки
Схема `authorled` MUST содержать таблицу `source_fragments`: `id`, `book_id` (удаляется вместе с книгой), `position` от 0 (уникальный в книге), `path` (список заголовков), непустой `content`, `embedding` (вектор 1024 измерений) и производный от `content` и языка книги текст для поиска по словам. По `embedding` MUST быть индекс для поиска ближайших по косинусному расстоянию.

#### Scenario: Куски удаляются с книгой
- GIVEN у книги есть куски
- WHEN книга удаляется из `source_books`
- THEN её кусков MUST NOT остаться

#### Scenario: Вектор другой размерности
- WHEN в `source_fragments` вставляется строка с вектором из 768 чисел
- THEN база MUST отказать

#### Scenario: Данные историй не меняются
- GIVEN в базе есть истории, заметки и пользователи
- WHEN применяется миграция библиотеки
- THEN они MUST остаться прежними, а таблицы `source_books` и `source_fragments` MUST быть пустыми

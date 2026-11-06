## MODIFIED Requirements

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

## ADDED Requirements

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
Схема `authorled` MUST содержать таблицу `document_versions`: `id`, `document_id` (удаляется вместе с документом), `part` (`text` или `fields`), `content` (JSON-объект), `reason` (`auto`, `suggestion`, `import`, `restore`), `saved_by` (ссылка на `users.id`), `saved_at`, `created_at`.

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

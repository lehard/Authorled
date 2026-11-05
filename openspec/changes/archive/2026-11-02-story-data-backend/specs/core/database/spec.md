# Spec Delta

## ADDED Requirements

### Requirement: Таблица историй
Схема `authorled` MUST содержать таблицу `projects`, одну запись на историю: `id` (`uuid`, создаёт база), `owner_id` (ссылка на `users.id`, удаление пользователя с историями запрещено), непустой `title`, `description` (текст, по умолчанию пустой), `format` (только `feature`), `created_at`, `updated_at`, `deleted_at`.

#### Scenario: Неизвестный формат
- GIVEN все миграции применены
- WHEN вставляется история с `format` `novel`
- THEN база MUST отклонить запись

#### Scenario: Состав полей projects
- GIVEN все миграции применены
- WHEN перечисляются колонки `authorled.projects`
- THEN MUST присутствовать ровно `id`, `owner_id`, `title`, `description`, `format`, `created_at`, `updated_at`, `deleted_at`

### Requirement: Таблица документов
Схема `authorled` MUST содержать таблицу `documents`: `id`, `project_id` (ссылка на `projects.id`, удаляется вместе с историей), `kind` (`script`, `character`, `location`, `world`, `draft`), непустой `name`, `role` (`main`, `secondary`, `episodic` или пусто; заполнена только у `character` и `location`), `summary`, `position` (не меньше 0), `fields` (JSON-объект), `revision` (не меньше 1), `created_at`, `updated_at`, `deleted_at`. У истории MUST быть не больше одного документа `script`.

#### Scenario: Второй сценарий
- GIVEN у истории есть документ `script`
- WHEN вставляется второй документ `script` той же истории
- THEN база MUST отклонить запись

#### Scenario: Роль мира
- GIVEN все миграции применены
- WHEN вставляется документ `world` с `role` `main`
- THEN база MUST отклонить запись

### Requirement: Таблица текстов сценария
Схема `authorled` MUST содержать таблицу `screenplay_texts`, один текст на документ `script` или `draft`: `document_id` (первичный ключ, ссылка на `documents.id`, удаляется вместе с документом), `content` (JSON-документ редактора), `revision` (не меньше 1), `updated_at`.

#### Scenario: Текст удаляется с документом
- GIVEN у драфта есть текст
- WHEN драфт удаляется из `documents`
- THEN его строки в `screenplay_texts` MUST NOT остаться

### Requirement: Таблицы комментариев
Схема `authorled` MUST содержать `comment_threads` (`id`, `document_id`, `quote`, `resolved_at`, `resolved_by`, `created_at`) и `comment_messages` (`id`, `thread_id`, `author_id`, `author_role`, непустой `body`, `created_at`, `edited_at`). Ветки MUST удаляться вместе с документом, сообщения — вместе с веткой.

#### Scenario: Сообщения удаляются с веткой
- GIVEN у ветки два сообщения
- WHEN ветка удаляется
- THEN её сообщений MUST NOT остаться

### Requirement: Таблица предложений
Схема `authorled` MUST содержать `suggestions` (`id`, `document_id`, `scene_uid`, `quote`, `text`, `why`, `status` — `open`, `accepted` или `rejected`, `session_id`, `created_at`, `decided_at`). Предложения MUST удаляться вместе с документом; `decided_at` MUST быть заполнен ровно у решённых предложений.

#### Scenario: Решение без времени
- GIVEN все миграции применены
- WHEN вставляется предложение со `status` `accepted` и пустым `decided_at`
- THEN база MUST отклонить запись

### Requirement: Таблицы файлов
Схема `authorled` MUST содержать `files` (`id`, `project_id` — удаляется с историей, `uploaded_by`, `purpose` — `chat` или `import`, `session_id` — заполнен только у `chat`, непустой `name`, `media_type`, `size_bytes` от 1 до 20 971 520, `sha256`, `text_content`, `created_at`) и `file_contents` (`file_id` — первичный ключ, удаляется с файлом, `bytes`). Байты файла MUST храниться только в `file_contents`.

#### Scenario: Файл чата без беседы
- GIVEN все миграции применены
- WHEN вставляется файл с `purpose` `chat` и пустым `session_id`
- THEN база MUST отклонить запись

#### Scenario: Каскад от истории
- GIVEN у истории есть документы, тексты, комментарии, предложения и файлы
- WHEN история удаляется из `projects`
- THEN в схеме `authorled` MUST NOT остаться их строк

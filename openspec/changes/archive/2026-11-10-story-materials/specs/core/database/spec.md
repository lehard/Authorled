## MODIFIED Requirements

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

### Requirement: Таблица заметок
Схема `authorled` MUST содержать таблицу `notes`: `id`, `project_id` (удаляется вместе с историей), непустой `title`, `body`, `revision` от 1, `updated_by` (ссылка на пользователя), `created_at`, `updated_at`, `deleted_at` и необязательный `file_id` — ссылка на оригинал в `files`, у разных заметок разный. Удалить файл, на который ссылается заметка, база MUST NOT позволять. Ссылки на драфт у заметки MUST NOT быть.

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

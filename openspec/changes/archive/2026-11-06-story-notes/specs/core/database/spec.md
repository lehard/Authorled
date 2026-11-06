## ADDED Requirements

### Requirement: Таблица заметок
Схема `authorled` MUST содержать таблицу `notes`: `id`, `project_id` (удаляется вместе с историей), непустой `title`, `body`, `revision` от 1, `updated_by` (ссылка на пользователя), `created_at`, `updated_at`, `deleted_at`. Ссылки на драфт у заметки MUST NOT быть.

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

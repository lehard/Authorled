## MODIFIED Requirements

### Requirement: Таблица предложений
Схема `authorled` MUST содержать `suggestions` (`id`, `document_id`, `scene_uid`, `quote`, `text`, `why`, `status` — `open`, `accepted` или `rejected`, `author_kind` — `coauthor` или `user`, `author_id` — ссылка на `users.id`, `session_id`, `created_at`, `decided_at`, `decided_by` — ссылка на `users.id`). Предложения MUST удаляться вместе с документом; `decided_at` MUST быть заполнен ровно у решённых предложений. `author_id` MUST быть заполнен ровно у предложений с `author_kind` `user`. Существующие предложения MUST получить `author_kind` `coauthor`.

#### Scenario: Решение без времени
- GIVEN все миграции применены
- WHEN вставляется предложение со `status` `accepted` и пустым `decided_at`
- THEN база MUST отклонить запись

#### Scenario: Предложение человека без автора
- GIVEN все миграции применены
- WHEN вставляется предложение с `author_kind` `user` и пустым `author_id`
- THEN база MUST отклонить запись

### Requirement: Таблица снимков документа
Схема `authorled` MUST содержать таблицу `document_versions`: `id`, `document_id` (удаляется вместе с документом), `part` (`text` или `fields`), `content` (JSON-объект), `reason` (`auto`, `suggestion`, `import`, `restore`, `coauthor`, `conflict`), `saved_by` (ссылка на `users.id`), `saved_at`, `created_at`.

#### Scenario: Неизвестная причина
- GIVEN все миграции применены
- WHEN вставляется снимок с `reason` `manual`
- THEN база MUST отклонить запись

#### Scenario: Снимки удаляются с документом
- GIVEN у документа есть снимки
- WHEN документ удаляется
- THEN его снимков MUST NOT остаться

#### Scenario: Снимок конфликта
- GIVEN все миграции применены
- WHEN вставляется снимок с `reason` `conflict`
- THEN база MUST принять запись

## ADDED Requirements

### Requirement: Таблица участников истории
Схема `authorled` MUST содержать `project_members`: `project_id` (удаляется вместе с историей), `user_id` (ссылка на `users.id`), `role` (`coauthor`, `reviewer` или `reader`), `added_by`, `added_at`; первичный ключ — пара `project_id`, `user_id`. Владелец в этой таблице MUST NOT храниться: он — `projects.owner_id`.

#### Scenario: Неизвестная роль
- GIVEN все миграции применены
- WHEN вставляется участник с `role` `owner`
- THEN база MUST отклонить запись

#### Scenario: Участники удаляются с историей
- GIVEN у истории два участника
- WHEN история удаляется навсегда
- THEN её участников MUST NOT остаться

### Requirement: Таблица приглашений
Схема `authorled` MUST содержать `project_invitations`: `id`, `project_id` (удаляется вместе с историей), `email` (в нижнем регистре, непустая), `role` (`coauthor`, `reviewer` или `reader`), `invited_by`, `created_at`; пара `project_id` и `email` MUST быть уникальной.

#### Scenario: Двойное приглашение
- GIVEN в истории есть приглашение `anya@mail.ru`
- WHEN вставляется второе приглашение `anya@mail.ru` в ту же историю
- THEN база MUST отклонить запись

### Requirement: Таблица ссылок «почитать»
Схема `authorled` MUST содержать `draft_read_links`: `draft_id` (первичный ключ, удаляется вместе с драфтом), уникальный `key`, `created_by`, `created_at`.

#### Scenario: Одна ссылка на драфт
- GIVEN у драфта есть ссылка
- WHEN вставляется вторая ссылка того же драфта
- THEN база MUST отклонить запись

### Requirement: Таблица присутствия
Схема `authorled` MUST содержать `draft_presence`: `draft_id` (удаляется вместе с драфтом), `user_id`, `seen_at`; первичный ключ — пара `draft_id`, `user_id`.

#### Scenario: Отметка обновляется
- GIVEN Аня отметилась в драфте 1
- WHEN Аня отмечается в драфте 1 снова
- THEN в `draft_presence` MUST быть одна запись Ани с новым `seen_at`

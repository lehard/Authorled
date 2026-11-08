## MODIFIED Requirements

### Requirement: Таблица профиля
Схема `authorled` MUST содержать таблицу `user_settings` — настройки пользователя, одна строка на запись `users`:
- `user_id` — `uuid`, первичный ключ, ссылка на `users.id`;
- `theme` — `light`, `sepia`, `dark` или пусто («как в системе»), другое база отклоняет;
- `coauthor_mode` — обязательный режим соавтора `ask` или `auto`, по умолчанию `ask`; другое и пусто база отклоняет;
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

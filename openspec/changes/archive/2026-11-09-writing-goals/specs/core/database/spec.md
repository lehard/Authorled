## MODIFIED Requirements

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

## ADDED Requirements

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

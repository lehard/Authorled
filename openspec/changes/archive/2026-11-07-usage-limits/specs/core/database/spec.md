## ADDED Requirements

### Requirement: Таблица подписок
Схема `authorled` MUST содержать таблицу `subscriptions` — подписки пользователей на тарифы:
- `id` — `uuid`, первичный ключ;
- `user_id` — ссылка на `users.id`, удаление пользователя с подписками база отклоняет;
- `plan` — непустой код тарифа из файла тарифов (не внешний ключ);
- `source` — `granted`, другое база отклоняет;
- `status` — `active` или `ended`, другое база отклоняет;
- `started_at`, `period_start`, `period_end` — обязательные времена с часовым поясом, `period_end` позже `period_start`;
- `ended_at` — время окончания, заполнено тогда и только тогда, когда `status` = `ended`;
- `created_at`, `updated_at` — обязательные, по умолчанию время вставки.
У пользователя MUST быть не больше одной строки со `status` = `active`. Миграция MUST дать каждому неудалённому пользователю, существовавшему до неё, действующую подписку `beta` с источником `granted`, началом и первым периодом от `users.created_at`.

#### Scenario: Период наоборот
- WHEN вставляется подписка с `period_end` раньше `period_start`
- THEN база MUST отклонить вставку

#### Scenario: Закончившаяся без времени
- WHEN подписке ставится `status` = `ended` без `ended_at`
- THEN база MUST отклонить запись

#### Scenario: Пользователь до миграции
- GIVEN пользователь создан 7 октября до миграции
- WHEN применяется миграция подписок
- THEN у него MUST появиться одна действующая подписка `beta` с периодом 7 октября — 7 ноября

### Requirement: Таблица журнала расхода
Схема `authorled` MUST содержать таблицу `usage_records` — расход запусков агентов, одна строка на запуск и модель:
- `id` — `uuid`, первичный ключ;
- `user_id` — ссылка на `users.id`, `subscription_id` — ссылка на `subscriptions.id`; удаление записей, на которые ссылается журнал, база отклоняет;
- `run_id`, `session_id`, `agent_id`, `model` — непустой текст;
- `run_status` — `completed`, `error` или `cancelled`, другое база отклоняет;
- `input_tokens`, `cache_read_tokens`, `output_tokens` — неотрицательные целые, `cache_read_tokens` не больше `input_tokens`;
- `cost_rub` — неотрицательное число с шестью знаками после запятой; `provider_cost_usd` — такое же число или пусто;
- `occurred_at` — начало запуска, `created_at` — время записи.
Пара `run_id`, `model` MUST быть уникальной.

#### Scenario: Повтор запуска
- GIVEN в журнале есть строка запуска `r1` модели `deepseek-fast`
- WHEN вставляется вторая строка `r1` и `deepseek-fast`
- THEN база MUST отклонить вставку

#### Scenario: Кэш больше входа
- WHEN вставляется строка с `cache_read_tokens` больше `input_tokens`
- THEN база MUST отклонить вставку

#### Scenario: Пользователь с расходом
- GIVEN у пользователя есть строки журнала
- WHEN его запись `users` удаляется
- THEN база MUST отклонить удаление

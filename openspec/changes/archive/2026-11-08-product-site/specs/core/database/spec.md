## ADDED Requirements

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

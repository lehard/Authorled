# Spec Delta

## ADDED Requirements

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

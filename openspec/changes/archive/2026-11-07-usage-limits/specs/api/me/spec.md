## MODIFIED Requirements

### Requirement: GET /api/v1/me
Система MUST предоставлять свой маршрут `GET /api/v1/me` в приложении AgentOS (ADR-002), без вызова модели. Маршрут MUST находить пользователя по `sub` токена и, если записи нет, MUST создавать её вместе со строкой профиля и действующей подпиской на тариф новых аккаунтов (`beta`, источник `granted`) с периодом от времени создания записи. Ответ `200` MUST содержать:
- `id` — `uuid` записи пользователя;
- `email`;
- `display_name`;
- `settings.theme` — `light`, `sepia`, `dark` или `null` («как в системе»).

Повторные вызовы MUST NOT создавать новых записей и подписок.

#### Scenario: Первый вызов нового пользователя
- GIVEN в `authorled.users` нет записи с `auth_subject` = `sub` токена
- WHEN пользователь с почтой `anna@example.com` и именем «Анна Петрова» в токене вызывает `GET /api/v1/me`
- THEN ответ MUST быть `200` с `email` = `anna@example.com`, `display_name` = «Анна Петрова» и `settings.theme` = `null`
- AND в `authorled.users` и `authorled.user_settings` MUST появиться ровно по одной строке этого пользователя
- AND в `authorled.subscriptions` MUST появиться одна действующая подписка `beta` с периодом в месяц от `users.created_at`

#### Scenario: Повторный вызов
- GIVEN пользователь уже вызывал `GET /api/v1/me`
- WHEN он вызывает его снова
- THEN ответ MUST содержать тот же `id`
- AND число строк пользователя в `users`, `user_settings` и `subscriptions` MUST NOT измениться

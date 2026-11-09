## MODIFIED Requirements

### Requirement: GET /api/v1/me
Система MUST предоставлять свой маршрут `GET /api/v1/me` в приложении AgentOS (ADR-002), без вызова модели. Маршрут MUST находить пользователя по `sub` токена и, если записи нет, MUST создавать её вместе со строкой профиля. Затем маршрут MUST просить биллинг выдать подписку на тариф новых аккаунтов (`billing/subscriptions`, «Подписка при входе»): действующую `beta` с источником `granted` и периодом от времени создания записи. Если выдача не удалась, маршрут MUST ответить ошибкой `500`, а запись пользователя MUST остаться. Ответ `200` MUST содержать:
- `id` — `uuid` записи пользователя;
- `email`;
- `display_name`;
- `settings.theme` — `light`, `sepia`, `dark` или `null` («как в системе»);
- `settings.coauthor_mode` — режим соавтора: `ask` («Спрашивать») или `auto` («Сам»); у нового пользователя `ask`.

Повторные вызовы MUST NOT создавать новых записей и подписок.

#### Scenario: Первый вызов нового пользователя
- GIVEN в `authorled.users` нет записи с `auth_subject` = `sub` токена
- WHEN пользователь с почтой `anna@example.com` и именем «Анна Петрова» в токене вызывает `GET /api/v1/me`
- THEN ответ MUST быть `200` с `email` = `anna@example.com`, `display_name` = «Анна Петрова», `settings.theme` = `null` и `settings.coauthor_mode` = `ask`
- AND в `authorled.users` и `authorled.user_settings` MUST появиться ровно по одной строке этого пользователя
- AND в `billing.subscriptions` MUST появиться одна действующая подписка `beta` с периодом в месяц от `users.created_at`

#### Scenario: Повторный вызов
- GIVEN пользователь уже вызывал `GET /api/v1/me`
- WHEN он вызывает его снова
- THEN ответ MUST содержать тот же `id`
- AND число строк пользователя в `authorled.users`, `authorled.user_settings` и `billing.subscriptions` MUST NOT измениться

#### Scenario: Подписка не выдана при прошлом входе
- GIVEN запись пользователя есть, а подписки в биллинге у него нет, потому что прошлая выдача упала
- WHEN он вызывает `GET /api/v1/me`
- THEN ответ MUST быть `200`, а в `billing.subscriptions` MUST появиться одна действующая подписка `beta` с периодом от `users.created_at`

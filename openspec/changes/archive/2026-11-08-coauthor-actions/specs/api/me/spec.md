## MODIFIED Requirements

### Requirement: GET /api/v1/me
Система MUST предоставлять свой маршрут `GET /api/v1/me` в приложении AgentOS (ADR-002), без вызова модели. Маршрут MUST находить пользователя по `sub` токена и, если записи нет, MUST создавать её вместе со строкой профиля и действующей подпиской на тариф новых аккаунтов (`beta`, источник `granted`) с периодом от времени создания записи. Ответ `200` MUST содержать:
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
- AND в `authorled.subscriptions` MUST появиться одна действующая подписка `beta` с периодом в месяц от `users.created_at`

#### Scenario: Повторный вызов
- GIVEN пользователь уже вызывал `GET /api/v1/me`
- WHEN он вызывает его снова
- THEN ответ MUST содержать тот же `id`
- AND число строк пользователя в `users`, `user_settings` и `subscriptions` MUST NOT измениться

### Requirement: PATCH /api/v1/me
Система MUST предоставлять маршрут `PATCH /api/v1/me` с необязательными полями `display_name`, `theme` и `coauthor_mode`. Переданные поля MUST сохраняться, остальные MUST NOT меняться. Ответ `200` MUST иметь ту же форму, что `GET /api/v1/me`, с новыми значениями; изменение MUST обновлять `updated_at` изменённой записи. `PATCH` до первого `GET /api/v1/me` MUST получать `404`.

#### Scenario: Смена имени
- GIVEN пользователь с именем «Анна Петрова»
- WHEN он отправляет `PATCH /api/v1/me` с `display_name` = «  Анна П.  »
- THEN ответ MUST быть `200` с `display_name` = «Анна П.»
- AND следующий `GET /api/v1/me` MUST вернуть «Анна П.»

#### Scenario: Смена темы
- GIVEN у пользователя `settings.theme` = `null`
- WHEN он отправляет `PATCH /api/v1/me` с `theme` = `sepia`
- THEN ответ MUST содержать `settings.theme` = `sepia`, а `display_name` MUST остаться прежним

#### Scenario: Возврат к системной теме
- GIVEN у пользователя `settings.theme` = `dark`
- WHEN он отправляет `PATCH /api/v1/me` с `theme` = `null`
- THEN ответ MUST содержать `settings.theme` = `null`

#### Scenario: Смена режима соавтора
- GIVEN у пользователя `settings.coauthor_mode` = `ask`
- WHEN он отправляет `PATCH /api/v1/me` с `coauthor_mode` = `auto`
- THEN ответ MUST содержать `settings.coauthor_mode` = `auto`, а `settings.theme` MUST остаться прежней
- AND чат MUST со следующего сообщения подтверждать меняющие действия соавтора сам, без карточки

### Requirement: Значения PATCH /api/v1/me
Тело `PATCH /api/v1/me` MUST содержать хотя бы одно поле и MUST NOT содержать других полей. `display_name` после обрезки пробелов MUST быть непустым. `theme` MUST быть `light`, `sepia`, `dark` или `null` («как в системе»). `coauthor_mode` MUST быть `ask` или `auto`; `null` MUST NOT приниматься. Нарушение MUST давать `422` с `detail`, называющим поле, и MUST NOT менять данные.

#### Scenario: Пустое тело
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с телом `{}`
- THEN система MUST вернуть `422`

#### Scenario: Неизвестное поле
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с полем `email`
- THEN система MUST вернуть `422` с `detail`, называющим `email`, и почта MUST NOT измениться

#### Scenario: Неизвестный режим соавтора
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с `coauthor_mode` = `always` или `null`
- THEN система MUST вернуть `422` с `detail`, называющим `coauthor_mode`, и режим MUST NOT измениться

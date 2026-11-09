# Me API Specification

## Purpose
Свой маршрут продукта `/api/v1/me`: аккаунт пользователя (запись в `authorled.users`) и его настройки. Домен содержит 2 операции HTTP (тег OpenAPI: Account); маршруты объявлены в коде репозитория (`agno/app/api/`), без вызова модели.

## Requirements

### Requirement: GET /api/v1/me
Система MUST предоставлять свой маршрут `GET /api/v1/me` в приложении AgentOS (ADR-002), без вызова модели. Маршрут MUST находить пользователя по `sub` токена и, если записи нет, MUST создавать её вместе со строкой профиля. Затем маршрут MUST просить биллинг выдать подписку на тариф новых аккаунтов (`billing/subscriptions`, «Подписка при входе»): действующую `beta` с источником `granted` и периодом от времени создания записи. Если выдача не удалась, маршрут MUST ответить ошибкой `500`, а запись пользователя MUST остаться. Ответ `200` MUST содержать:
- `id` — `uuid` записи пользователя;
- `email`;
- `display_name`;
- `settings.theme` — `light`, `sepia`, `dark` или `null` («как в системе»);
- `settings.coauthor_mode` — режим соавтора: `ask` («Спрашивать») или `auto` («Сам»); у нового пользователя `ask`;
- `settings.daily_word_goal` — дневная цель по словам или `null` («цели нет»); у нового пользователя `null`.

Повторные вызовы MUST NOT создавать новых записей и подписок.

#### Scenario: Первый вызов нового пользователя
- GIVEN в `authorled.users` нет записи с `auth_subject` = `sub` токена
- WHEN пользователь с почтой `anna@example.com` и именем «Анна Петрова» в токене вызывает `GET /api/v1/me`
- THEN ответ MUST быть `200` с `email` = `anna@example.com`, `display_name` = «Анна Петрова», `settings.theme` = `null`, `settings.coauthor_mode` = `ask` и `settings.daily_word_goal` = `null`
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

### Requirement: PATCH /api/v1/me
Система MUST предоставлять маршрут `PATCH /api/v1/me` с необязательными полями `display_name`, `theme`, `coauthor_mode` и `daily_word_goal`. Переданные поля MUST сохраняться, остальные MUST NOT меняться. Ответ `200` MUST иметь ту же форму, что `GET /api/v1/me`, с новыми значениями; изменение MUST обновлять `updated_at` изменённой записи. `PATCH` до первого `GET /api/v1/me` MUST получать `404`.

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

#### Scenario: Дневная цель
- GIVEN у пользователя `settings.daily_word_goal` = `null`
- WHEN он отправляет `PATCH /api/v1/me` с `daily_word_goal` = 500
- THEN ответ MUST содержать `settings.daily_word_goal` = 500, а `settings.theme` и `settings.coauthor_mode` MUST остаться прежними

#### Scenario: Снять дневную цель
- GIVEN у пользователя `settings.daily_word_goal` = 500
- WHEN он отправляет `PATCH /api/v1/me` с `daily_word_goal` = `null`
- THEN ответ MUST содержать `settings.daily_word_goal` = `null`

### Requirement: Значения PATCH /api/v1/me
Тело `PATCH /api/v1/me` MUST содержать хотя бы одно поле и MUST NOT содержать других полей. `display_name` после обрезки пробелов MUST быть непустым. `theme` MUST быть `light`, `sepia`, `dark` или `null` («как в системе»). `coauthor_mode` MUST быть `ask` или `auto`; `null` MUST NOT приниматься. `daily_word_goal` MUST быть целым от 1 до 1 000 000 или `null` («цели нет»); строка, дробное число и логическое значение MUST NOT приниматься. Нарушение MUST давать `422` с `detail`, называющим поле, и MUST NOT менять данные.

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

#### Scenario: Неверная дневная цель
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с `daily_word_goal` = 0, `"500"` или 12.5
- THEN система MUST вернуть `422` с `detail`, называющим `daily_word_goal`, и цель MUST NOT измениться

### Requirement: Ошибки /api/v1/me
Ошибки, которые формируют маршруты `/api/v1/me`, MUST возвращаться в формате `application/problem+json` (RFC 9457) с понятным `detail`. Отказ `401` (нет токена или он недействителен) возвращает проверка токена AgentOS в своём формате до маршрута.
- `403` — в токене нет claim `email` или `name`; `detail` называет claim;
- `410` — аккаунт удалён мягко; запись MUST NOT восстанавливаться или создаваться заново.
Значения по умолчанию вместо отсутствующих claims MUST NOT подставляться.

#### Scenario: Без токена
- GIVEN авторизация включена
- WHEN клиент вызывает `GET /api/v1/me` без заголовка `Authorization`
- THEN система MUST вернуть `401`

#### Scenario: Токен сервисной учётной записи
- GIVEN действительный токен без claim `email`
- WHEN клиент вызывает `GET /api/v1/me`
- THEN система MUST вернуть `403` с `detail`, называющим `email`
- AND запись пользователя MUST NOT создаваться

#### Scenario: Удалённый аккаунт
- GIVEN у записи пользователя заполнен `deleted_at`
- WHEN он вызывает `GET /api/v1/me` или `PATCH /api/v1/me`
- THEN система MUST вернуть `410`
- AND `deleted_at` MUST остаться заполненным, новая запись MUST NOT появиться

#### Scenario: Неизвестная тема
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с `theme` = `blue`
- THEN система MUST вернуть `422` с `detail`, называющим `theme`
- AND тема MUST NOT измениться

#### Scenario: Пустое имя
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с `display_name` = «   »
- THEN система MUST вернуть `422` с `detail`, называющим `display_name`

### Requirement: Доступ к /api/v1/me
Маршруты `/api/v1/me` MUST работать только с записью того пользователя, чей `sub` в токене. Идентификатора пользователя в адресе или теле запроса MUST NOT быть. Маршрут не относится к проекту, поэтому проверка доступа к проекту не применяется.

#### Scenario: Только своя запись
- GIVEN в базе есть пользователи A и B
- WHEN пользователь A вызывает `PATCH /api/v1/me` с новым именем
- THEN MUST измениться только запись A

### Requirement: Отказы аккаунта не кэшируются
Отказы маршрутов `/api/v1/me` MUST отправляться с заголовком `Cache-Control: no-store`.

#### Scenario: Удалённый аккаунт, затем другой пользователь
- GIVEN в браузере получен ответ `410` на запрос аккаунта
- WHEN в этом браузере входит другой пользователь
- THEN его запрос MUST дойти до сервера, и он MUST получить свой аккаунт

#### Scenario: Заголовок отказа
- WHEN пользователь с мягко удалённым аккаунтом вызывает `GET /api/v1/me`
- THEN ответ MUST быть `410` с заголовком `Cache-Control: no-store`

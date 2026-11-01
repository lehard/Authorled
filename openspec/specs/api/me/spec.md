# Me API Specification

## Purpose
Свой маршрут продукта `/api/v1/me`: аккаунт пользователя (запись в `authorled.users`) и его настройки. Домен содержит 2 операции HTTP (тег OpenAPI: Account); маршруты объявлены в коде репозитория (`agno/app/api/`), без вызова модели.

## Requirements

### Requirement: GET /api/v1/me
Система MUST предоставлять свой маршрут `GET /api/v1/me` в приложении AgentOS (ADR-002), без вызова модели. Маршрут MUST находить пользователя по `sub` токена и, если записи нет, MUST создавать её вместе со строкой профиля. Ответ `200` MUST содержать:
- `id` — `uuid` записи пользователя;
- `email`;
- `display_name`;
- `settings.theme` — `light`, `sepia`, `dark` или `null` («как в системе»).

Повторные вызовы MUST NOT создавать новых записей.

#### Scenario: Первый вызов нового пользователя
- GIVEN в `authorled.users` нет записи с `auth_subject` = `sub` токена
- WHEN пользователь с почтой `anna@example.com` и именем «Анна Петрова» в токене вызывает `GET /api/v1/me`
- THEN ответ MUST быть `200` с `email` = `anna@example.com`, `display_name` = «Анна Петрова» и `settings.theme` = `null`
- AND в `authorled.users` и `authorled.user_settings` MUST появиться ровно по одной строке этого пользователя

#### Scenario: Повторный вызов
- GIVEN пользователь уже вызывал `GET /api/v1/me`
- WHEN он вызывает его снова
- THEN ответ MUST содержать тот же `id`
- AND число строк пользователя в `users` и `user_settings` MUST NOT измениться

### Requirement: PATCH /api/v1/me
Система MUST предоставлять маршрут `PATCH /api/v1/me` с необязательными полями `display_name` и `theme`. Переданные поля MUST сохраняться, остальные MUST NOT меняться. Ответ `200` MUST иметь ту же форму, что `GET /api/v1/me`, с новыми значениями; изменение MUST обновлять `updated_at` изменённой записи. `PATCH` до первого `GET /api/v1/me` MUST получать `404`.

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

### Requirement: Значения PATCH /api/v1/me
Тело `PATCH /api/v1/me` MUST содержать хотя бы одно поле и MUST NOT содержать других полей. `display_name` после обрезки пробелов MUST быть непустым. `theme` MUST быть `light`, `sepia`, `dark` или `null` («как в системе»). Нарушение MUST давать `422` с `detail`, называющим поле, и MUST NOT менять данные.

#### Scenario: Пустое тело
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с телом `{}`
- THEN система MUST вернуть `422`

#### Scenario: Неизвестное поле
- GIVEN пользователь вызвал `GET /api/v1/me`
- WHEN он отправляет `PATCH /api/v1/me` с полем `email`
- THEN система MUST вернуть `422` с `detail`, называющим `email`, и почта MUST NOT измениться

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

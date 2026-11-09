## MODIFIED Requirements

### Requirement: Список историй
`GET /api/v1/projects` MUST возвращать истории вызывающего: `id`, `title`, `description`, `format`, `word_goal`, `goal_deadline`, `created_at`, `updated_at`, `deleted_at`, `drafts_count` (драфты не в корзине), `open_draft_id` (драфт, в котором история откроется у вызывающего), по убыванию `updated_at`. Без параметра или с `trash=false` MUST возвращаться истории не в корзине, с `trash=true` — только истории в корзине.

#### Scenario: Полка и корзина
- WHEN у автора истории «Маяк» и «Паром», и «Паром» удалена в корзину
- THEN `GET /api/v1/projects` MUST вернуть только «Маяк», а `GET /api/v1/projects?trash=true` — только «Паром»

#### Scenario: Число драфтов
- WHEN в истории три драфта, и один из них в корзине
- THEN `drafts_count` MUST быть 2

#### Scenario: История без цели
- WHEN автор создал историю и не задавал ей цели
- THEN в списке у неё MUST быть `word_goal` = `null` и `goal_deadline` = `null`

### Requirement: Изменение истории
`PATCH /api/v1/projects/{id}` MUST менять `title`, `description`, `word_goal` и `goal_deadline` истории не в корзине; пустое `title` MUST давать `422`. `word_goal` MUST быть целым от 1 до 1 000 000 или `null`, `goal_deadline` — датой `YYYY-MM-DD` или `null`; иное MUST давать `422` с `detail`, называющим поле. Срок без цели (после изменения `goal_deadline` задан, а `word_goal` — `null`) MUST давать `422` с `detail`, называющим `goal_deadline`. Срок в прошлом MUST приниматься. Изменение MUST обновлять `updated_at`, ответ MUST содержать все поля истории из «Список историй», кроме `drafts_count` и `open_draft_id`.

#### Scenario: Переименование
- WHEN автор меняет название истории на «Маяк. Версия 2»
- THEN `GET /api/v1/projects` MUST показывать новое название

#### Scenario: Цель истории со сроком
- WHEN автор отправляет `PATCH /api/v1/projects/{id}` с `word_goal` = 20000 и `goal_deadline` = `2026-11-30`
- THEN ответ MUST быть `200` с этими значениями, а `title` и `description` MUST остаться прежними

#### Scenario: Срок без цели
- GIVEN у истории нет цели
- WHEN автор отправляет `PATCH /api/v1/projects/{id}` с `goal_deadline` = `2026-11-30`
- THEN ответ MUST быть `422` с `detail`, называющим `goal_deadline`, и история MUST NOT измениться

#### Scenario: Снять цель
- GIVEN у истории цель 20 000 и срок
- WHEN автор отправляет `PATCH /api/v1/projects/{id}` с `word_goal` = `null` и `goal_deadline` = `null`
- THEN ответ MUST содержать `word_goal` = `null` и `goal_deadline` = `null`

### Requirement: Текст сценария
`GET /api/v1/documents/{id}/text` MUST возвращать текст сценария (`content`) и его `revision`. `PUT /api/v1/documents/{id}/text` MUST заменять текст целиком и требовать `If-Match` с ревизией текста: без него — `428`, при несовпадении — `409`, текст MUST NOT меняться. Для документа без текста (персонаж, локация, мир) MUST возвращаться `404`. Успешный `PUT` MUST в той же транзакции записывать вызывающему прирост слов (`api/writing`, «Прирост слов при сохранении автором»); ответ от этого MUST NOT меняться.

#### Scenario: Сохранение текста
- WHEN автор сохраняет текст с `If-Match: 7`, и ревизия текста 7
- THEN ответ MUST содержать ревизию 8, и следующий `GET` MUST вернуть новый текст

#### Scenario: Устаревшая ревизия
- WHEN автор сохраняет текст с `If-Match: 6`, а ревизия текста 7
- THEN ответ MUST быть `409`, текст MUST остаться прежним

#### Scenario: Сохранение записывает прирост
- GIVEN в сценарии 100 слов
- WHEN автор сохраняет текст со 130 словами
- THEN ответ MUST содержать новую ревизию, а за текущий отрезок у автора по этой истории MUST добавиться прирост 30

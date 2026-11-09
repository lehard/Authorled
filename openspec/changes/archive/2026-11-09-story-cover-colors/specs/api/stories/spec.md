## ADDED Requirements

### Requirement: Цвет обложки истории
У каждой истории MUST быть цвет обложки `cover_color` — одно из значений `blue`, `teal`, `amber`, `crimson`, `plum`, `graphite`; пустого значения MUST NOT быть. Новой истории ядро MUST назначать цвет, следующий в этом порядке за цветом последней созданной истории того же автора (включая истории в корзине), после `graphite` — `blue`; у первой истории автора цвет MUST быть `blue`. Правило MUST быть одним для истории из JSON и из рукописи.

#### Scenario: Три истории подряд
- GIVEN у автора нет историй
- WHEN автор создаёт истории «Маяк», «Паром» и «Дача»
- THEN их `cover_color` MUST быть `blue`, `teal` и `amber`

#### Scenario: После последнего цвета
- GIVEN последняя созданная история автора имеет `cover_color` `graphite`
- WHEN автор создаёт новую историю
- THEN её `cover_color` MUST быть `blue`

#### Scenario: История из рукописи
- GIVEN последняя созданная история автора имеет `cover_color` `teal`
- WHEN автор создаёт историю из файла `паром.fountain`
- THEN её `cover_color` MUST быть `amber`

#### Scenario: Цвет выбран автором
- GIVEN автор сменил цвет последней созданной истории на `plum`
- WHEN автор создаёт новую историю
- THEN её `cover_color` MUST быть `graphite`

#### Scenario: Истории другого автора
- GIVEN у автора А три истории, у автора Б историй нет
- WHEN автор Б создаёт историю
- THEN её `cover_color` MUST быть `blue`

#### Scenario: Истории до появления цвета
- GIVEN истории автора созданы до появления `cover_color`
- WHEN применены миграции
- THEN у каждой истории MUST быть цвет, по кругу палитры в порядке их создания, начиная с `blue`

## MODIFIED Requirements

### Requirement: Список историй
`GET /api/v1/projects` MUST возвращать истории вызывающего: `id`, `title`, `description`, `format`, `cover_color`, `created_at`, `updated_at`, `deleted_at`, `drafts_count` (драфты не в корзине), `open_draft_id` (драфт, в котором история откроется у вызывающего), по убыванию `updated_at`. Без параметра или с `trash=false` MUST возвращаться истории не в корзине, с `trash=true` — только истории в корзине.

#### Scenario: Полка и корзина
- WHEN у автора истории «Маяк» и «Паром», и «Паром» удалена в корзину
- THEN `GET /api/v1/projects` MUST вернуть только «Маяк», а `GET /api/v1/projects?trash=true` — только «Паром»

#### Scenario: Число драфтов
- WHEN в истории три драфта, и один из них в корзине
- THEN `drafts_count` MUST быть 2

#### Scenario: Цвет в списке
- WHEN у автора история «Маяк» с цветом `teal`
- THEN `GET /api/v1/projects` MUST вернуть её с `cover_color` `teal`

### Requirement: Создание истории
`POST /api/v1/projects` с непустым `title` MUST создавать историю вызывающего с `format` `feature`, драфт «Драфт 1» и его сценарий: документ вида `script` с именем, равным названию, и пустым текстом из одного заголовка сцены с новым `uid`. Ответ `201` MUST содержать историю, `id` драфта и `id` сценария. Пустое или пробельное `title` MUST давать `422`.

#### Scenario: Новая история
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк"}`
- THEN ответ MUST быть `201`, у истории MUST быть один драфт «Драфт 1», и `GET /api/v1/drafts/{id}/documents` MUST содержать ровно один документ вида `script`

#### Scenario: Пустое название
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "  "}`
- THEN ответ MUST быть `422`, история MUST NOT создаваться

#### Scenario: Цвет в ответе создания
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк"}`
- THEN история в ответе MUST содержать `cover_color`, назначенный ядром

#### Scenario: Цвет при создании не принимается
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк", "cover_color": "plum"}`
- THEN ответ MUST быть `422`, и `detail` MUST называть поле `cover_color`

### Requirement: Изменение истории
`PATCH /api/v1/projects/{id}` MUST менять `title`, `description` и `cover_color` истории не в корзине; пустое `title` и `cover_color` вне палитры MUST давать `422`. Изменение `title` или `description` MUST обновлять `updated_at`; изменение только `cover_color` MUST NOT менять `updated_at`.

#### Scenario: Переименование
- WHEN автор меняет название истории на «Маяк. Версия 2»
- THEN `GET /api/v1/projects` MUST показывать новое название

#### Scenario: Смена цвета
- GIVEN история «Маяк» с цветом `blue` и `updated_at` 2026-11-01
- WHEN автор вызывает `PATCH /api/v1/projects/{id}` с `{"cover_color": "amber"}`
- THEN ответ MUST содержать `cover_color` `amber`, а `updated_at` MUST остаться 2026-11-01

#### Scenario: Цвет вне палитры
- WHEN автор вызывает `PATCH /api/v1/projects/{id}` с `{"cover_color": "pink"}`
- THEN ответ MUST быть `422`, `detail` MUST называть поле `cover_color`, и история MUST NOT меняться

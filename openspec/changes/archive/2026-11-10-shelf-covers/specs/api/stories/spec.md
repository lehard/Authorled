## MODIFIED Requirements

### Requirement: Цвет обложки истории
У каждой истории MUST быть цвет обложки `cover_color` — одно из значений `blue`, `teal`, `amber`, `crimson`, `plum`, `graphite`; пустого значения MUST NOT быть. Новой истории, для которой автор не передал `cover_color`, ядро MUST назначать цвет, следующий в этом порядке за цветом последней созданной истории того же автора (включая истории в корзине), после `graphite` — `blue`; у первой истории автора цвет MUST быть `blue`. Правило MUST быть одним для истории из JSON и из рукописи.

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

#### Scenario: Цвет при создании продолжает круг
- GIVEN автор создал историю с выбранным `cover_color` `crimson`
- WHEN автор создаёт следующую историю без `cover_color`
- THEN её `cover_color` MUST быть `plum`

#### Scenario: Истории другого автора
- GIVEN у автора А три истории, у автора Б историй нет
- WHEN автор Б создаёт историю
- THEN её `cover_color` MUST быть `blue`

#### Scenario: Истории до появления цвета
- GIVEN истории автора созданы до появления `cover_color`
- WHEN применены миграции
- THEN у каждой истории MUST быть цвет, по кругу палитры в порядке их создания, начиная с `blue`

## ADDED Requirements

### Requirement: Создание новой истории
`POST /api/v1/projects` с непустым `title` MUST создавать историю вызывающего с `format` `feature`, драфт «Драфт 1» и его сценарий: документ вида `script` с именем, равным названию. Без `template` текст сценария MUST быть пустым текстом из одного заголовка сцены с новым `uid`; с `template` — текстом каркаса (требование «Текст из каркаса»). Ответ `201` MUST содержать историю, `id` драфта и `id` сценария. Пустое или пробельное `title` MUST давать `422`.

#### Scenario: Новая история
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк"}`
- THEN ответ MUST быть `201`, у истории MUST быть один драфт «Драфт 1», и `GET /api/v1/drafts/{id}/documents` MUST содержать ровно один документ вида `script`

#### Scenario: Пустое название
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "  "}`
- THEN ответ MUST быть `422`, история MUST NOT создаваться

#### Scenario: Без каркаса
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк"}`
- THEN текст сценария MUST состоять из одного пустого заголовка сцены

#### Scenario: Цвет в ответе создания
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк"}`
- THEN история в ответе MUST содержать `cover_color`, назначенный ядром

### Requirement: Цвет при создании
`POST /api/v1/projects` MAY принимать `cover_color` — цвет палитры («Цвет обложки истории»): в JSON полем объекта, в multipart с файлом рукописи полем формы. С ним история MUST получать этот цвет, без него — цвет по правилу «Цвет обложки истории». `cover_color` вне палитры MUST давать `422` с `detail`, называющим `cover_color`, и история MUST NOT создаваться.

#### Scenario: Цвет выбран при создании
- GIVEN последняя созданная история автора бирюзовая
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк", "cover_color": "plum"}`
- THEN ответ MUST быть `201`, и история MUST иметь `cover_color` `plum`

#### Scenario: Цвет вне палитры при создании
- WHEN автор вызывает `POST /api/v1/projects` с `{"title": "Маяк", "cover_color": "pink"}`
- THEN ответ MUST быть `422`, `detail` MUST называть поле `cover_color`, и история MUST NOT создаваться

#### Scenario: Рукопись с цветом
- WHEN автор создаёт историю multipart-запросом с `title` «Паром», файлом `паром.fountain` и `cover_color` `crimson`
- THEN ответ MUST быть `201`, и история MUST иметь `cover_color` `crimson`

### Requirement: Цвет новой истории
`GET /api/v1/projects/next-cover-color` MUST возвращать `200` с `{"cover_color": <цвет>}` — цвет, который ядро назначило бы следующей истории вызывающего, созданной без `cover_color` (требование «Цвет обложки истории»). Маршрут MUST NOT создавать и менять истории.

#### Scenario: Первая история
- GIVEN у автора нет историй
- WHEN автор вызывает `GET /api/v1/projects/next-cover-color`
- THEN ответ MUST быть `{"cover_color": "blue"}`

#### Scenario: После бирюзовой
- GIVEN последняя созданная история автора, сейчас в корзине, бирюзовая
- WHEN автор вызывает `GET /api/v1/projects/next-cover-color`
- THEN ответ MUST быть `{"cover_color": "amber"}`

#### Scenario: Совпадает с созданием
- GIVEN маршрут вернул автору `amber`
- WHEN автор создаёт историю без `cover_color`
- THEN её `cover_color` MUST быть `amber`

## REMOVED Requirements

### Requirement: Создание истории
**Reason**: Сценарий «Цвет при создании не принимается» больше не верен: создание принимает `cover_color`. Требование заменено «Создание новой истории» с тем же поведением и выбором цвета.
**Migration**: Клиенты, которые рассчитывали на `422` при `cover_color` в `POST /api/v1/projects`, получают историю этого цвета; остальное поведение без изменений.

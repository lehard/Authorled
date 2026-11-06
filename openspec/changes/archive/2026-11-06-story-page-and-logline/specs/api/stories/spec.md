## MODIFIED Requirements

### Requirement: Виды документов и их поля
Документ MUST иметь вид `character`, `location`, `world` или `script` и непустое `name`. `role` (`main`, `secondary`, `episodic`) MUST быть только у персонажа и локации. `fields` MUST содержать только поля своего вида: профиль макета v2 (`PROFILE`), у персонажа `age` и `gender`, у мира `overview`, у сценария `logline`, `show`, `title_page`, `synopsis`. `show` MUST задавать все части: `title`, `logline`, `synopsis`, `treatment`, `text`. Имя сценария MUST быть «Сценарий» у каждого драфта; правка `name` сценария MUST давать `422`. Неизвестное поле или неверный тип значения MUST давать `422` с именем поля.

#### Scenario: Поле чужого вида
- WHEN автор сохраняет у локации поле `age`
- THEN ответ MUST быть `422`, и `detail` MUST называть `age`

#### Scenario: Роль у мира
- WHEN автор создаёт мир с `role` `main`
- THEN ответ MUST быть `422`

#### Scenario: Тэглайн у сценария
- WHEN автор сохраняет у сценария поле `tagline`
- THEN ответ MUST быть `422`, и `detail` MUST называть `tagline`

#### Scenario: Часть без логлайна
- WHEN автор сохраняет `show` без `logline`
- THEN ответ MUST быть `422`, и `detail` MUST называть `show.logline`

#### Scenario: Имя сценария
- GIVEN создана история «Маяк»
- WHEN автор читает документы драфта и меняет `name` сценария
- THEN имя сценария MUST быть «Сценарий», а ответ на правку MUST быть `422`

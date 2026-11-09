## ADDED Requirements

### Requirement: Название продукта у соавтора
Промпт соавтора MUST называть продукт «Соавтор», а в ответах соавтор MUST называть продукт «Соавтор» и MUST NOT называть его Authorled или CoAuthor. Описание контекста, которое чат передаёт соавтору, MUST называть продукт так же.

#### Scenario: Вопрос о названии
- GIVEN автор в чате истории
- WHEN он спрашивает «Как называется этот сервис?»
- THEN соавтор MUST ответить, что сервис называется «Соавтор»
- AND в ответе MUST NOT быть слов Authorled и CoAuthor

#### Scenario: Промпт без старого названия
- GIVEN `agno/skills/coauthor/SKILL.md`
- WHEN в нём ищутся слова Authorled и CoAuthor
- THEN совпадений MUST NOT быть

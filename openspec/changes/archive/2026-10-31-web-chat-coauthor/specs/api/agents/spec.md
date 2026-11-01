## MODIFIED Requirements

### Requirement: Зарегистрированные агенты
`GET /agents` MUST возвращать агентов `claude-engineer` (`Claude Engineer`, metadata `sdk: claude-agent-sdk`), `company-manager-internal` (`Company Manager`, модель `deepseek-thinking`) и продуктового агента `coauthor` (`Соавтор`). Все MUST использовать БД `agentos-db`; при отсутствии sandbox поле `sandboxed` MUST быть `false`.

#### Scenario: Неизвестный агент
- GIVEN агента `nope` не существует
- WHEN клиент выполняет `GET /agents/nope`
- THEN система MUST вернуть `404`

#### Scenario: Codex Engineer снят
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /agents/codex-engineer`
- THEN система MUST вернуть `404`

## ADDED Requirements

### Requirement: Соавтор
Агент `coauthor` MUST отвечать по-русски, опираясь на контекст, присланный фронтендом (история, открытый документ, выделенный фрагмент), и на историю беседы. Он MUST NOT иметь инструментов, MUST NOT утверждать, что изменил текст автора, и MUST NOT сохранять память о пользователе или содержание произведения вне сессии беседы. Модель — `default_model()` через LiteLLM.

#### Scenario: Ответ по контексту
- GIVEN контекст AG-UI содержит открытый документ «Вера» с полем «Главный страх: Что Аня узнает правду и уйдёт»
- WHEN автор спрашивает «Чего боится героиня?»
- THEN ответ MUST опираться на этот страх

### Requirement: AG-UI соавтора
`POST /agents/coauthor/agui` MUST принимать запуск AG-UI (`RunAgentInput`) и отдавать события AG-UI потоком SSE. `thread_id` запроса MUST быть идентификатором сессии Agno; `user_id` MUST браться из токена, а не из тела запроса. Без токена MUST возвращаться `401`, без scope `agents:coauthor:run` — `403`.

#### Scenario: Без токена
- GIVEN запрос без `Authorization`
- WHEN клиент вызывает `POST /agents/coauthor/agui`
- THEN система MUST вернуть `401`

#### Scenario: Сессия автора
- GIVEN автор отправил сообщение с `thread_id` = `water:1`
- WHEN он запрашивает `GET /sessions?type=agent&component_id=coauthor`
- THEN список MUST содержать сессию `water:1`, а у другого пользователя MUST NOT

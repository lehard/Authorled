## MODIFIED Requirements

### Requirement: Права по группам
Группы Authentik (`screenwriters`, `editors`, `admins`, `plugins`) MUST сопоставляться с правами (scopes) AgentOS; набор прав каждой группы MUST задаваться модулем `auth` в коде и MUST заменять сохранённый при каждом запуске. Группы авторов (`screenwriters`, `editors`) MUST получать право запуска только продуктовых агентов, по одному scope на агента (`agents:<id>:run`, сейчас — `agents:coauthor:run`); общие права запуска агентов, команд и workflows (`agents:run`, `agents:*:run` и т. п.) группам авторов и плагинов MUST NOT выдаваться: платформенные агенты (OS Manager, `claude-engineer`) исполняют команды и правят файлы на сервере. Маршрут или агент, требующий scope, которого нет в токене, MUST отвечать `403` до запуска LLM. Группа `admins` MUST получать административные scopes; группы `screenwriters` и `editors` MUST получать только перечисленные в сопоставлении.

#### Scenario: Нет нужного scope
- GIVEN токен пользователя группы `screenwriters`, в сопоставлении которой нет scope маршрута
- WHEN клиент вызывает этот маршрут
- THEN система MUST вернуть `403`
- AND LLM MUST NOT вызываться

#### Scenario: Scope есть
- GIVEN токен пользователя группы, scopes которой включают scope маршрута
- WHEN клиент вызывает этот маршрут
- THEN система MUST выполнить запрос

#### Scenario: Автор и платформенный агент
- GIVEN токен пользователя группы `screenwriters`
- WHEN клиент вызывает `POST /agents/claude-engineer/runs`
- THEN система MUST вернуть `403`

#### Scenario: Автор и соавтор
- GIVEN токен пользователя группы `editors`
- WHEN клиент вызывает `POST /agents/coauthor/agui`
- THEN система MUST выполнить запрос

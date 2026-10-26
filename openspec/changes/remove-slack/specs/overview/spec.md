# Spec Delta

## MODIFIED Requirements

### Requirement: Каналы доступа
Система MUST предоставлять REST API (`openspec/specs/api/*`) и MCP-endpoint `/mcp` (`openspec/specs/api/mcp/spec.md`). Чат-интерфейсы сторонних мессенджеров (в том числе Slack) система MUST NOT подключать, даже если в окружении заданы переменные `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`.

#### Scenario: Без Slack
- GIVEN переменные Slack не заданы
- WHEN клиент выполняет `GET /config`
- THEN `interfaces` MUST быть пустым списком

#### Scenario: Переменные Slack в окружении
- GIVEN в окружении заданы `SLACK_BOT_TOKEN` и `SLACK_SIGNING_SECRET`
- WHEN платформа запущена и клиент выполняет `GET /config`
- THEN `interfaces` MUST быть пустым списком

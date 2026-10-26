# Spec Delta

## MODIFIED Requirements

### Requirement: Сведения об инстансе
`GET /info` MUST возвращать `agno_version` `3.1.10`, `agent_count` `2`, `team_count` `1`, `workflow_count` `0` и блок `mcp` с `enabled: true` и `path: "/mcp"`. `GET /config` MUST возвращать `os_database: "agentos-db"`, единственную БД `agentos-db` в `databases`, `queue` с `durable: true` и `queue_per_session: true`, пустой `interfaces` и `manifest` с описаниями и quick prompts из `app/config.yaml` для `os-manager-internal`, `company-manager-internal`, `claude-engineer`.

#### Scenario: Конфигурация для UI
- GIVEN платформа запущена из репозитория
- WHEN клиент выполняет `GET /config`
- THEN `manifest` MUST содержать 3 компонента из `app/config.yaml`
- AND `interfaces` MUST быть пустым списком
- AND `available_models` MUST содержать `deepseek-thinking` и MUST NOT содержать моделей Anthropic или OpenAI

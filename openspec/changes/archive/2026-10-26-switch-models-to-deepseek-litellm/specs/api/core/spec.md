# Spec Delta

## MODIFIED Requirements

### Requirement: Сведения об инстансе
`GET /info` MUST возвращать `agno_version` `3.1.10`, `agent_count` `2`, `team_count` `1`, `workflow_count` `0` и блок `mcp` с `enabled: true` и `path: "/mcp"`. `GET /config` MUST возвращать `os_database: "agentos-db"`, единственную БД `agentos-db` в `databases`, `queue` с `durable: true` и `queue_per_session: true`, `interfaces: []` без Slack и `manifest` с описаниями и quick prompts из `app/config.yaml` для `os-manager-internal`, `company-manager-internal`, `claude-engineer`.

#### Scenario: Конфигурация для UI
- GIVEN платформа запущена из репозитория без переменных Slack
- WHEN клиент выполняет `GET /config`
- THEN `manifest` MUST содержать 3 компонента из `app/config.yaml`
- AND `available_models` MUST содержать `deepseek-thinking` и MUST NOT содержать моделей Anthropic или OpenAI

### Requirement: Состав реестра
`GET /registry` MUST возвращать 15 элементов, объявленных в `app/registry.py` и `app/main.py`: агент `Claude Engineer`, БД `agentos-db`, функции `content_to_file`, `csv_to_markdown_table`, `extract_json`, `extract_urls`, `json_to_csv`, знание `shared-knowledge`, learning `shared-learning`, модели `deepseek-fast` и `deepseek-thinking`, инструменты `calculator`, `file_generation`, `filesystem`, `parallel_tools`.

#### Scenario: Веб-инструменты без ключа Parallel
- GIVEN `PARALLEL_API_KEY` не задан, а `PARALLEL_MODE` в `app/registry.py` равен `keyless_mcp` (значение в коде)
- WHEN строится реестр
- THEN инструмент `parallel_tools` MUST быть `MCPTools` на `https://search.parallel.ai/mcp` (streamable-http, таймаут 30 с)

#### Scenario: Веб-инструменты с ключом Parallel
- GIVEN `PARALLEL_API_KEY` задан, а `PARALLEL_MODE` равен `keyless_mcp`
- WHEN строится реестр
- THEN система MUST использовать тот же `MCPTools` без ключа: режим выбирает `PARALLEL_MODE`, а не наличие ключа

#### Scenario: Веб-инструменты в режиме sdk
- GIVEN `PARALLEL_MODE` равен `sdk`
- WHEN строится реестр
- THEN система MUST использовать `ParallelTools()`, а без `PARALLEL_API_KEY` MUST завершиться `RuntimeError`, называющей `PARALLEL_API_KEY`

# Spec Delta

## MODIFIED Requirements

### Requirement: Зарегистрированные агенты
`GET /agents` MUST возвращать агентов `claude-engineer` (`Claude Engineer`, metadata `sdk: claude-agent-sdk`) и `company-manager-internal` (`Company Manager`, модель `deepseek-thinking`). Все MUST использовать БД `agentos-db`; при отсутствии sandbox поле `sandboxed` MUST быть `false`.

#### Scenario: Неизвестный агент
- GIVEN агента `nope` не существует
- WHEN клиент выполняет `GET /agents/nope`
- THEN система MUST вернуть `404`

#### Scenario: Codex Engineer снят
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /agents/codex-engineer`
- THEN система MUST вернуть `404`

### Requirement: Конфигурация инженеров
`claude-engineer` MUST создаваться как `ClaudeAgent` с моделью `deepseek-thinking`, `system_prompt` preset `claude_code` и `permission_mode="acceptEdits"`. Процесс Claude Code MUST получать адрес прокси как `ANTHROPIC_BASE_URL` и ключ прокси как `ANTHROPIC_API_KEY`, перекрывающие унаследованные значения; модели по умолчанию Claude Code MUST быть псевдонимами прокси (`deepseek-thinking`, для лёгких запросов `deepseek-fast`); необязательный трафик Claude Code MUST быть выключен. Без sandbox инженер MUST работать в абсолютном корне репозитория (`cwd`) на сервере AgentOS и MUST NOT получать `repository`.

#### Scenario: Sandbox без репозитория
- GIVEN `sandbox_provider()` возвращает sandbox, а `REPOSITORY` равен `None`
- WHEN импортируется `agents/engineers.py`
- THEN импорт MUST завершиться `ValueError("Set REPOSITORY in app/sandbox.py before enabling a sandbox.")`

#### Scenario: Sandbox с репозиторием
- GIVEN sandbox включён и `REPOSITORY` задан
- WHEN создаются инженеры
- THEN `cwd` MUST быть `None`, а `repository` MUST быть равен `REPOSITORY`

#### Scenario: Инженер без адреса прокси
- GIVEN `LITELLM_URL` не задан
- WHEN импортируется `agents/engineers.py`
- THEN импорт MUST завершиться ошибкой, называющей `LITELLM_URL`

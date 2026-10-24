# Spec Delta

## MODIFIED Requirements

### Requirement: OS Manager
`GET /teams` MUST возвращать команду `os-manager-internal` (`OS Manager`) в режиме `coordinate` с моделью `deepseek-thinking` и участниками `platform-builder-internal`, `platform-manager-internal`, `company-manager-internal`. Команду MUST создавать Agno через `OSManager(root=agentos_root, model=manager_model(), learning=shared_learning)`; репозиторий MUST NOT объявлять собственных команд (каталога `teams/` нет). Участников `platform-builder-internal` и `platform-manager-internal` определяет Agno; их назначение и поведение описаны в документации Agno (https://docs.agno.com/agent-platform/overview, https://docs.agno.com/agent-platform/run-local) и здесь не дублируются.

#### Scenario: Неизвестная команда
- GIVEN команды `nope` не существует
- WHEN клиент выполняет `GET /teams/nope`
- THEN система MUST вернуть `404`

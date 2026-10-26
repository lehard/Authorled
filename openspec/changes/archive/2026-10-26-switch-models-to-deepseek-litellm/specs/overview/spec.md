# Spec Delta

## MODIFIED Requirements

### Requirement: Состав компонентов
Система MUST регистрировать агента `claude-engineer` (из `agents/engineers.py`) и встроенного `company-manager-internal`, а также встроенную команду `os-manager-internal`. Система MUST NOT регистрировать `codex-engineer` и workflows.

#### Scenario: Счётчики инстанса
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /info`
- THEN ответ MUST содержать `agent_count: 2`, `team_count: 1`, `workflow_count: 0`

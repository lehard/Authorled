# Glossary Specification

## Purpose
Глоссарий терминов кода, конфигурации и API. Термины сущностей и атрибутов MUST использоваться на английском так, как записаны в коде. Доменные термины продукта (Документ Д1–Д22, Чек-лист, Граф связей, План пересмотра, Утверждение и др.) определены в `openspec/context/02-domain-glossary.md`; в текущем коде они не реализованы.

## Requirements

### Requirement: Единые термины
Документация и код MUST использовать термины ниже в указанном значении; синонимы SHOULD NOT применяться.

| Термин | Значение | Источник |
| --- | --- | --- |
| AgentOS | Runtime Agno: превращает агентов, команды и workflows в HTTP-сервис с MCP, планировщиком и очередью | `app/main.py` |
| Agent | Исполнитель с моделью и инструментами | `GET /agents` |
| ClaudeAgent | Внешний агент (`BaseExternalAgent`) на `claude-agent-sdk`: Claude Code, работающий на DeepSeek через Anthropic-endpoint LiteLLM-прокси | `agents/engineers.py` |
| Engineer | `claude-engineer`: агент, работающий с кодом репозитория | `agents/engineers.py` |
| LiteLLM-прокси | Единственный шлюз к моделям; приложение обращается к нему по псевдонимам `deepseek-fast`, `deepseek-thinking` и псевдонимы эмбеддингов из `EMBEDDINGS_MODEL` | `litellm/config.yaml` |
| Team | Группа агентов; `os-manager-internal` работает в режиме `coordinate` | `GET /teams` |
| OS Manager | Встроенная команда управления платформой (`OSManager`) | `app/main.py` |
| Company Manager | Встроенный агент CompanyOS `company-manager-internal` | `GET /agents` |
| CompanyOS | Модуль планирования: Product, Source, Routine, Project, Task, Decision, wiki | `app/company.py` |
| Product | Объект CompanyOS (`this-agentos`); не проект книги автора | `app/company.py` |
| Source | Источник Product: `website` или `git` | `app/company.py` |
| Routine | Периодическое задание Product с `cron_expr`, исполняемое `agent`, `team` или `workflow` | `app/company.py` |
| Project / Task | Единицы работы CompanyOS со статусами и `transitions` | `/company/*` |
| Decision | Зафиксированное решение CompanyOS | `/company/decisions` |
| Schedule | Cron-расписание вызова маршрута AgentOS | `/schedules` |
| Run | Один ход агента, команды или workflow; статус `RunStatus` | `/agents/{agent_id}/runs` |
| Session | Диалог с `session_id` | `/sessions` |
| Approval | Запрос подтверждения человеком для приостановленного хода | `/approvals` |
| Queue (durable) | Очередь ходов в PostgreSQL с упорядочиванием по сессии | `app/main.py` |
| Registry | Палитра компонентов Studio (tools, models, functions, dbs, learning, knowledge) | `app/registry.py` |
| Knowledge | База знаний на pgvector с гибридным поиском (`shared-knowledge`) | `db/__init__.py` |
| LearningMachine | Профили и воспоминания пользователей (`shared-learning`, `AGENTIC`) | `app/registry.py` |
| FileSystem | Заметки в PostgreSQL (`shared-notes`) | `app/registry.py` |
| Component | Версионируемый объект Studio с конфигурациями | `/components` |
| Sandbox | Изолированная среда исполнения инженеров (Docker или AgentCore); по умолчанию выключена | `app/sandbox.py` |
| Repository | Репозиторий для checkout в sandbox; по умолчанию `None` | `app/sandbox.py` |
| MCP | Model Context Protocol; endpoint `/mcp` | `app/interfaces.py` |
| `RUNTIME_ENV` | `dev` отключает авторизацию; любое другое значение (по умолчанию `prd`) включает | `app/main.py` |
| Service account | Неинтерактивная учётная запись API | `/service-accounts` |

#### Scenario: Именование исполнителя
- GIVEN автор описывает нового исполнителя
- WHEN он называет его в документации
- THEN он MUST использовать «Agent», а не «bot» или «assistant»

#### Scenario: Product и проект книги
- GIVEN документ говорит о проекте произведения автора
- WHEN нужно сослаться на сущность
- THEN автор MUST NOT использовать для этого Product, Project или Task CompanyOS

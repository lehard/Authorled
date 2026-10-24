# Glossary Specification

## Purpose
Глоссарий терминов, используемых в коде, конфигурации и API репозитория. Названия сущностей и атрибутов MUST оставаться на английском так, как они записаны в коде.

## Requirements

### Requirement: Единые термины проекта
Документация и код MUST использовать термины ниже в указанном значении. Синонимы SHOULD NOT применяться.

| Термин | Значение | Источник |
| --- | --- | --- |
| AgentOS | Runtime Agno, превращающий агентов, команды и workflows в сервис с REST API, MCP, планировщиком и очередью | `app/main.py` |
| Agent | Исполнитель с моделью и инструментами; в проекте — `claude-engineer`, `codex-engineer`, `company-manager-internal` | `agents/engineers.py`, `GET /agents` |
| ClaudeAgent / CodexAgent | Внешние агенты (`BaseExternalAgent`), работающие через `claude-agent-sdk` и Codex SDK | `agents/engineers.py` |
| Team | Группа агентов; `os-manager-internal` работает в режиме `coordinate` | `GET /teams` |
| OS Manager | Встроенная команда управления платформой (`OSManager`), создаёт агентов и проверяет здоровье | `app/main.py`, `app/config.yaml` |
| Company Manager | Встроенный агент CompanyOS (`company-manager-internal`) для планирования работ по Product/Project | `app/config.yaml` |
| CompanyOS | Модуль планирования: Product, Source, Routine, Project, Task, Decision, wiki | `app/company.py`, `/company/*` |
| Product | Объект CompanyOS с целью, источниками и рутинами; в проекте — `this-agentos` | `app/company.py` |
| Source | Источник данных Product: `website` или `git` | `app/company.py` |
| Routine | Периодическое задание Product с `cron_expr`; в проекте — `agentos-maintenance` (`0 9 * * *`) | `app/company.py` |
| Project / Task | Единицы работы CompanyOS; задачи могут быть в статусе Backlog и переходят через `transitions` | `app/company.py`, `/company/*` |
| Registry | Реестр компонентов (инструменты, модели, функции, БД, знания, learning), доступных Studio и OS Manager | `app/registry.py` |
| Knowledge | База знаний с гибридным поиском на pgvector; в проекте — `shared-knowledge` | `app/registry.py`, `db/__init__.py` |
| LearningMachine | Механизм накопления профиля и памяти пользователя; `shared-learning` в режиме `AGENTIC` | `app/registry.py` |
| Memory | Пользовательские воспоминания (`/memories`) | `GET /config` |
| Session | Диалог с идентификатором `session_id` | `/sessions` |
| Run | Один запуск агента, команды или workflow | `/agents/{agent_id}/runs` |
| Schedule | Расписание cron для запуска компонента (`scheduler=True`) | `/schedules` |
| Queue (durable) | Долговечная очередь задач в БД, `queue_per_session: true` | `app/main.py`, `GET /config` |
| Approval | Запрос подтверждения действия человеком | `/approvals` |
| Sandbox | Изолированная среда выполнения инженеров (Docker или AgentCore); по умолчанию отключена | `app/sandbox.py` |
| Repository | Репозиторий, который клонируется в sandbox; по умолчанию `None` | `app/sandbox.py` |
| MCP | Model Context Protocol; endpoint `/mcp`, инструмент `agno` | `app/interfaces.py` |
| `RUNTIME_ENV` | Режим среды: `dev` отключает авторизацию, любое другое значение (по умолчанию `prd`) включает | `app/main.py` |
| User isolation | Разделение данных по `user_id` (`user_isolation=True`) | `app/main.py` |
| User directory | Каталог пользователей `/users` (`user_directory=True`) | `app/main.py` |
| Component | Версионируемый объект конфигурации (`/components`) | OpenAPI |
| Service account | Неинтерактивная учётная запись для API | `/service-accounts` |

#### Scenario: Использование термина
- GIVEN автор добавляет новый агент
- WHEN он описывает исполнителя в документации
- THEN он MUST называть его «Agent», а не «bot» или «assistant»

# Design

## Context

- Мотивация — `proposal.md`, требования — дельты `web/workspace`, `auth`, `api/agents`.
- Agno 3.1.10, проверено 2026-10-31:
  - `agno.os.interfaces.agui.AGUI(agent=…, prefix=…)` добавляет `POST {prefix}/agui`; scope маршрута — `agents:run`. Обработчик берёт `user_id` из токена (`resolve_run_user_id`), проверяет владельца сессии, `thread_id` = `session_id`, контекст AG-UI (`context`) кладёт в `dependencies` и в контекст модели, вложения (`image`/`document`) передаёт агенту.
  - Модуль требует пакет `ag-ui-protocol` (extra `agui`), в окружении его нет.
  - Права: формат `agents:<id>:run`; middleware берёт id агента из пути `/agents/<id>/…`. `has_required_scopes(["agents:coauthor:run"], ["agents:run"])` без id в пути — `False`, с `resource_id="coauthor"` — `True`.
  - Группы `screenwriters`/`editors` (`agno/app/auth/authorization.py`, `_USER_SCOPES`) имеют `sessions:*` и `memories:*`, запуска агентов нет.
- CopilotKit 1.83 (последняя старше двух недель — 1.79.1): `@copilotkit/react-core/v2` — провайдер с `selfManagedAgents` (агент AG-UI без сервера CopilotKit), хуки `useAgent`, `useAgentContext`, готовый `CopilotChat`. Телеметрия (`telemetry.copilotkit.ai`) — только в серверном пакете (`@copilotkit/shared/telemetry`), в `react-core/v2` её нет.
- Фронтенд: `RefineRoot`, `ProjectScreen` с `ChatColumn` (заглушка), `useProjectData()` даёт историю, сценарий, сущности и открытый документ; токен — `activeUser()` из `auth/userManager.ts`.
- Образец интерфейса — чат макета v2 (`renderChat` в `app.js`): шапка, сообщения, подсказки, плашка выделения, история бесед.

## Goals / Non-Goals

**Goals:** живой чат с продуктовым агентом, не открывающий авторам платформенных агентов; интерфейс по макету v2 в дизайн-системе; беседы в сессиях Agno.

**Non-Goals:** см. proposal.

## Decisions

1. **Агент `coauthor`** (`agno/agents/coauthor.py`) по форме из `create-agent`: стабильный id `coauthor`, имя «Соавтор», `default_model()`, общая БД `get_postgres_db()`, `add_history_to_context=True` (последние 10 ходов), `add_datetime_to_context=True`, без инструментов, без `learning`. Инструкции на русском: помогать автору с историей; опираться на присланный контекст и не выдумывать факты истории, которых в нём нет; не говорить, что изменил текст, — предлагать варианты текстом; коротко и по делу. Описание и подсказки — в `agno/app/config.yaml`.

2. **AG-UI на пути агента.** `AGUI(agent=coauthor, prefix="/agents/coauthor")` → `POST /agents/coauthor/agui`. Путь под `/agents/<id>/` нужен, чтобы middleware Agno сопоставил узкий scope `agents:coauthor:run` с id агента (см. Context). Регистрация — в `interfaces=[…]` AgentOS в `agno/app/main.py`. Зависимость: `agno[…, agui]` в `pyproject.toml`, `requirements.txt` перегенерировать; версия `ag-ui-protocol` — та, что ставит extra; совместимость с `@ag-ui/client` 1.0 проверяется вживую (задача 1.3).
   *Альтернатива:* `agents:*:run` или `agents:run` авторам. Отклонено: открывает `claude-engineer` с shell.

3. **Права.** `GROUP_SCOPES["screenwriters"]` и `["editors"]` = `_USER_SCOPES + ("agents:coauthor:run",)`. `scripts/check_auth_boundary.sh` сверяет только состав групп — не меняется.

4. **Доступ фронтенда к AgentOS.** Путь `/os/` на адресе фронтенда: в разработке прокси Vite на `AGENTOS_URL` (`rewrite` без `/os`); тот же путь — на обратном прокси прода (деплой фронта — отдельный change). Токен — `Authorization: Bearer` из `activeUser()`; запрос к AG-UI делает `HttpAgent` из `@ag-ui/client` с заголовком, который обновляется перед каждым запуском (токен живёт 10 минут). CORS не нужен.

5. **CopilotKit без его интерфейса.** Провайдер `CopilotKitProvider` с `selfManagedAgents={{ coauthor: httpAgent }}`, `showDevConsole={false}`, без `publicApiKey`/`runtimeUrl`. Интерфейс чата свой (`screens/project/chat/`): сообщения из `useAgent`, контекст — `useAgentContext`. Готовый `CopilotChat` не используется: его вид — не дизайн-система (требование «Без системного вида» и решение «всё в нашем дизайне»). Markdown ответов — `react-markdown` с нашими стилями (заголовки, списки, жирный, код), без HTML.

6. **Контекст.** Одна запись `useAgentContext` «Что открыто у автора»: название истории; тип и название документа; содержимое документа в тексте (для текста сценария — абзацы с типами, для профиля — заполненные поля, для синопсиса — текст), не длиннее 20 000 символов (длиннее — обрезка с пометкой «текст обрезан»); выделенный фрагмент. Выделение берётся из `selectionchange` внутри рабочего поля, не длиннее 2000 символов, и показывается плашкой.

7. **Беседы.** `thread_id` = `<projectId>:<uuid>`. Список: `GET /os/sessions?type=agent&component_id=coauthor&limit=100&sort_by=updated_at&sort_order=desc` и фильтр по префиксу `<projectId>:` на клиенте. Название беседы — `POST /os/sessions/{id}/rename` с первыми 48 символами первого сообщения после первого ответа. Открытие — `GET /os/sessions/{id}/runs` → сообщения AG-UI → `agent.setMessages`, `agent.threadId = id`. Проверяется в задаче 2.3: точные параметры и форма ответа берутся из OpenAPI работающего API (`/openapi.json`), расхождение — правка design, а не обход.

8. **Ошибки.** Событие `RUN_ERROR` и сетевые ошибки — сообщение-ошибка в ленте с текстом причины; `401` — переход на `/login`; `403` — «Нет права говорить с соавтором (`agents:coauthor:run`)». Отправленный текст при ошибке возвращается в поле.

9. **Eval.** Кейс `coauthor_uses_context` в `agno/evals/cases.py`: в контексте профиль Веры, вопрос «Чего боится героиня?», критерий — ответ о страхе, что Аня узнает правду; тег `coauthor`. Запуск тратит вызов модели — по команде, не в `validate.sh`.

## Risks / Trade-offs

- [`ag-ui-protocol` 1.0 и `@ag-ui/client` 1.0 могут разойтись с тем, что ожидает Agno 3.1.10] → задача 1.3 проверяет поток вживую до фронтенда; несовместимость — стоп и решение владельца (версия пакета), без адаптеров (CLAUDE.md: без compatibility adapters).
- [Контекст до 20 000 символов на каждый ход дорог] → предел и только открытый документ; полнотекстовый поиск по истории — с ядром.
- [Агент не знает историю целиком] → так и задумано до ядра; инструкции требуют не выдумывать.
- [Список сессий без серверного фильтра по истории] → до 100 последних бесед пользователя, фильтр на клиенте; серверный фильтр — с ядром (беседа как сущность проекта).

## Migration Plan

`pip`/`uv` установка `agno[agui]`, пересборка образов (`docker compose up -d --build`). Данных нет. Откат — revert; scope `agents:coauthor:run` пропадёт из ролей при следующем старте (роли перезаписываются).

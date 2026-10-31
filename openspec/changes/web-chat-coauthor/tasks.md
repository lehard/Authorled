# Tasks

## 1. Бэкенд

- [x] 1.1 `agno[…, agui]` в `agno/pyproject.toml`, `./agno/scripts/generate_requirements.sh`, установка в `agno/.venv`. Проверка: `python -c "from agno.os.interfaces.agui import AGUI"`.
- [x] 1.2 `agno/agents/coauthor.py`, регистрация агента и `AGUI(prefix="/agents/coauthor")` в `agno/app/main.py`, описание и подсказки в `config.yaml`, scope `agents:coauthor:run` для `screenwriters` и `editors` (решения 1–3). Проверка: `./scripts/validate.sh`; `docker compose up -d --build`; `GET /agents` содержит `coauthor`.
- [x] 1.3 Проверка вживую с токеном `editor@authorled.test` (через поток входа): `POST /agents/coauthor/agui` с `RunAgentInput` отдаёт SSE с `RUN_STARTED`, `TEXT_MESSAGE_CONTENT`, `RUN_FINISHED`; без токена — `401`; токен `sa-dev` (`plugins`) — `403`; `POST /agents/claude-engineer/runs` с токеном автора — `403`; сессия появляется в `GET /sessions` автора.
- [x] 1.4 Eval `coauthor_uses_context` (решение 9). Проверка: `python -m evals --tag coauthor` (тратит вызов модели) — ответ и причина судьи прочитаны.

## 2. Фронтенд

- [x] 2.1 Зависимости `@copilotkit/react-core` 1.79.1, `@ag-ui/client` (версия из зависимостей CopilotKit), `react-markdown` 10.1.0; прокси `/os/` (решение 4); провайдер CopilotKit с `HttpAgent` и токеном (решение 5).
- [x] 2.2 Чат в `screens/project/chat/`: лента, стриминг, Markdown, «Скопировать», подсказки пустой беседы, поле ввода, ошибки (решения 5, 8); контекст и плашка выделения (решение 6); `ChatColumn` и лист на узком экране используют его.
- [x] 2.3 Беседы: «Новая беседа», «История бесед», открытие беседы, название по первому сообщению (решение 7), с проверкой параметров по `/openapi.json`.

## 3. Документы и итог

- [x] 3.1 README (`web/`: чат, `/os/`; модуль `auth`: scope соавтора), `openspec/TODO.md`.
- [x] 3.2 Ручная проверка в Chrome на 1440 и 375 px, светлая и тёмная темы, по сценариям дельты `web/workspace`; сеть — запросы только к своему адресу (`/os/`, `/api/v3/…`), нет `copilotkit.ai`; ошибок в консоли нет.
- [x] 3.3 `./scripts/validate.sh`, `./scripts/auth_check.sh`, `git diff --check`, `openspec validate web-chat-coauthor --strict`; итоги и ограничения — в `tmp/VERIFY.md`.

# TODO: недокументированное и расхождения

Источник правды — код репозитория и OpenAPI/ответы работающего инстанса (`agno 3.1.10`, `RUNTIME_ENV=dev`). Состояние на момент создания мастер-спецификации.

## Не покрыто или покрыто частично
- [ ] `openspec/context/` отсутствует — файлы контекста (продукт, глоссарий, архитектура, стандарты, безопасность, антипаттерны) не читались и не создавались.
- [ ] Для всех 182 операций API (`openspec/specs/api/*`) описаны параметры, имена полей тела запроса и объявленные коды ответов. Не описаны: типы и ограничения полей, структуры ответов, типы SSE-событий (`RunStarted` и др.), бизнес-правила переходов (`/company/*/transitions`, статусы Approval/Task/Project).
- [ ] Эндпоинты и поведение MCP (`/mcp`) проверены только на уровне `GET /mcp` (302 → `/mcp/server-card`) и конфигурации; перечень инструментов `tools/list` не снят (нужна инициализация MCP-сессии).
- [ ] Поведение при включённой авторизации (`RUNTIME_ENV=prd`, JWT) не проверялось: схема снята в dev-режиме. Утверждение «приложение отказывается стартовать без `JWT_VERIFICATION_KEY`/`JWT_JWKS_FILE`» взято из `example.env` и `compose.prod.yaml`, в коде репозитория не реализовано — проверить в библиотеке Agno.
- [ ] Скрипты `scripts/*.sh` (`mcp_check.sh`, `validate.sh`, `format.sh`, `build_image.sh`, `venv_setup.sh`) не специфицированы.
- [ ] Агенты `platform-builder-internal` и `platform-manager-internal` (участники `os-manager-internal`) не видны в `GET /agents`, их инструкции и инструменты задаются библиотекой; не описаны.
- [ ] Интерфейс Slack проверен только по коду `app/interfaces.py`, живая интеграция не запускалась.
- [ ] Frontend в репозитории отсутствует; каталог `ui/` не создан. Запросы внешнего AgentOS UI (`os.agno.com`) не снимались.

## Расхождения кода и документации
- [ ] `README.md`, `AGENTS.md`, `.agents/skills/setup-platform/SKILL.md` и `evals/cases.py` (критерий `manager_explains_application`) утверждают, что `OPENAI_API_KEY` нужен для OS Manager. После перехода на Claude (`app/settings.py`) OS Manager работает на `ANTHROPIC_API_KEY`; `OPENAI_API_KEY` нужен для эмбеддингов и Codex Engineer. README исправлен частично (таблица настроек), остальное нужно синхронизировать.
- [ ] `example.env` помечает `OPENAI_API_KEY` и `ANTHROPIC_API_KEY` как «Required», а `README.md` («Open `.env` and set `OPENAI_API_KEY`») требует только OpenAI.
- [ ] `claude-engineer` использует `model="claude-opus-5-5"` напрямую, а не `manager_model()`; `codex-engineer` — `gpt-6.1-sol` напрямую. Эти строки не управляются `app/settings.py`.

## Замечания по качеству
- [ ] При генерации OpenAPI FastAPI выдаёт предупреждение `Duplicate Operation ID get_config for function get_config_version` (библиотека Agno); возможна неоднозначность operationId.
- [ ] `agent_os.serve(... host="127.0.0.1" ...)` в `app/main.py` отличается от запуска в контейнере (`--host 0.0.0.0`): прямой запуск `python -m app.main` слушает только loopback.
